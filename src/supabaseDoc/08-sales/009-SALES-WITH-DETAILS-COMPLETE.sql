-- ========================================
-- SISTEMA DE VENTAS COMPLETO CON CAMPO DETAILS
-- ========================================
-- Este archivo actualiza el sistema de ventas existente para incluir
-- el campo details sin conflictos con el esquema actual
--
-- EJECUTAR DESPUÉS DE: SALES_SYSTEM_COMPLETE.sql
-- ========================================

-- ========================================
-- PASO 1: AGREGAR COLUMNA DETAILS A TABLA EXISTENTE
-- ========================================

-- Verificar si la columna ya existe para evitar errores
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'sales'
        AND column_name = 'details'
    ) THEN
        -- Agregar la columna details como JSONB
        ALTER TABLE public.sales
        ADD COLUMN details jsonb DEFAULT NULL;

        -- Crear un índice GIN para consultas eficientes en el campo JSONB
        CREATE INDEX IF NOT EXISTS sales_details_gin_idx ON public.sales USING gin (details);

        -- Comentario de la columna para documentación
        COMMENT ON COLUMN public.sales.details IS 'Detalles adicionales de la venta en formato JSON: descuentos manuales, promociones aplicadas, combos, etc.';

        RAISE NOTICE 'Columna details agregada exitosamente a la tabla sales';
    ELSE
        RAISE NOTICE 'La columna details ya existe en la tabla sales';
    END IF;
END;
$$;

-- ========================================
-- PASO 2: ACTUALIZAR VISTA SALES_WITH_DETAILS
-- ========================================

-- Recrear la vista para incluir el nuevo campo details
DROP VIEW IF EXISTS public.sales_with_details CASCADE;

CREATE VIEW public.sales_with_details AS
SELECT
  s.*,

  -- Información del empleado/admin que hizo la venta
  COALESCE(a.full_name, e.full_name, s.employee_name) as employee_full_name,
  CASE
    WHEN a.user_id IS NOT NULL THEN 'admin'
    WHEN e.user_id IS NOT NULL THEN e.category::text
    ELSE 'unknown'
  END as employee_role,

  -- Estadísticas de items
  COUNT(si.id) as items_count,

  -- Items como JSON agregado
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', si.id,
        'product_id', si.product_id,
        'product_name', si.product_name,
        'product_sku', si.product_sku,
        'product_category', si.product_category,
        'unit_price', si.unit_price,
        'quantity', si.quantity,
        'line_total', si.line_total
      ) ORDER BY si.created_at
    ) FILTER (WHERE si.id IS NOT NULL),
    '[]'::jsonb
  ) as items

FROM public.sales s
LEFT JOIN public.admins a ON a.user_id = s.employee_id AND a.status = 'active'
LEFT JOIN public.employees e ON e.user_id = s.employee_id AND e.status = 'active'
LEFT JOIN public.sale_items si ON si.sale_id = s.id
GROUP BY s.id, a.full_name, e.full_name, e.category, a.user_id, e.user_id;

-- ========================================
-- PASO 3: ACTUALIZAR FUNCIONES EXISTENTES
-- ========================================

