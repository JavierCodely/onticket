-- ===========================================================
-- INSTALACIÓN LIMPIA DEL SISTEMA DE VENTAS CON EDICIÓN
-- ===========================================================
-- Ejecutar este archivo para limpiar e instalar todo desde cero

-- ========================================
-- PASO 1: LIMPIAR TODO LO RELACIONADO CON VENTAS
-- ========================================

-- 1.1) Eliminar funciones dependientes de ventas (en orden inverso de dependencias)
DROP FUNCTION IF EXISTS public.fn_get_sales_stats(date, date) CASCADE;
DROP FUNCTION IF EXISTS public.fn_get_today_sales() CASCADE;
DROP FUNCTION IF EXISTS public.fn_cancel_refund_sale(uuid, sale_status, text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_remove_sale_item(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_sale_item(uuid, integer, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.fn_add_sale_item(uuid, uuid, integer, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_sale(uuid, text, payment_method, jsonb, numeric, text, sale_status, text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_create_sale(text, jsonb, payment_method, jsonb, numeric, text) CASCADE;
DROP FUNCTION IF EXISTS public.fn_generate_sale_number(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.notify_new_sale() CASCADE;

-- 1.2) Eliminar vista
DROP VIEW IF EXISTS public.sales_with_details CASCADE;

-- 1.3) Eliminar tablas (en orden de dependencias)
DROP TABLE IF EXISTS public.sale_items CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;

-- 1.4) Eliminar tipos ENUM
DROP TYPE IF EXISTS public.sale_status CASCADE;
DROP TYPE IF EXISTS public.payment_method CASCADE;

-- ========================================
-- PASO 2: CREAR TODO DESDE CERO CON EDICIÓN INCLUIDA
-- ========================================

-- 2.1) Crear tipos ENUM
CREATE TYPE public.payment_method AS ENUM (
  'cash',          -- Efectivo
  'transfer',      -- Transferencia
  'credit',        -- Crédito
  'debit',         -- Débito
  'mixed'          -- Mixto (combinación de métodos)
);

CREATE TYPE public.sale_status AS ENUM (
  'pending',       -- Pendiente
  'completed',     -- Completada
  'cancelled',     -- Cancelada
  'refunded'       -- Reembolsada
);

-- 2.2) Crear tabla principal de ventas
CREATE TABLE public.sales (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Información de la venta
  sale_number           text NOT NULL,                               -- Número de venta único por club
  sale_date             timestamptz NOT NULL DEFAULT NOW(),         -- Fecha y hora de la venta

  -- Empleado que realizó la venta
  employee_id           uuid NOT NULL REFERENCES auth.users(id),    -- ID del empleado
  employee_name         text NOT NULL,                              -- Nombre del empleado (denormalizado)

  -- Totales de la venta
  subtotal              numeric(10,2) NOT NULL DEFAULT 0,           -- Subtotal antes de descuentos
  discount_amount       numeric(10,2) NOT NULL DEFAULT 0,           -- Monto de descuento
  tax_amount            numeric(10,2) NOT NULL DEFAULT 0,           -- Impuestos (si aplica)
  total_amount          numeric(10,2) NOT NULL DEFAULT 0,           -- Total final

  -- Método de pago
  payment_method        payment_method NOT NULL,                    -- Método de pago principal
  payment_details       jsonb,                                      -- Detalles del pago (para pagos mixtos)

  -- Estado y metadatos
  status                sale_status NOT NULL DEFAULT 'completed',   -- Estado de la venta
  notes                 text,                                        -- Notas adicionales
  refund_reason         text,                                        -- Razón del reembolso (si aplica)

  -- Auditoría
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE (club_id, sale_number),                                    -- Número de venta único por club
  CHECK (subtotal >= 0),                                            -- Subtotal no negativo
  CHECK (discount_amount >= 0),                                     -- Descuento no negativo
  CHECK (tax_amount >= 0),                                          -- Impuestos no negativos
  CHECK (total_amount >= 0),                                        -- Total no negativo
  CHECK (total_amount = subtotal - discount_amount + tax_amount)    -- Consistencia de totales
);

-- 2.3) Crear tabla de items de venta
CREATE TABLE public.sale_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id               uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id            uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,

  -- Información del producto al momento de la venta
  product_name          text NOT NULL,                              -- Nombre del producto (denormalizado)
  product_sku           text,                                       -- SKU del producto (denormalizado)
  unit_price            numeric(10,2) NOT NULL,                     -- Precio unitario al momento de venta
  quantity              integer NOT NULL,                           -- Cantidad vendida
  line_total            numeric(10,2) NOT NULL,                     -- Total de la línea (precio * cantidad)

  -- Metadatos
  created_at            timestamptz NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (unit_price >= 0),                                          -- Precio unitario no negativo
  CHECK (quantity > 0),                                             -- Cantidad positiva
  CHECK (line_total = unit_price * quantity)                       -- Consistencia de total de línea
);

