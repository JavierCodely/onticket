-- ===========================================================
-- SISTEMA DE VENTAS DEL CLUB
-- ===========================================================

-- 01) Tipos enumerados para ventas
DO $$
BEGIN
  -- Métodos de pago
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM (
      'cash',          -- Efectivo
      'transfer',      -- Transferencia
      'credit',        -- Crédito
      'debit',         -- Débito
      'mixed'          -- Mixto (combinación de métodos)
    );
  END IF;

  -- Estado de la venta
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sale_status') THEN
    CREATE TYPE sale_status AS ENUM (
      'pending',       -- Pendiente
      'completed',     -- Completada
      'cancelled',     -- Cancelada
      'refunded'       -- Reembolsada
    );
  END IF;
END$$;

-- 02) Tabla principal de ventas
CREATE TABLE IF NOT EXISTS public.sales (
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

-- 02.1) Índices para optimización
CREATE INDEX IF NOT EXISTS sales_club_idx ON public.sales (club_id);
CREATE INDEX IF NOT EXISTS sales_employee_idx ON public.sales (employee_id);
CREATE INDEX IF NOT EXISTS sales_date_idx ON public.sales (sale_date);
CREATE INDEX IF NOT EXISTS sales_status_idx ON public.sales (status);
CREATE INDEX IF NOT EXISTS sales_payment_method_idx ON public.sales (payment_method);
CREATE INDEX IF NOT EXISTS sales_number_idx ON public.sales (sale_number);

-- Índice compuesto para consultas frecuentes
CREATE INDEX IF NOT EXISTS sales_club_date_idx ON public.sales (club_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS sales_club_employee_idx ON public.sales (club_id, employee_id);

-- 02.2) Trigger de updated_at
DROP TRIGGER IF EXISTS trg_sales_updated_at ON public.sales;
CREATE TRIGGER trg_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 03) Tabla de detalle de ventas (items vendidos)
CREATE TABLE IF NOT EXISTS public.sale_items (
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

-- 03.1) Índices para sale_items
CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product_idx ON public.sale_items (product_id);
CREATE INDEX IF NOT EXISTS sale_items_created_at_idx ON public.sale_items (created_at);

-- 04) Vista de ventas con detalles
CREATE OR REPLACE VIEW public.sales_with_details AS
SELECT
  s.*,
  e.full_name as employee_full_name,
  e.category as employee_category,
  COUNT(si.id) as items_count,
  ARRAY_AGG(
    jsonb_build_object(
      'product_name', si.product_name,
      'quantity', si.quantity,
      'unit_price', si.unit_price,
      'line_total', si.line_total
    ) ORDER BY si.created_at
  ) as items
FROM public.sales s
LEFT JOIN public.employees e ON e.user_id = s.employee_id
LEFT JOIN public.sale_items si ON si.sale_id = s.id
GROUP BY s.id, e.full_name, e.category;

-- 04.1) RLS en la vista
ALTER VIEW public.sales_with_details SET (security_invoker = on);

-- 05) Función para generar número de venta único
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

-- 06) Función para crear venta completa
CREATE OR REPLACE FUNCTION public.fn_create_sale(
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
BEGIN
  -- Verificar que es empleado autorizado (bartender o cashier)
  IF NOT fn_can_edit_stock() THEN
    RAISE EXCEPTION 'Solo bartenders y cajeros pueden crear ventas';
  END IF;

  -- Obtener información del empleado
  SELECT e.club_id, e.full_name
  INTO v_club_id, v_employee_name
  FROM public.employees e
  WHERE e.user_id = auth.uid() AND e.status = 'active';

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Empleado no encontrado o inactivo';
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

-- 07) Función para obtener ventas del día
CREATE OR REPLACE FUNCTION public.fn_get_today_sales()
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

-- 08) Función para obtener estadísticas de ventas
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
  v_payment_methods jsonb;
  v_top_employees jsonb;
  v_hourly_sales jsonb;