-- 3.1) Eliminar todas las versiones de fn_create_sale que puedan existir
DROP FUNCTION IF EXISTS public.fn_create_sale(uuid, text, jsonb, payment_method, jsonb, numeric, text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_create_sale(uuid, text, jsonb, payment_method, jsonb, numeric, text, jsonb) CASCADE;

-- 3.2) Recrear función fn_create_sale con soporte para details
CREATE OR REPLACE FUNCTION public.fn_create_sale(
  p_employee_user_id uuid,              -- ID del empleado que aparecerá en la venta
  p_employee_name text,                 -- Nombre del empleado
  p_items jsonb,                        -- Array de items: [{"product_id": "uuid", "quantity": 2, "unit_price": 10.50}]
  p_payment_method payment_method,      -- Método de pago
  p_payment_details jsonb DEFAULT NULL, -- Detalles del pago
  p_discount_amount numeric DEFAULT 0,  -- Descuento
  p_notes text DEFAULT NULL,            -- Notas
  p_details jsonb DEFAULT NULL          -- NUEVO: Detalles de la venta (descuentos manuales, promociones, combos, etc.)
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  v_club_id uuid;
  v_sale_number text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_product record;
  v_line_total numeric;
  v_employee_category text;
BEGIN
  -- Verificar que el usuario actual es admin
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden crear ventas';
  END IF;

  -- Validar datos de entrada
  IF p_employee_name IS NULL OR trim(p_employee_name) = '' THEN
    RAISE EXCEPTION 'El nombre del empleado es requerido';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe incluir al menos un item en la venta';
  END IF;

  -- Verificar que el empleado existe y pertenece al club
  IF p_employee_user_id IS NOT NULL THEN
    -- Verificar si es admin
    SELECT 'admin' INTO v_employee_category
    FROM public.admins
    WHERE user_id = p_employee_user_id AND club_id = v_club_id AND status = 'active';

    -- Si no es admin, verificar si es empleado
    IF v_employee_category IS NULL THEN
      SELECT category::text INTO v_employee_category
      FROM public.employees
      WHERE user_id = p_employee_user_id AND club_id = v_club_id AND status = 'active';
    END IF;

    IF v_employee_category IS NULL THEN
      RAISE EXCEPTION 'El empleado seleccionado no existe o no pertenece a este club';
    END IF;
  ELSE
    v_employee_category := 'manual';
  END IF;

  -- Generar número de venta
  v_sale_number := fn_generate_sale_number(v_club_id);

  -- Validar y calcular totales
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Verificar que el producto existe y pertenece al club
    SELECT p.*, COALESCE(ps.available_stock, 0) as available_stock
    INTO v_product
    FROM public.products p
    LEFT JOIN public.product_stock ps ON ps.product_id = p.id
    WHERE p.id = (v_item->>'product_id')::uuid
      AND p.club_id = v_club_id
      AND p.status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado o inactivo: %', v_item->>'product_id';
    END IF;

    -- Verificar stock disponible
    IF v_product.available_stock < (v_item->>'quantity')::integer THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto: % (disponible: %)',
        v_product.name, v_product.available_stock;
    END IF;

    -- Usar precio del item o precio del producto
    v_line_total := COALESCE((v_item->>'unit_price')::numeric, v_product.sale_price) * (v_item->>'quantity')::integer;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  -- Calcular total final
  v_total := v_subtotal - COALESCE(p_discount_amount, 0);

  IF v_total < 0 THEN
    RAISE EXCEPTION 'El total de la venta no puede ser negativo';
  END IF;

  -- Crear la venta
  INSERT INTO public.sales (
    club_id,
    sale_number,
    employee_id,
    employee_name,
    employee_category,
    subtotal,
    discount_amount,
    total_amount,
    payment_method,
    payment_details,
    notes,
    details,  -- NUEVO: Campo details
    created_by,
    updated_by
  ) VALUES (
    v_club_id,
    v_sale_number,
    COALESCE(p_employee_user_id, auth.uid()),
    p_employee_name,
    v_employee_category,
    v_subtotal,
    COALESCE(p_discount_amount, 0),
    v_total,
    p_payment_method,
    p_payment_details,
    p_notes,
    p_details,  -- NUEVO: Valor para campo details
    auth.uid(),
    auth.uid()
  ) RETURNING id INTO v_sale_id;

  -- Crear items de venta y actualizar stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Obtener información del producto
    SELECT p.name, p.sku, p.category::text
    INTO v_product
    FROM public.products p
    WHERE p.id = (v_item->>'product_id')::uuid;

    -- Insertar item de venta
    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      product_name,
      product_sku,
      product_category,
      unit_price,
      quantity,
      line_total
    ) VALUES (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      v_product.name,
      v_product.sku,
      v_product.category,
      COALESCE((v_item->>'unit_price')::numeric, (SELECT sale_price FROM public.products WHERE id = (v_item->>'product_id')::uuid)),
      (v_item->>'quantity')::integer,
      COALESCE((v_item->>'unit_price')::numeric, (SELECT sale_price FROM public.products WHERE id = (v_item->>'product_id')::uuid)) * (v_item->>'quantity')::integer
    );

    -- Actualizar stock del producto
    PERFORM fn_update_product_stock(
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer
    );
  END LOOP;

  -- Log de la transacción
  RAISE NOTICE 'Venta creada: % - Total: %', v_sale_number, v_total;

  RETURN v_sale_id;
END;
$$;