-- 2.4) Crear índices
CREATE INDEX sales_club_idx ON public.sales (club_id);
CREATE INDEX sales_employee_idx ON public.sales (employee_id);
CREATE INDEX sales_date_idx ON public.sales (sale_date);
CREATE INDEX sales_status_idx ON public.sales (status);
CREATE INDEX sales_payment_method_idx ON public.sales (payment_method);
CREATE INDEX sales_number_idx ON public.sales (sale_number);
CREATE INDEX sales_club_date_idx ON public.sales (club_id, sale_date DESC);
CREATE INDEX sales_club_employee_idx ON public.sales (club_id, employee_id);

CREATE INDEX sale_items_sale_idx ON public.sale_items (sale_id);
CREATE INDEX sale_items_product_idx ON public.sale_items (product_id);
CREATE INDEX sale_items_created_at_idx ON public.sale_items (created_at);

-- 2.5) Crear triggers de updated_at
CREATE TRIGGER trg_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 2.6) Crear vista con IDs correctos desde el inicio
CREATE VIEW public.sales_with_details AS
SELECT
  s.*,
  e.full_name as employee_full_name,
  e.category as employee_category,
  COUNT(si.id) as items_count,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', si.id,                    -- ✅ ID real del sale_item
        'product_id', si.product_id,    -- ✅ ID real del producto
        'product_name', si.product_name,
        'product_sku', si.product_sku,
        'quantity', si.quantity,
        'unit_price', si.unit_price,
        'line_total', si.line_total,
        'created_at', si.created_at
      ) ORDER BY si.created_at
    ) FILTER (WHERE si.id IS NOT NULL),
    '[]'::jsonb
  ) as items
FROM public.sales s
LEFT JOIN public.employees e ON e.user_id = s.employee_id
LEFT JOIN public.sale_items si ON si.sale_id = s.id
GROUP BY s.id, s.club_id, s.sale_number, s.sale_date, s.employee_id, s.employee_name,
         s.subtotal, s.discount_amount, s.tax_amount, s.total_amount, s.payment_method,
         s.payment_details, s.status, s.notes, s.refund_reason, s.created_at, s.updated_at,
         e.full_name, e.category;

-- 2.7) Configurar RLS en la vista
ALTER VIEW public.sales_with_details SET (security_invoker = on);

-- ========================================
-- PASO 3: CREAR TODAS LAS FUNCIONES
-- ========================================

-- 3.1) Función para generar número de venta único
CREATE FUNCTION public.fn_generate_sale_number(p_club_id uuid)
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
  -- Generar prefijo con fecha (YYYYMMDD)
  v_date_prefix := to_char(NOW(), 'YYYYMMDD');

  -- Obtener siguiente número secuencial del día
  SELECT COALESCE(MAX(
    CAST(
      substring(sale_number from length(v_date_prefix) + 2) AS integer
    )
  ), 0) + 1
  INTO v_sequence
  FROM public.sales
  WHERE club_id = p_club_id
    AND sale_number LIKE v_date_prefix || '-%';

  -- Formatear número de venta: YYYYMMDD-NNNN
  v_sale_number := v_date_prefix || '-' || lpad(v_sequence::text, 4, '0');

  RETURN v_sale_number;
