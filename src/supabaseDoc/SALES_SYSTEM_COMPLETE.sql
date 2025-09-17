-- ===========================================================
-- SISTEMA DE VENTAS COMPLETO - INTEGRADO CON ESTRUCTURA EXISTENTE
-- ===========================================================
-- Sistema que registra ventas con empleados, métodos de pago,
-- numeración automática y permisos para admins

-- ========================================
-- PASO 1: LIMPIAR SISTEMA ANTERIOR SI EXISTE
-- ========================================

-- Eliminar funciones existentes
DROP FUNCTION IF EXISTS public.fn_get_sales_stats(date, date) CASCADE;
DROP FUNCTION IF EXISTS public.fn_get_today_sales() CASCADE;
DROP FUNCTION IF EXISTS public.fn_cancel_refund_sale(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_remove_sale_item(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_sale_item(uuid, integer, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.fn_add_sale_item(uuid, uuid, integer, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_sale(uuid, text, text, payment_method, jsonb, numeric, text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_create_sale(text, jsonb, payment_method, jsonb, numeric, text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_generate_sale_number(uuid) CASCADE;

-- Eliminar vista
DROP VIEW IF EXISTS public.sales_with_details CASCADE;

-- Eliminar tablas
DROP TABLE IF EXISTS public.sale_items CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;

-- Eliminar tipos ENUM existentes
DROP TYPE IF EXISTS public.sale_status CASCADE;
DROP TYPE IF EXISTS public.payment_method CASCADE;

-- ========================================
-- PASO 2: CREAR TIPOS ENUM
-- ========================================

-- Métodos de pago
CREATE TYPE public.payment_method AS ENUM (
  'cash',          -- Efectivo
  'transfer',      -- Transferencia
  'credit',        -- Tarjeta de Crédito
  'debit'          -- Tarjeta de Débito
);

-- Estados de venta
CREATE TYPE public.sale_status AS ENUM (
  'completed',     -- Completada
  'cancelled',     -- Cancelada
  'refunded'       -- Reembolsada
);

-- ========================================
-- PASO 3: CREAR TABLAS
-- ========================================

-- 3.1) Tabla principal de ventas
CREATE TABLE public.sales (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Información de la venta
  sale_number           text NOT NULL,                               -- Número único de venta
  sale_date             timestamptz NOT NULL DEFAULT NOW(),         -- Fecha y hora de la venta

  -- Empleado que realizó la venta (puede ser admin o empleado)
  employee_id           uuid NOT NULL REFERENCES auth.users(id),    -- ID del usuario que hizo la venta
  employee_name         text NOT NULL,                              -- Nombre del empleado (denormalizado)
  employee_category     text,                                       -- Categoría del empleado (admin, bartender, etc.)

  -- Totales financieros
  subtotal              numeric(12,2) NOT NULL DEFAULT 0,           -- Subtotal antes de descuentos
  discount_amount       numeric(12,2) NOT NULL DEFAULT 0,           -- Descuento aplicado
  total_amount          numeric(12,2) NOT NULL DEFAULT 0,           -- Total final

  -- Información de pago
  payment_method        payment_method NOT NULL,                    -- Método de pago usado
  payment_details       jsonb,                                      -- Detalles adicionales del pago

  -- Estado y metadatos
  status                sale_status NOT NULL DEFAULT 'completed',   -- Estado de la venta
  notes                 text,                                        -- Notas adicionales
  refund_reason         text,                                        -- Razón del reembolso (si aplica)

  -- Auditoría completa
  created_by            uuid REFERENCES auth.users(id),              -- Quién creó la venta
  updated_by            uuid REFERENCES auth.users(id),              -- Quién actualizó la venta
  created_at            timestamptz NOT NULL DEFAULT NOW(),          -- Cuándo se creó
  updated_at            timestamptz NOT NULL DEFAULT NOW(),          -- Cuándo se actualizó

  -- Constraints importantes
  UNIQUE (club_id, sale_number),                                    -- Número único por club
  CHECK (subtotal >= 0),                                            -- Subtotal no negativo
  CHECK (discount_amount >= 0),                                     -- Descuento no negativo
  CHECK (total_amount >= 0),                                        -- Total no negativo
  CHECK (total_amount = subtotal - discount_amount)                 -- Consistencia matemática
);

-- 3.2) Tabla de items de venta
CREATE TABLE public.sale_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id               uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id            uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,

  -- Información del producto al momento de la venta (denormalizada para historial)
  product_name          text NOT NULL,                              -- Nombre del producto
  product_sku           text,                                       -- SKU del producto
  product_category      text,                                       -- Categoría del producto

  -- Cantidades y precios
  unit_price            numeric(10,2) NOT NULL,                     -- Precio unitario al momento de venta
  quantity              integer NOT NULL,                           -- Cantidad vendida
  line_total            numeric(10,2) NOT NULL,                     -- Total de la línea

  -- Auditoría
  created_at            timestamptz NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (unit_price >= 0),                                          -- Precio no negativo
  CHECK (quantity > 0),                                             -- Cantidad positiva
  CHECK (line_total = unit_price * quantity)                       -- Consistencia matemática
);

-- ========================================
-- PASO 4: CREAR ÍNDICES OPTIMIZADOS
-- ========================================

-- Índices para tabla sales
CREATE INDEX sales_club_idx ON public.sales (club_id);
CREATE INDEX sales_employee_idx ON public.sales (employee_id);
CREATE INDEX sales_date_idx ON public.sales (sale_date DESC);
CREATE INDEX sales_status_idx ON public.sales (status);
CREATE INDEX sales_payment_method_idx ON public.sales (payment_method);
CREATE INDEX sales_number_idx ON public.sales (sale_number);
CREATE INDEX sales_club_date_idx ON public.sales (club_id, sale_date DESC);
CREATE INDEX sales_club_employee_idx ON public.sales (club_id, employee_id);

-- Índices para tabla sale_items
CREATE INDEX sale_items_sale_idx ON public.sale_items (sale_id);
CREATE INDEX sale_items_product_idx ON public.sale_items (product_id);
CREATE INDEX sale_items_created_at_idx ON public.sale_items (created_at);

-- ========================================
-- PASO 5: CREAR TRIGGERS
-- ========================================

-- Trigger para updated_at
CREATE TRIGGER trg_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ========================================
-- PASO 6: CREAR VISTA COMPLETA
-- ========================================

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
-- PASO 7: FUNCIONES DE NEGOCIO
-- ========================================

-- 7.1) Función para generar número de venta automático
CREATE OR REPLACE FUNCTION public.fn_generate_sale_number(p_club_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_prefix text;
  v_sequence integer;
  v_sale_number text;
BEGIN
  -- Formato: YYYYMMDD-NNNN (ej: 20241217-0001)
  v_date_prefix := to_char(NOW(), 'YYYYMMDD');

  -- Obtener siguiente número secuencial para el día
  SELECT COALESCE(MAX(
    CASE
      WHEN sale_number LIKE v_date_prefix || '-%'
      THEN (split_part(sale_number, '-', 2))::integer
      ELSE 0
    END
  ), 0) + 1
  INTO v_sequence
  FROM public.sales
  WHERE club_id = p_club_id
    AND DATE(sale_date) = CURRENT_DATE;

  v_sale_number := v_date_prefix || '-' || lpad(v_sequence::text, 4, '0');

  RETURN v_sale_number;
END;
$$;

-- 7.2) Función para crear venta completa
CREATE OR REPLACE FUNCTION public.fn_create_sale(
  p_employee_user_id uuid,              -- ID del empleado que aparecerá en la venta
  p_employee_name text,                 -- Nombre del empleado
  p_items jsonb,                        -- Array de items: [{"product_id": "uuid", "quantity": 2, "unit_price": 10.50}]
  p_payment_method payment_method,      -- Método de pago
  p_payment_details jsonb DEFAULT NULL, -- Detalles del pago
  p_discount_amount numeric DEFAULT 0,  -- Descuento
  p_notes text DEFAULT NULL             -- Notas
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
  v_current_user_role text;
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

-- 7.3) Función para actualizar venta (solo para admins)
CREATE OR REPLACE FUNCTION public.fn_update_sale(
  p_sale_id uuid,
  p_employee_user_id uuid DEFAULT NULL,
  p_employee_name text DEFAULT NULL,
  p_payment_method payment_method DEFAULT NULL,
  p_payment_details jsonb DEFAULT NULL,
  p_discount_amount numeric DEFAULT NULL,
  p_notes text DEFAULT NULL,
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

-- 7.4) Función para agregar item a venta existente
CREATE OR REPLACE FUNCTION public.fn_add_sale_item(
  p_sale_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_unit_price numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale record;
  v_product record;
  v_club_id uuid;
  v_item_id uuid;
  v_line_total numeric;
  v_final_price numeric;
BEGIN
  -- Verificar permisos
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden modificar ventas';
  END IF;

  -- Verificar venta
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id AND club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Verificar producto y stock
  SELECT p.*, COALESCE(ps.available_stock, 0) as available_stock
  INTO v_product
  FROM public.products p
  LEFT JOIN public.product_stock ps ON ps.product_id = p.id
  WHERE p.id = p_product_id
    AND p.club_id = v_club_id
    AND p.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF v_product.available_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente';
  END IF;

  -- Usar precio proporcionado o precio actual del producto
  v_final_price := COALESCE(p_unit_price, v_product.sale_price);
  v_line_total := v_final_price * p_quantity;

  -- Crear item
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
    p_sale_id,
    p_product_id,
    v_product.name,
    v_product.sku,
    v_product.category::text,
    v_final_price,
    p_quantity,
    v_line_total
  ) RETURNING id INTO v_item_id;

  -- Actualizar totales de la venta
  UPDATE public.sales
  SET
    subtotal = subtotal + v_line_total,
    total_amount = (subtotal + v_line_total) - discount_amount,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_sale_id;

  -- Actualizar stock
  PERFORM fn_update_product_stock(p_product_id, p_quantity);

  RETURN v_item_id;
END;
$$;

-- 7.5) Función para actualizar item existente
CREATE OR REPLACE FUNCTION public.fn_update_sale_item(
  p_item_id uuid,
  p_quantity integer DEFAULT NULL,
  p_unit_price numeric DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_club_id uuid;
  v_old_line_total numeric;
  v_new_line_total numeric;
  v_total_diff numeric;
  v_quantity_diff integer;
BEGIN
  -- Verificar permisos
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden modificar items';
  END IF;

  -- Obtener item y venta
  SELECT si.*, s.club_id, s.sale_number
  INTO v_item
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE si.id = p_item_id AND s.club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item no encontrado';
  END IF;

  v_old_line_total := v_item.line_total;
  v_quantity_diff := COALESCE(p_quantity, v_item.quantity) - v_item.quantity;

  -- Verificar stock si se aumenta cantidad
  IF v_quantity_diff > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.product_stock ps
      WHERE ps.product_id = v_item.product_id
        AND ps.available_stock >= v_quantity_diff
    ) THEN
      RAISE EXCEPTION 'Stock insuficiente para aumentar cantidad';
    END IF;
  END IF;

  -- Actualizar item
  UPDATE public.sale_items
  SET
    quantity = COALESCE(p_quantity, quantity),
    unit_price = COALESCE(p_unit_price, unit_price),
    line_total = COALESCE(p_unit_price, unit_price) * COALESCE(p_quantity, quantity)
  WHERE id = p_item_id
  RETURNING line_total INTO v_new_line_total;

  v_total_diff := v_new_line_total - v_old_line_total;

  -- Actualizar totales de venta
  UPDATE public.sales
  SET
    subtotal = subtotal + v_total_diff,
    total_amount = (subtotal + v_total_diff) - discount_amount,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = v_item.sale_id;

  -- Actualizar stock
  IF v_quantity_diff != 0 THEN
    PERFORM fn_update_product_stock(v_item.product_id, v_quantity_diff);
  END IF;

  RETURN TRUE;
END;
$$;

-- 7.6) Función para eliminar item
CREATE OR REPLACE FUNCTION public.fn_remove_sale_item(
  p_item_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_club_id uuid;
BEGIN
  -- Verificar permisos
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden eliminar items';
  END IF;

  -- Obtener item y venta
  SELECT si.*, s.club_id
  INTO v_item
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE si.id = p_item_id AND s.club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item no encontrado';
  END IF;

  -- Verificar que no sea el último item
  IF (SELECT COUNT(*) FROM public.sale_items WHERE sale_id = v_item.sale_id) = 1 THEN
    RAISE EXCEPTION 'No se puede eliminar el último item de la venta';
  END IF;

  -- Restaurar stock
  PERFORM fn_update_product_stock(v_item.product_id, -v_item.quantity);

  -- Actualizar totales de venta
  UPDATE public.sales
  SET
    subtotal = subtotal - v_item.line_total,
    total_amount = (subtotal - v_item.line_total) - discount_amount,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = v_item.sale_id;

  -- Eliminar item
  DELETE FROM public.sale_items WHERE id = p_item_id;

  RETURN TRUE;
END;
$$;

-- 7.7) Función para obtener estadísticas
CREATE OR REPLACE FUNCTION public.fn_get_sales_stats(
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_stats jsonb;
BEGIN
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden ver estadísticas';
  END IF;

  SELECT jsonb_build_object(
    'total_sales', COUNT(*),
    'total_amount', COALESCE(SUM(total_amount), 0),
    'avg_sale_amount', COALESCE(AVG(total_amount), 0),
    'payment_methods', jsonb_object_agg(
      payment_method,
      jsonb_build_object(
        'count', COUNT(*),
        'amount', SUM(total_amount)
      )
    ),
    'employees', jsonb_object_agg(
      employee_name,
      jsonb_build_object(
        'count', COUNT(*),
        'amount', SUM(total_amount)
      )
    )
  ) INTO v_stats
  FROM public.sales s
  WHERE s.club_id = v_club_id
    AND s.status = 'completed'
    AND DATE(s.sale_date) BETWEEN p_start_date AND p_end_date;

  RETURN v_stats;
END;
$$;

-- 7.8) Función para obtener ventas del día
CREATE OR REPLACE FUNCTION public.fn_get_today_sales()
RETURNS SETOF public.sales_with_details
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.sales_with_details
  WHERE club_id = fn_current_admin_club_id()
    AND DATE(sale_date) = CURRENT_DATE
  ORDER BY sale_date DESC;