-- 3.3) Eliminar y recrear función fn_update_sale con soporte para details
DROP FUNCTION IF EXISTS public.fn_update_sale(uuid, uuid, text, payment_method, jsonb, numeric, text, sale_status, text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_sale(uuid, uuid, text, payment_method, jsonb, numeric, text, jsonb, sale_status, text) CASCADE;

CREATE OR REPLACE FUNCTION public.fn_update_sale(
  p_sale_id uuid,
  p_employee_user_id uuid DEFAULT NULL,
  p_employee_name text DEFAULT NULL,
  p_payment_method payment_method DEFAULT NULL,
  p_payment_details jsonb DEFAULT NULL,
  p_discount_amount numeric DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_details jsonb DEFAULT NULL,          -- NUEVO: Detalles de la venta
  p_status sale_status DEFAULT NULL,
  p_refund_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale record;
  v_club_id uuid;
  v_employee_category text;
  v_old_total numeric;
  v_new_total numeric;
BEGIN
  -- Verificar que el usuario actual es admin
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden editar ventas';
  END IF;

  -- Obtener venta actual
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id AND club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Verificar empleado si se proporciona
  IF p_employee_user_id IS NOT NULL THEN
    -- Verificar si es admin
    SELECT 'admin' INTO v_employee_category
    FROM public.admins
    WHERE user_id = p_employee_user_id AND club_id = v_club_id AND status = 'active';

    -- Si no es admin, verificar si es empleado
    IF v_employee_category IS NULL THEN
      SELECT category::text INTO v_employee_category
      FROM public.employees
      WHERE user_id = p_employee_user_id AND club_id = v_club_id AND status = 'active';
    END IF;

    IF v_employee_category IS NULL THEN
      RAISE EXCEPTION 'El empleado seleccionado no existe o no pertenece a este club';
    END IF;
  END IF;

  v_old_total := v_sale.total_amount;

  -- Actualizar venta
  UPDATE public.sales
  SET
    employee_id = COALESCE(p_employee_user_id, employee_id),
    employee_name = COALESCE(p_employee_name, employee_name),
    employee_category = COALESCE(v_employee_category, employee_category),
    payment_method = COALESCE(p_payment_method, payment_method),
    payment_details = COALESCE(p_payment_details, payment_details),
    discount_amount = COALESCE(p_discount_amount, discount_amount),
    total_amount = subtotal - COALESCE(p_discount_amount, discount_amount),
    notes = COALESCE(p_notes, notes),
    details = COALESCE(p_details, details),  -- NUEVO: Actualizar campo details
    status = COALESCE(p_status, status),
    refund_reason = CASE
      WHEN p_status = 'refunded' THEN COALESCE(p_refund_reason, refund_reason)
      ELSE refund_reason
    END,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_sale_id
  RETURNING total_amount INTO v_new_total;

  RAISE NOTICE 'Venta actualizada: % - Nuevo total: %', v_sale.sale_number, v_new_total;

  RETURN TRUE;
END;
$$;

-- ========================================
-- PASO 4: FUNCIONES AUXILIARES PARA DETAILS
-- ========================================

-- 4.1) Función para extraer información de descuentos del campo details
CREATE OR REPLACE FUNCTION public.fn_get_sale_discount_details(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_details jsonb;
  v_discount_info jsonb;
BEGIN
  -- Obtener el campo details de la venta
  SELECT details INTO v_details
  FROM public.sales
  WHERE id = p_sale_id;

  -- Extraer información de descuentos
  v_discount_info := jsonb_build_object(
    'manual_discount', COALESCE(v_details->'discounts'->'manual_discount', '{}'::jsonb),
    'promotion_discounts', COALESCE(v_details->'promotions', '[]'::jsonb),
    'total_savings', COALESCE((v_details->'combos'->0->>'savings')::numeric, 0)
  );

  RETURN v_discount_info;
END;
$$;

-- 4.2) Función para extraer información de promociones del campo details
CREATE OR REPLACE FUNCTION public.fn_get_sale_promotions_details(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_details jsonb;
BEGIN
  -- Obtener el campo details de la venta
  SELECT COALESCE(details->'promotions', '[]'::jsonb) INTO v_details
  FROM public.sales
  WHERE id = p_sale_id;

  RETURN v_details;
END;
$$;

-- 4.3) Función para extraer información de combos del campo details
CREATE OR REPLACE FUNCTION public.fn_get_sale_combos_details(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_details jsonb;
BEGIN
  -- Obtener el campo details de la venta
  SELECT COALESCE(details->'combos', '[]'::jsonb) INTO v_details
  FROM public.sales
  WHERE id = p_sale_id;

  RETURN v_details;
END;
$$;

-- ========================================
-- PASO 5: GRANT PERMISOS PARA FUNCIONES
-- ========================================

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.fn_get_sale_discount_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_sale_promotions_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_sale_combos_details(uuid) TO authenticated;

-- ========================================
-- PASO 6: VERIFICACIÓN Y DOCUMENTACIÓN
-- ========================================

-- Verificar que todo funciona correctamente
DO $$
BEGIN
  -- Verificar que la columna details existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'sales'
    AND column_name = 'details'
  ) THEN
    RAISE NOTICE '✅ Columna details existe en tabla sales';
  ELSE
    RAISE EXCEPTION '❌ Columna details NO existe en tabla sales';
  END IF;

  -- Verificar que la vista existe
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'sales_with_details'
  ) THEN
    RAISE NOTICE '✅ Vista sales_with_details existe';
  ELSE
    RAISE EXCEPTION '❌ Vista sales_with_details NO existe';
  END IF;

  -- Verificar que las funciones existen
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE specific_schema = 'public'
    AND routine_name = 'fn_create_sale'
  ) THEN
    RAISE NOTICE '✅ Función fn_create_sale existe';
  ELSE
    RAISE EXCEPTION '❌ Función fn_create_sale NO existe';
  END IF;

  RAISE NOTICE '🎉 Implementación del campo details completada exitosamente!';