END;
$$;

-- 3.2) Función para crear venta completa
CREATE FUNCTION public.fn_create_sale(
  p_employee_name text,             -- Nombre del empleado que realiza la venta
  p_items jsonb,                    -- Array de items: [{"product_id": "uuid", "quantity": 2, "unit_price": 10.50}]
  p_payment_method payment_method,
  p_payment_details jsonb DEFAULT NULL,
  p_discount_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  v_club_id uuid;
  v_employee_name text;
  v_sale_number text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_product_name text;
  v_product_sku text;
  v_line_total numeric;
  v_is_admin boolean := false;
BEGIN
  -- Verificar si es admin o empleado autorizado
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  -- Validar que el employee_name no esté vacío
  IF p_employee_name IS NULL OR trim(p_employee_name) = '' THEN
    RAISE EXCEPTION 'El nombre del empleado es requerido';
  END IF;

  v_employee_name := p_employee_name;

  IF v_is_admin THEN
    -- Es admin, obtener club_id del admin
    SELECT a.club_id
    INTO v_club_id
    FROM public.admins a
    WHERE a.user_id = auth.uid() AND a.status = 'active';

    IF v_club_id IS NULL THEN
      RAISE EXCEPTION 'Administrador no encontrado o inactivo';
    END IF;
  ELSE
    -- No es admin, verificar si es empleado autorizado
    IF NOT fn_can_edit_stock() THEN
      RAISE EXCEPTION 'Solo administradores, bartenders y cajeros pueden crear ventas';
    END IF;

    -- Obtener club_id del empleado
    SELECT e.club_id
    INTO v_club_id
    FROM public.employees e
    WHERE e.user_id = auth.uid() AND e.status = 'active';

    IF v_club_id IS NULL THEN
      RAISE EXCEPTION 'Empleado no encontrado o inactivo';
    END IF;
  END IF;

  -- Generar número de venta
  v_sale_number := fn_generate_sale_number(v_club_id);

  -- Calcular subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_line_total := (v_item->>'unit_price')::numeric * (v_item->>'quantity')::integer;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  -- Calcular total
  v_total := v_subtotal - p_discount_amount;

  -- Crear la venta
  INSERT INTO public.sales (
    club_id,
    sale_number,
    employee_id,
    employee_name,
    subtotal,
    discount_amount,
    total_amount,
    payment_method,
    payment_details,
    notes
  ) VALUES (
    v_club_id,
    v_sale_number,
    auth.uid(),
    v_employee_name,
    v_subtotal,
    p_discount_amount,
    v_total,
    p_payment_method,
    p_payment_details,
    p_notes
  ) RETURNING id INTO v_sale_id;

  -- Crear los items de venta y actualizar stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Obtener información del producto
    SELECT name, sku
    INTO v_product_name, v_product_sku
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid;

    -- Calcular total de línea
    v_line_total := (v_item->>'unit_price')::numeric * (v_item->>'quantity')::integer;

    -- Crear item de venta
    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      product_name,
      product_sku,
      unit_price,
      quantity,
      line_total
    ) VALUES (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      v_product_name,
      v_product_sku,
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::integer,
      v_line_total
    );

    -- Actualizar stock del producto
    PERFORM fn_update_product_stock(
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer
    );
  END LOOP;

  RETURN v_sale_id;
END;
$$;

-- 3.3) Función para obtener ventas del día
CREATE FUNCTION public.fn_get_today_sales()
RETURNS SETOF public.sales_with_details
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.sales_with_details
  WHERE club_id = COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id())
    AND DATE(sale_date) = CURRENT_DATE
  ORDER BY sale_date DESC;
$$;