$$;

-- ========================================
-- PASO 8: CONFIGURAR SEGURIDAD RLS
-- ========================================

-- Habilitar RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- 8.1) Políticas para service_role
CREATE POLICY sales_all_service_role
  ON public.sales
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

CREATE POLICY sale_items_all_service_role
  ON public.sale_items
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- 8.2) Políticas para admins (pueden ver y editar ventas de su club)
CREATE POLICY sales_admin_select
  ON public.sales
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

CREATE POLICY sales_admin_insert
  ON public.sales
  FOR INSERT
  TO authenticated
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY sales_admin_update
  ON public.sales
  FOR UPDATE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() )
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY sales_admin_delete
  ON public.sales
  FOR DELETE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

-- 8.3) Políticas para sale_items
CREATE POLICY sale_items_admin_select
  ON public.sale_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
    )
  );

CREATE POLICY sale_items_admin_insert
  ON public.sale_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
    )
  );

CREATE POLICY sale_items_admin_update
  ON public.sale_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
    )
  );

CREATE POLICY sale_items_admin_delete
  ON public.sale_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
    )
  );

-- ========================================
-- COMENTARIOS DE USO
-- ========================================

/*
EJEMPLOS DE USO:

1. CREAR VENTA:
SELECT fn_create_sale(
  'uuid-del-empleado'::uuid,
  'Juan Pérez',
  '[
    {"product_id": "uuid-product-1", "quantity": 2, "unit_price": 10.50},
    {"product_id": "uuid-product-2", "quantity": 1}
  ]'::jsonb,
  'cash',
  null,
  5.00,
  'Descuento especial'
);

2. ACTUALIZAR VENTA:
SELECT fn_update_sale(
  'uuid-venta'::uuid,
  'uuid-nuevo-empleado'::uuid,
  'María González',
  'transfer',
  null,
  0,
  'Sin descuento'
);

3. VER VENTAS CON DETALLES:
SELECT * FROM sales_with_details
WHERE DATE(sale_date) = CURRENT_DATE
ORDER BY sale_date DESC;

4. ESTADÍSTICAS DEL DÍA:
SELECT fn_get_sales_stats(CURRENT_DATE, CURRENT_DATE);

CARACTERÍSTICAS:
✅ Numeración automática de ventas (YYYYMMDD-NNNN)
✅ Registro completo de empleado (con validación)
✅ Métodos de pago (efectivo, transferencia, débito, crédito)
✅ Solo admins pueden crear y editar ventas
✅ Control automático de stock
✅ Auditoría completa (quién, cuándo, qué)
✅ Totales calculados automáticamente
✅ Integridad referencial
✅ Seguridad RLS por club
*/