END;
$$;

-- ========================================
-- ESTRUCTURA ESPERADA DEL CAMPO DETAILS
-- ========================================
/*
DOCUMENTACIÓN: Estructura del campo details (jsonb)

{
  "discounts": {
    "manual_discount": {
      "applied": true,
      "amount": 10.50,
      "reason": "Cliente frecuente",
      "applied_by": "Juan Perez"
    }
  },
  "promotions": [
    {
      "promotion_id": "uuid-promocion",
      "promotion_name": "2x1 en cervezas",
      "promotion_type": "combo",
      "discount_amount": 15.00,
      "original_price": 30.00,
      "final_price": 15.00,
      "products_affected": [
        {
          "product_id": "uuid-producto",
          "product_name": "Cerveza Corona",
          "quantity": 2
        }
      ]
    }
  ],
  "combos": [
    {
      "combo_name": "Combo Noche",
      "combo_items": [
        {
          "product_id": "uuid-producto-1",
          "product_name": "Whisky",
          "quantity": 1
        },
        {
          "product_id": "uuid-producto-2",
          "product_name": "Hielo",
          "quantity": 1
        }
      ],
      "combo_price": 45.00,
      "individual_price": 60.00,
      "savings": 15.00
    }
  ],
  "special_conditions": {
    "employee_sale": true,
    "vip_customer": false,
    "special_event": "Noche de apertura"
  },
  "payment_details": {
    "tip_included": true,
    "tip_amount": 5.00,
    "service_charge": 2.50
  }
}

EJEMPLOS DE USO:

-- Ejemplo 1: Crear venta con descuento manual
SELECT fn_create_sale(
  'uuid-del-empleado'::uuid,
  'Juan Pérez',
  '[{"product_id": "uuid-product-1", "quantity": 2, "unit_price": 10.50}]'::jsonb,
  'cash',
  null,
  5.00,
  'Descuento aplicado',
  '{
    "discounts": {
      "manual_discount": {
        "applied": true,
        "amount": 5.00,
        "reason": "Cliente frecuente",
        "applied_by": "Juan Pérez"
      }
    }
  }'::jsonb
);

-- Ejemplo 2: Buscar ventas con descuentos manuales
SELECT * FROM sales_with_details
WHERE details->'discounts'->'manual_discount'->>'applied' = 'true';

-- Ejemplo 3: Consultar detalles de una venta específica
SELECT fn_get_sale_discount_details('uuid-venta');
SELECT fn_get_sale_promotions_details('uuid-venta');
SELECT fn_get_sale_combos_details('uuid-venta');
*/