-- 3.4) Función para estadísticas de ventas
CREATE FUNCTION public.fn_get_sales_stats(
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
  v_payment_methods jsonb := '{}'::jsonb;
  v_top_employees jsonb := '[]'::jsonb;
  v_hourly_sales jsonb := '[]'::jsonb;
  v_total_sales integer := 0;
  v_total_amount numeric := 0;
  v_avg_sale_amount numeric := 0;
  v_employees_count integer := 0;
BEGIN
  -- Obtener club_id del usuario actual
  v_club_id := COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id());

  IF v_club_id IS NULL THEN
    RETURN jsonb_build_object(
      'total_sales', 0,
      'total_amount', 0,
      'average_sale', 0,
      'employees_count', 0,
      'payment_methods', '{}'::jsonb,
      'top_employees', '[]'::jsonb,
      'hourly_sales', '[]'::jsonb
    );
  END IF;

  -- Estadísticas básicas
  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(total_amount), 0),
    COALESCE(AVG(total_amount), 0),
    COUNT(DISTINCT employee_name)
  INTO v_total_sales, v_total_amount, v_avg_sale_amount, v_employees_count
  FROM public.sales
  WHERE club_id = v_club_id
    AND DATE(sale_date) BETWEEN p_start_date AND p_end_date
    AND status = 'completed';

  -- Métodos de pago
  SELECT COALESCE(
    jsonb_object_agg(
      payment_method::text,
      jsonb_build_object(
        'count', count,
        'amount', amount
      )
    ),
    '{}'::jsonb
  ) INTO v_payment_methods
  FROM (
    SELECT
      payment_method,
      COUNT(*) as count,
      SUM(total_amount) as amount
    FROM public.sales
    WHERE club_id = v_club_id
      AND DATE(sale_date) BETWEEN p_start_date AND p_end_date
      AND status = 'completed'
    GROUP BY payment_method
  ) payment_stats;

  -- Top empleados
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'employee_name', employee_name,
        'count', count,
        'amount', amount
      )
    ),
    '[]'::jsonb
  ) INTO v_top_employees
  FROM (
    SELECT
      employee_name,
      COUNT(*) as count,
      SUM(total_amount) as amount
    FROM public.sales
    WHERE club_id = v_club_id
      AND DATE(sale_date) BETWEEN p_start_date AND p_end_date
      AND status = 'completed'
    GROUP BY employee_name
    ORDER BY amount DESC
    LIMIT 5
  ) employee_stats;

  -- Ventas por hora
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'hour', hour,
        'count', count,
        'amount', amount
      )
    ),
    '[]'::jsonb
  ) INTO v_hourly_sales
  FROM (
    SELECT
      EXTRACT(HOUR FROM sale_date)::integer as hour,
      COUNT(*) as count,
      SUM(total_amount) as amount
    FROM public.sales
    WHERE club_id = v_club_id
      AND DATE(sale_date) BETWEEN p_start_date AND p_end_date
      AND status = 'completed'
    GROUP BY EXTRACT(HOUR FROM sale_date)
    ORDER BY hour
  ) hourly_stats;

  -- Construir resultado final
  v_stats := jsonb_build_object(
    'total_sales', v_total_sales,
    'total_amount', v_total_amount,
    'average_sale', v_avg_sale_amount,
    'employees_count', v_employees_count,
    'payment_methods', v_payment_methods,
    'top_employees', v_top_employees,
    'hourly_sales', v_hourly_sales
  );

  RETURN v_stats;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'total_sales', 0,
      'total_amount', 0,
      'average_sale', 0,
      'employees_count', 0,
      'payment_methods', '{}'::jsonb,
      'top_employees', '[]'::jsonb,
      'hourly_sales', '[]'::jsonb,
      'error', SQLERRM
    );
END;
$$;

-- ========================================
-- PASO 4: FUNCIONES DE EDICIÓN
-- ========================================