BEGIN
  -- Obtener club_id del usuario actual
  v_club_id := COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id());

  -- Estadísticas básicas
  WITH basic_stats AS (
    SELECT
      COUNT(*) as total_sales,
      COALESCE(SUM(total_amount), 0) as total_amount,
      COALESCE(AVG(total_amount), 0) as avg_sale_amount,
      COUNT(DISTINCT employee_name) as employees_count
    FROM public.sales
    WHERE club_id = v_club_id
      AND DATE(sale_date) BETWEEN p_start_date AND p_end_date
      AND status = 'completed'
  ),
  -- Métodos de pago
  payment_stats AS (
    SELECT
      payment_method,
      COUNT(*) as count,
      SUM(total_amount) as amount
    FROM public.sales
    WHERE club_id = v_club_id
      AND DATE(sale_date) BETWEEN p_start_date AND p_end_date
      AND status = 'completed'
    GROUP BY payment_method
  ),
  -- Top empleados
  employee_stats AS (
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
  ),
  -- Ventas por hora
  hourly_stats AS (
    SELECT
      EXTRACT(HOUR FROM sale_date) as hour,
      COUNT(*) as count,
      SUM(total_amount) as amount
    FROM public.sales
    WHERE club_id = v_club_id
      AND DATE(sale_date) BETWEEN p_start_date AND p_end_date
      AND status = 'completed'
    GROUP BY EXTRACT(HOUR FROM sale_date)
    ORDER BY hour
  )

  -- Construir métodos de pago
  SELECT jsonb_object_agg(
    payment_method,
    jsonb_build_object(
      'count', count,
      'amount', amount
    )
  ) INTO v_payment_methods
  FROM payment_stats;

  -- Construir top empleados
  SELECT jsonb_agg(
    jsonb_build_object(
      'employee_name', employee_name,
      'count', count,
      'amount', amount
    )
  ) INTO v_top_employees
  FROM employee_stats;

  -- Construir ventas por hora
  SELECT jsonb_agg(
    jsonb_build_object(
      'hour', hour,
      'count', count,
      'amount', amount
    )
  ) INTO v_hourly_sales
  FROM hourly_stats;

  -- Construir resultado final
  SELECT jsonb_build_object(
    'total_sales', total_sales,
    'total_amount', total_amount,
    'average_sale', avg_sale_amount,
    'employees_count', employees_count,
    'payment_methods', COALESCE(v_payment_methods, '[]'::jsonb),
    'top_employees', COALESCE(v_top_employees, '[]'::jsonb),
    'hourly_sales', COALESCE(v_hourly_sales, '[]'::jsonb)
  ) INTO v_stats
  FROM basic_stats;

  RETURN v_stats;
END;
$$;

-- 09) Habilitar RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- 10) Políticas RLS para sales

-- 10.1) Service role puede todo
CREATE POLICY sales_all_service_role
  ON public.sales
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- 10.2) Admins pueden ver todas las ventas de su club
CREATE POLICY sales_admin_select
  ON public.sales
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

-- 10.3) Empleados pueden ver ventas de su club
CREATE POLICY sales_employee_select
  ON public.sales
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_employee_club_id()
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
        AND e.category IN ('bartender', 'cashier')
    )
  );

-- 10.4) Solo bartenders y cajeros pueden crear ventas
CREATE POLICY sales_employee_insert
  ON public.sales
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id = fn_current_employee_club_id()
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
        AND e.category IN ('bartender', 'cashier')
    )
  );

-- 11) Políticas RLS para sale_items

-- 11.1) Service role puede todo
CREATE POLICY sale_items_all_service_role
  ON public.sale_items
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- 11.2) Los que pueden ver ventas pueden ver items
CREATE POLICY sale_items_select
  ON public.sale_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND (
          s.club_id = fn_current_admin_club_id()
          OR (
            s.club_id = fn_current_employee_club_id()
            AND EXISTS (
              SELECT 1
              FROM public.employees e
              WHERE e.user_id = auth.uid()
                AND e.status = 'active'
                AND e.category IN ('bartender', 'cashier')
            )
          )
        )
    )
  );

-- 11.3) Solo bartenders y cajeros pueden crear items
CREATE POLICY sale_items_insert
  ON public.sale_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sales s
      JOIN public.employees e ON e.user_id = auth.uid()
      WHERE s.id = sale_items.sale_id
        AND s.club_id = e.club_id
        AND e.status = 'active'
        AND e.category IN ('bartender', 'cashier')
    )
  );

-- 12) Trigger para notificaciones en tiempo real
CREATE OR REPLACE FUNCTION public.notify_new_sale()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Notificar nueva venta para actualizaciones en tiempo real
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

-- Crear trigger para notificaciones
DROP TRIGGER IF EXISTS trg_notify_new_sale ON public.sales;
CREATE TRIGGER trg_notify_new_sale
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION notify_new_sale();

-- 13) Comentarios sobre el uso
/*
EJEMPLOS DE USO:

-- Crear venta con múltiples productos
SELECT fn_create_sale(
  '[
    {"product_id": "product-uuid-1", "quantity": 2, "unit_price": 8.00},
    {"product_id": "product-uuid-2", "quantity": 1, "unit_price": 15.50}
  ]'::jsonb,
  'cash',
  NULL,
  0,
  'Venta en efectivo'
);

-- Ver ventas del día
SELECT * FROM fn_get_today_sales();

-- Obtener estadísticas de ventas
SELECT fn_get_sales_stats('2024-03-01', '2024-03-31');

-- Ver ventas con detalles
SELECT * FROM sales_with_details
WHERE club_id = fn_current_admin_club_id()
ORDER BY sale_date DESC;

MÉTODOS DE PAGO:
- cash: Efectivo
- transfer: Transferencia bancaria
- credit: Tarjeta de crédito
- debit: Tarjeta de débito
- mixed: Pago mixto (detalles en payment_details)

TIEMPO REAL:
- Se envían notificaciones PostgreSQL para cada nueva venta
- Canal: 'new_sale_{club_id}'
- Payload: JSON con datos básicos de la venta

PERMISOS:
- ADMINS: Ver todas las ventas de su club
- BARTENDER/CASHIER: Ver ventas del club, crear nuevas ventas
- OTROS EMPLEADOS: Sin acceso a ventas
*/