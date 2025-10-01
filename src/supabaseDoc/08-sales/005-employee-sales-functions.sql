-- ===========================================================
-- FUNCIONES DE VENTAS PARA EMPLEADOS - ROL BARTENDER
-- ===========================================================
-- Permite que empleados con rol bartender puedan crear ventas
-- usando su propio usuario como empleado de la venta

-- ========================================
-- PASO 1: FUNCIÓN PARA CREAR VENTA COMO EMPLEADO
-- ========================================

-- Función específica para que empleados creen ventas con su propio usuario
CREATE OR REPLACE FUNCTION public.fn_create_sale_as_employee(
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
  v_employee record;
  v_sale_number text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_product record;
  v_line_total numeric;
BEGIN
  -- Verificar que el usuario actual es un empleado activo
  v_club_id := fn_current_employee_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo empleados activos pueden crear ventas';
  END IF;

  -- Obtener información del empleado actual
  SELECT e.*, COALESCE(a.full_name, e.full_name) as employee_name,
         CASE WHEN a.user_id IS NOT NULL THEN 'admin' ELSE e.category::text END as employee_category
  INTO v_employee
  FROM public.employees e
  LEFT JOIN public.admins a ON a.user_id = e.user_id AND a.status = 'active'
  WHERE e.user_id = auth.uid()
    AND e.status = 'active'
    AND e.club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado no encontrado o inactivo';
  END IF;

  -- Validar datos de entrada
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe incluir al menos un item en la venta';
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

  -- Crear la venta usando el empleado actual
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
    auth.uid(), -- Siempre usa el usuario actual (empleado)
    v_employee.employee_name,
    v_employee.employee_category,
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
  RAISE NOTICE 'Venta creada por empleado: % - Empleado: % - Total: %', v_sale_number, v_employee.employee_name, v_total;

  RETURN v_sale_id;
END;
$$;

-- ========================================
-- PASO 2: ACTUALIZAR POLÍTICAS RLS PARA EMPLEADOS
-- ========================================

-- Política para que empleados puedan ver ventas de su club
DROP POLICY IF EXISTS sales_employee_select ON public.sales;
CREATE POLICY sales_employee_select
  ON public.sales
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_employee_club_id() -- Empleados pueden ver ventas de su club
  );

-- Política para que empleados puedan crear ventas (solo para su propio usuario)
DROP POLICY IF EXISTS sales_employee_insert ON public.sales;
CREATE POLICY sales_employee_insert
  ON public.sales
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id = fn_current_employee_club_id()
    AND employee_id = auth.uid() -- Solo pueden crear ventas con su propio user_id
  );

-- Los empleados NO pueden actualizar ventas (solo admins)
-- Los empleados NO pueden eliminar ventas (solo admins)

-- ========================================
-- PASO 3: POLÍTICAS PARA SALE_ITEMS (EMPLEADOS)
-- ========================================

-- Empleados pueden ver items de ventas de su club
DROP POLICY IF EXISTS sale_items_employee_select ON public.sale_items;
CREATE POLICY sale_items_employee_select
  ON public.sale_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_employee_club_id()
    )
  );

-- Empleados pueden crear items (cuando crean una venta)
DROP POLICY IF EXISTS sale_items_employee_insert ON public.sale_items;
CREATE POLICY sale_items_employee_insert
  ON public.sale_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_employee_club_id()
        AND s.employee_id = auth.uid() -- Solo en ventas que creó el empleado
    )
  );

-- Los empleados NO pueden actualizar items (solo admins)
-- Los empleados NO pueden eliminar items (solo admins)

-- ========================================
-- PASO 4: FUNCIÓN PARA OBTENER VENTAS DEL EMPLEADO ACTUAL
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_get_employee_today_sales()
RETURNS SETOF public.sales_with_details
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.sales_with_details
  WHERE club_id = fn_current_employee_club_id()
    AND DATE(sale_date) = CURRENT_DATE
  ORDER BY sale_date DESC;
$$;

-- ========================================
-- PASO 5: FUNCIÓN PARA OBTENER ESTADÍSTICAS DE VENTAS DEL EMPLEADO
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_get_employee_sales_stats(
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
  v_employee_id uuid;
BEGIN
  v_club_id := fn_current_employee_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo empleados activos pueden ver estadísticas';
  END IF;

  v_employee_id := auth.uid();

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
    )
  ) INTO v_stats
  FROM public.sales s
  WHERE s.club_id = v_club_id
    AND s.employee_id = v_employee_id -- Solo sus propias ventas
    AND s.status = 'completed'
    AND DATE(s.sale_date) BETWEEN p_start_date AND p_end_date;

  RETURN v_stats;
END;
$$;

-- ========================================
-- COMENTARIOS DE USO PARA EMPLEADOS
-- ========================================

/*
EJEMPLOS DE USO PARA EMPLEADOS (BARTENDER):

1. CREAR VENTA COMO EMPLEADO:
SELECT fn_create_sale_as_employee(
  '[
    {"product_id": "uuid-product-1", "quantity": 2, "unit_price": 10.50},
    {"product_id": "uuid-product-2", "quantity": 1}
  ]'::jsonb,
  'cash',
  null,
  5.00,
  'Venta realizada por bartender'
);

2. VER VENTAS DEL DÍA (SOLO DE SU CLUB):
SELECT * FROM fn_get_employee_today_sales();

3. ESTADÍSTICAS PROPIAS:
SELECT fn_get_employee_sales_stats(CURRENT_DATE, CURRENT_DATE);

CARACTERÍSTICAS PARA EMPLEADOS:
✅ Pueden crear ventas usando SOLO su propio usuario
✅ Pueden ver todas las ventas del club (para coordinación)
✅ Pueden ver estadísticas de sus propias ventas
❌ NO pueden editar ventas existentes
❌ NO pueden cambiar el empleado de una venta
❌ NO pueden eliminar ventas
❌ NO pueden crear ventas para otros empleados
✅ Control automático de stock
✅ Auditoría completa
✅ Seguridad RLS por club
*/