-- 4.1) Función para actualizar venta
CREATE FUNCTION public.fn_update_sale(
  p_sale_id uuid,
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
  v_sale_record RECORD;
  v_club_id uuid;
  v_is_admin boolean := false;
  v_can_edit boolean := false;
  v_new_total numeric;
BEGIN
  -- Check if current user is admin
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  -- Get sale information
  SELECT * INTO v_sale_record
  FROM public.sales
  WHERE id = p_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Permission checks
  IF v_is_admin THEN
    -- Admin can edit sales in their club
    SELECT a.club_id INTO v_club_id
    FROM public.admins a
    WHERE a.user_id = auth.uid() AND a.status = 'active';

    v_can_edit := (v_club_id = v_sale_record.club_id);
  ELSE
    -- Employee can only edit their own sales
    SELECT e.club_id INTO v_club_id
    FROM public.employees e
    WHERE e.user_id = auth.uid() AND e.status = 'active'
      AND e.category IN ('bartender', 'cashier');

    v_can_edit := (v_club_id = v_sale_record.club_id
                   AND auth.uid() = v_sale_record.employee_id
                   AND v_sale_record.status IN ('pending', 'completed'));
  END IF;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'No tienes permisos para editar esta venta';
  END IF;

  -- Calculate new total if discount changed
  IF p_discount_amount IS NOT NULL THEN
    v_new_total := v_sale_record.subtotal - p_discount_amount + v_sale_record.tax_amount;
  END IF;

  -- Update sale
  UPDATE public.sales
  SET
    employee_name = COALESCE(p_employee_name, employee_name),
    payment_method = COALESCE(p_payment_method, payment_method),
    payment_details = COALESCE(p_payment_details, payment_details),
    discount_amount = COALESCE(p_discount_amount, discount_amount),
    total_amount = COALESCE(v_new_total, total_amount),
    notes = COALESCE(p_notes, notes),
    status = COALESCE(p_status, status),
    refund_reason = COALESCE(p_refund_reason, refund_reason),
    updated_at = NOW()
  WHERE id = p_sale_id;

  RETURN TRUE;
END;
$$;

-- 4.2) Función para agregar item a venta
CREATE FUNCTION public.fn_add_sale_item(
  p_sale_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_unit_price numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_record RECORD;
  v_product_record RECORD;
  v_club_id uuid;
  v_is_admin boolean := false;
  v_can_edit boolean := false;
  v_item_id uuid;
  v_line_total numeric;
  v_new_subtotal numeric;
  v_new_total numeric;
BEGIN
  -- Check permissions (same logic as update_sale)
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  SELECT * INTO v_sale_record FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  SELECT * INTO v_product_record FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  -- Permission checks
  IF v_is_admin THEN
    SELECT a.club_id INTO v_club_id FROM public.admins a WHERE a.user_id = auth.uid() AND a.status = 'active';
    v_can_edit := (v_club_id = v_sale_record.club_id);
  ELSE
    SELECT e.club_id INTO v_club_id FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active' AND e.category IN ('bartender', 'cashier');
    v_can_edit := (v_club_id = v_sale_record.club_id AND auth.uid() = v_sale_record.employee_id AND v_sale_record.status IN ('pending', 'completed'));
  END IF;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'No tienes permisos para editar esta venta';
  END IF;

  -- Calculate and create item
  v_line_total := p_unit_price * p_quantity;

  INSERT INTO public.sale_items (sale_id, product_id, product_name, product_sku, unit_price, quantity, line_total)
  VALUES (p_sale_id, p_product_id, v_product_record.name, v_product_record.sku, p_unit_price, p_quantity, v_line_total)
  RETURNING id INTO v_item_id;

  -- Update sale totals
  v_new_subtotal := v_sale_record.subtotal + v_line_total;
  v_new_total := v_new_subtotal - v_sale_record.discount_amount + v_sale_record.tax_amount;

  UPDATE public.sales SET subtotal = v_new_subtotal, total_amount = v_new_total, updated_at = NOW() WHERE id = p_sale_id;

  -- Update stock
  PERFORM fn_update_product_stock(p_product_id, p_quantity);

  RETURN v_item_id;
END;
$$;

-- 4.3) Función para actualizar item
CREATE FUNCTION public.fn_update_sale_item(
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
  v_item_record RECORD;
  v_club_id uuid;
  v_is_admin boolean := false;
  v_can_edit boolean := false;
  v_old_line_total numeric;
  v_new_line_total numeric;
  v_quantity_diff integer;
  v_new_subtotal numeric;
  v_new_total numeric;
BEGIN
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  -- Get item and sale info
  SELECT si.*, s.* INTO v_item_record
  FROM public.sale_items si JOIN public.sales s ON s.id = si.sale_id
  WHERE si.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de venta no encontrado';
  END IF;

  -- Permission checks
  IF v_is_admin THEN
    SELECT a.club_id INTO v_club_id FROM public.admins a WHERE a.user_id = auth.uid() AND a.status = 'active';
    v_can_edit := (v_club_id = v_item_record.club_id);
  ELSE
    SELECT e.club_id INTO v_club_id FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active' AND e.category IN ('bartender', 'cashier');
    v_can_edit := (v_club_id = v_item_record.club_id AND auth.uid() = v_item_record.employee_id AND v_item_record.status IN ('pending', 'completed'));
  END IF;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'No tienes permisos para editar este item';
  END IF;

  -- Calculate changes
  v_old_line_total := v_item_record.line_total;
  v_new_line_total := COALESCE(p_unit_price, v_item_record.unit_price) * COALESCE(p_quantity, v_item_record.quantity);
  v_quantity_diff := COALESCE(p_quantity, v_item_record.quantity) - v_item_record.quantity;

  -- Update item
  UPDATE public.sale_items
  SET quantity = COALESCE(p_quantity, quantity), unit_price = COALESCE(p_unit_price, unit_price), line_total = v_new_line_total
  WHERE id = p_item_id;

  -- Update sale totals
  v_new_subtotal := v_item_record.subtotal - v_old_line_total + v_new_line_total;
  v_new_total := v_new_subtotal - v_item_record.discount_amount + v_item_record.tax_amount;

  UPDATE public.sales SET subtotal = v_new_subtotal, total_amount = v_new_total, updated_at = NOW() WHERE id = v_item_record.sale_id;

  -- Update stock if quantity changed
  IF v_quantity_diff != 0 THEN
    PERFORM fn_update_product_stock(v_item_record.product_id, v_quantity_diff);
  END IF;

  RETURN TRUE;
END;
$$;

-- 4.4) Función para eliminar item
CREATE FUNCTION public.fn_remove_sale_item(p_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_record RECORD;
  v_club_id uuid;
  v_is_admin boolean := false;
  v_can_edit boolean := false;
  v_new_subtotal numeric;
  v_new_total numeric;
BEGIN
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  SELECT si.*, s.* INTO v_item_record
  FROM public.sale_items si JOIN public.sales s ON s.id = si.sale_id
  WHERE si.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de venta no encontrado';
  END IF;

  -- Permission checks
  IF v_is_admin THEN
    SELECT a.club_id INTO v_club_id FROM public.admins a WHERE a.user_id = auth.uid() AND a.status = 'active';
    v_can_edit := (v_club_id = v_item_record.club_id);
  ELSE
    SELECT e.club_id INTO v_club_id FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active' AND e.category IN ('bartender', 'cashier');
    v_can_edit := (v_club_id = v_item_record.club_id AND auth.uid() = v_item_record.employee_id AND v_item_record.status IN ('pending', 'completed'));
  END IF;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'No tienes permisos para eliminar este item';
  END IF;

  -- Check if this is the last item
  IF (SELECT COUNT(*) FROM public.sale_items WHERE sale_id = v_item_record.sale_id) = 1 THEN
    RAISE EXCEPTION 'No se puede eliminar el último item de la venta';
  END IF;

  -- Remove item
  DELETE FROM public.sale_items WHERE id = p_item_id;

  -- Update totals
  v_new_subtotal := v_item_record.subtotal - v_item_record.line_total;
  v_new_total := v_new_subtotal - v_item_record.discount_amount + v_item_record.tax_amount;

  UPDATE public.sales SET subtotal = v_new_subtotal, total_amount = v_new_total, updated_at = NOW() WHERE id = v_item_record.sale_id;

  -- Restore stock
  PERFORM fn_update_product_stock(v_item_record.product_id, -v_item_record.quantity);

  RETURN TRUE;
END;
$$;

-- 4.5) Función para cancelar/reembolsar venta
CREATE FUNCTION public.fn_cancel_refund_sale(
  p_sale_id uuid,
  p_action sale_status,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_record RECORD;
  v_club_id uuid;
  v_is_admin boolean := false;
  v_item RECORD;
BEGIN
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  IF p_action NOT IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Acción inválida';
  END IF;

  SELECT * INTO v_sale_record FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Only admins can cancel/refund
  IF v_is_admin THEN
    SELECT a.club_id INTO v_club_id FROM public.admins a WHERE a.user_id = auth.uid() AND a.status = 'active';
    IF v_club_id != v_sale_record.club_id THEN
      RAISE EXCEPTION 'No tienes permisos para esta venta';
    END IF;
  ELSE
    RAISE EXCEPTION 'Solo administradores pueden cancelar/reembolsar ventas';
  END IF;

  IF v_sale_record.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Venta ya cancelada/reembolsada';
  END IF;

  -- Update sale
  UPDATE public.sales SET status = p_action, refund_reason = p_reason, updated_at = NOW() WHERE id = p_sale_id;

  -- Restore stock
  FOR v_item IN SELECT product_id, quantity FROM public.sale_items WHERE sale_id = p_sale_id
  LOOP
    PERFORM fn_update_product_stock(v_item.product_id, -v_item.quantity);
  END LOOP;

  RETURN TRUE;
END;
$$;

-- ========================================
-- PASO 5: CONFIGURAR RLS (ROW LEVEL SECURITY)
-- ========================================

-- 5.1) Habilitar RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- 5.2) Políticas para SALES

-- Service role puede todo
CREATE POLICY sales_all_service_role ON public.sales AS PERMISSIVE FOR ALL TO authenticated
USING ( (auth.jwt() ->> 'role') = 'service_role' )
WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- Admins: SELECT, UPDATE, DELETE en su club
CREATE POLICY sales_admin_select ON public.sales FOR SELECT TO authenticated
USING ( club_id = fn_current_admin_club_id() );

CREATE POLICY sales_admin_update ON public.sales FOR UPDATE TO authenticated
USING ( club_id = fn_current_admin_club_id() )
WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY sales_admin_delete ON public.sales FOR DELETE TO authenticated
USING ( club_id = fn_current_admin_club_id() AND status IN ('pending', 'cancelled') );

-- Empleados: SELECT ventas del club, INSERT/UPDATE sus propias ventas
CREATE POLICY sales_employee_select ON public.sales FOR SELECT TO authenticated
USING ( club_id = fn_current_employee_club_id() AND EXISTS (
  SELECT 1 FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active' AND e.category IN ('bartender', 'cashier')
));

CREATE POLICY sales_employee_insert ON public.sales FOR INSERT TO authenticated
WITH CHECK ( club_id = fn_current_employee_club_id() AND EXISTS (
  SELECT 1 FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active' AND e.category IN ('bartender', 'cashier')
));

CREATE POLICY sales_employee_update ON public.sales FOR UPDATE TO authenticated
USING ( club_id = fn_current_employee_club_id() AND employee_id = auth.uid() AND status IN ('pending', 'completed') AND EXISTS (
  SELECT 1 FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active' AND e.category IN ('bartender', 'cashier')
))
WITH CHECK ( club_id = fn_current_employee_club_id() AND employee_id = auth.uid() );

-- 5.3) Políticas para SALE_ITEMS

-- Service role puede todo
CREATE POLICY sale_items_all_service_role ON public.sale_items AS PERMISSIVE FOR ALL TO authenticated
USING ( (auth.jwt() ->> 'role') = 'service_role' )
WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- Los que pueden ver/editar ventas pueden ver/editar items
CREATE POLICY sale_items_select ON public.sale_items FOR SELECT TO authenticated
USING ( EXISTS (
  SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND (
    s.club_id = fn_current_admin_club_id() OR
    (s.club_id = fn_current_employee_club_id() AND EXISTS (
      SELECT 1 FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active' AND e.category IN ('bartender', 'cashier')
    ))
  )
));

CREATE POLICY sale_items_insert ON public.sale_items FOR INSERT TO authenticated
WITH CHECK ( EXISTS (
  SELECT 1 FROM public.sales s JOIN public.employees e ON e.user_id = auth.uid()
  WHERE s.id = sale_items.sale_id AND s.club_id = e.club_id AND e.status = 'active' AND e.category IN ('bartender', 'cashier')
));

CREATE POLICY sale_items_admin_update ON public.sale_items FOR UPDATE TO authenticated
USING ( EXISTS ( SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.club_id = fn_current_admin_club_id() ))
WITH CHECK ( EXISTS ( SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.club_id = fn_current_admin_club_id() ));

CREATE POLICY sale_items_admin_delete ON public.sale_items FOR DELETE TO authenticated
USING ( EXISTS ( SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.club_id = fn_current_admin_club_id() ));

CREATE POLICY sale_items_employee_update ON public.sale_items FOR UPDATE TO authenticated
USING ( EXISTS (
  SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.club_id = fn_current_employee_club_id() AND s.employee_id = auth.uid() AND s.status IN ('pending', 'completed') AND EXISTS (
    SELECT 1 FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active' AND e.category IN ('bartender', 'cashier')
  )
));

CREATE POLICY sale_items_employee_delete ON public.sale_items FOR DELETE TO authenticated
USING ( EXISTS (
  SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.club_id = fn_current_employee_club_id() AND s.employee_id = auth.uid() AND s.status IN ('pending', 'completed') AND EXISTS (
    SELECT 1 FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active' AND e.category IN ('bartender', 'cashier')
  )
));

-- ========================================
-- PASO 6: TRIGGER DE NOTIFICACIONES
-- ========================================

-- 6.1) Función de notificación
CREATE FUNCTION public.notify_new_sale()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'new_sale_' || NEW.club_id::text,
    json_build_object(
      'sale_id', NEW.id,
      'employee_name', NEW.employee_name,
      'total_amount', NEW.total_amount,
      'sale_date', NEW.sale_date
    )::text
  );
  RETURN NEW;
END;
$$;

-- 6.2) Trigger
CREATE TRIGGER trg_notify_new_sale
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION notify_new_sale();

-- ========================================
-- PASO 7: VERIFICACIÓN FINAL
-- ========================================

-- Verificar que todo se creó correctamente
SELECT
  'INSTALACIÓN COMPLETA' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('sales', 'sale_items') AND table_schema = 'public') as tables_created,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name LIKE 'fn_%sale%' AND routine_schema = 'public') as functions_created,
  (SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'sales_with_details' AND table_schema = 'public') as views_created,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('sales', 'sale_items')) as policies_created;

-- Mostrar funciones creadas
SELECT routine_name as function_name
FROM information_schema.routines
WHERE routine_name LIKE 'fn_%sale%' AND routine_schema = 'public'
ORDER BY routine_name;

/*
🎯 INSTALACIÓN COMPLETA TERMINADA

✅ Tablas: sales, sale_items
✅ Vista: sales_with_details (con IDs reales desde el inicio)
✅ Funciones base: crear, consultar, estadísticas
✅ Funciones de edición: actualizar, agregar, modificar, eliminar, cancelar
✅ Políticas RLS: permisos por rol (admin/empleado)
✅ Triggers: notificaciones en tiempo real

SIGUIENTE PASO:
1. Refrescar aplicación (F5)
2. Probar crear nueva venta
3. Probar editar venta existente
4. ¡Todo debería funcionar perfectamente!

NO NECESITAS APLICAR OTROS ARCHIVOS - TODO ESTÁ INCLUIDO AQUÍ.
*/