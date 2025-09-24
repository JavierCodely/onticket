-- ===========================================================
-- SISTEMA DE COMBOS - INDEPENDIENTE DE PROMOCIONES
-- ===========================================================
-- Sistema específico para gestión de combos con control de stock,
-- límites por cliente, máximo de usos y validaciones en ventas.
-- Los combos son productos especiales formados por múltiples productos.

-- ========================================
-- PASO 1: LIMPIAR SISTEMA ANTERIOR SI EXISTE
-- ========================================

-- Eliminar funciones existentes
DROP FUNCTION IF EXISTS public.fn_get_combo_stats(date, date) CASCADE;
DROP FUNCTION IF EXISTS public.fn_validate_combo_stock(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.fn_use_combo(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.fn_create_combo(text, text, numeric, integer, integer, integer, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.fn_update_combo(uuid, text, text, numeric, integer, integer, integer, combo_status) CASCADE;

-- Eliminar vista
DROP VIEW IF EXISTS public.combos_with_details CASCADE;

-- Eliminar tablas
DROP TABLE IF EXISTS public.combo_usage_log CASCADE;
DROP TABLE IF EXISTS public.combo_items CASCADE;
DROP TABLE IF EXISTS public.combos CASCADE;

-- Eliminar tipos ENUM existentes
DROP TYPE IF EXISTS public.combo_status CASCADE;

-- ========================================
-- PASO 2: CREAR TIPOS ENUM
-- ========================================

-- Estados del combo
CREATE TYPE public.combo_status AS ENUM (
  'active',        -- Activo y disponible
  'paused',        -- Pausado temporalmente
  'inactive'       -- Inactivo/eliminado
);

-- ========================================
-- PASO 3: CREAR TABLAS
-- ========================================

-- 3.1) Tabla principal de combos
CREATE TABLE public.combos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Información básica del combo
  name                  text NOT NULL,                               -- Nombre del combo
  description           text,                                        -- Descripción del combo

  -- Precios y stock
  combo_price           numeric(10,2) NOT NULL,                      -- Precio final del combo
  stock_quantity        integer NOT NULL DEFAULT 0,                  -- Stock disponible del combo
  min_stock_alert       integer NOT NULL DEFAULT 5,                  -- Alerta de stock mínimo

  -- Límites de uso
  max_uses              integer,                                     -- Máximo de usos total (opcional)
  current_uses          integer NOT NULL DEFAULT 0,                 -- Usos actuales
  min_combo_per_client  integer NOT NULL DEFAULT 1,                 -- Mínimo de combos por cliente
  max_combo_per_client  integer NOT NULL DEFAULT 1,                 -- Máximo de combos por cliente por compra

  -- Estado y metadatos
  status                combo_status NOT NULL DEFAULT 'active',     -- Estado del combo
  priority              integer NOT NULL DEFAULT 0,                 -- Prioridad para ordenamiento

  -- Auditoría
  created_by            uuid REFERENCES auth.users(id),              -- Quién creó el combo
  updated_by            uuid REFERENCES auth.users(id),              -- Quién actualizó
  created_at            timestamptz NOT NULL DEFAULT NOW(),          -- Cuándo se creó
  updated_at            timestamptz NOT NULL DEFAULT NOW(),          -- Cuándo se actualizó

  -- Constraints
  CHECK (combo_price > 0),                                           -- Precio positivo
  CHECK (stock_quantity >= 0),                                      -- Stock no negativo
  CHECK (min_stock_alert >= 0),                                     -- Alerta no negativa
  CHECK (current_uses >= 0),                                        -- Usos no negativos
  CHECK (min_combo_per_client > 0),                                 -- Mínimo por cliente positivo
  CHECK (max_combo_per_client >= min_combo_per_client),             -- Máximo >= mínimo
  CHECK (max_uses IS NULL OR max_uses > 0),                         -- Máximo usos positivo si existe
  CHECK (max_uses IS NULL OR current_uses <= max_uses)              -- Usos actuales <= máximo
);

-- 3.2) Tabla de items que componen el combo
CREATE TABLE public.combo_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id              uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  product_id            uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,

  -- Configuración del item en el combo
  quantity_per_combo    integer NOT NULL DEFAULT 1,                 -- Cantidad de este producto por combo
  display_order         integer NOT NULL DEFAULT 0,                -- Orden de visualización

  -- Auditoría
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (quantity_per_combo > 0),                                   -- Cantidad positiva
  UNIQUE (combo_id, product_id)                                     -- Un producto por combo (sin repetir)
);

-- 3.3) Tabla de log de usos de combos (para control de límites por cliente)
CREATE TABLE public.combo_usage_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id              uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  sale_id               uuid REFERENCES public.sales(id) ON DELETE SET NULL,  -- Referencia a venta si existe

  -- Información del cliente/venta
  customer_identifier   text,                                       -- Identificador del cliente (opcional)
  employee_id           uuid NOT NULL REFERENCES auth.users(id),    -- Empleado que realizó la venta
  employee_name         text NOT NULL,                              -- Nombre del empleado

  -- Información del uso
  combo_quantity        integer NOT NULL DEFAULT 1,                 -- Cantidad de combos vendidos
  unit_price            numeric(10,2) NOT NULL,                     -- Precio unitario al momento de la venta
  total_price           numeric(10,2) NOT NULL,                     -- Precio total de los combos

  -- Metadatos
  usage_date            timestamptz NOT NULL DEFAULT NOW(),         -- Fecha de uso
  created_at            timestamptz NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (combo_quantity > 0),                                       -- Cantidad positiva
  CHECK (unit_price > 0),                                           -- Precio positivo
  CHECK (total_price = unit_price * combo_quantity)                 -- Consistencia de precios
);

-- ========================================
-- PASO 4: CREAR ÍNDICES OPTIMIZADOS
-- ========================================

-- Índices para tabla combos
CREATE INDEX combos_club_idx ON public.combos (club_id);
CREATE INDEX combos_status_idx ON public.combos (status);
CREATE INDEX combos_created_at_idx ON public.combos (created_at DESC);
CREATE INDEX combos_priority_idx ON public.combos (priority DESC);
CREATE INDEX combos_stock_idx ON public.combos (stock_quantity);

-- Índices para combo_items
CREATE INDEX combo_items_combo_idx ON public.combo_items (combo_id);
CREATE INDEX combo_items_product_idx ON public.combo_items (product_id);
CREATE INDEX combo_items_order_idx ON public.combo_items (combo_id, display_order);

-- Índices para combo_usage_log
CREATE INDEX combo_usage_combo_idx ON public.combo_usage_log (combo_id);
CREATE INDEX combo_usage_sale_idx ON public.combo_usage_log (sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX combo_usage_customer_idx ON public.combo_usage_log (customer_identifier) WHERE customer_identifier IS NOT NULL;
CREATE INDEX combo_usage_date_idx ON public.combo_usage_log (usage_date DESC);
CREATE INDEX combo_usage_employee_idx ON public.combo_usage_log (employee_id);

-- ========================================
-- PASO 5: CREAR TRIGGERS
-- ========================================

-- Trigger para updated_at en combos
CREATE TRIGGER trg_combos_updated_at
BEFORE UPDATE ON public.combos
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Trigger para updated_at en combo_items
CREATE TRIGGER trg_combo_items_updated_at
BEFORE UPDATE ON public.combo_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ========================================
-- PASO 6: CREAR VISTA COMPLETA
-- ========================================

CREATE OR REPLACE VIEW public.combos_with_details AS
SELECT
  c.*,

  -- Información de items del combo
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', ci.product_id,
        'product_name', COALESCE(p.name, 'Producto ' || ci.product_id),
        'product_sku', p.sku,
        'product_category', p.category,
        'quantity_per_combo', ci.quantity_per_combo,
        'unit_price', COALESCE(p.sale_price, 0),
        'total_price_per_combo', COALESCE(p.sale_price, 0) * ci.quantity_per_combo,
        'available_stock', COALESCE(ps.available_stock, 0),
        'display_order', ci.display_order
      ) ORDER BY ci.display_order
    ) FILTER (WHERE ci.id IS NOT NULL),
    '[]'::jsonb
  ) as combo_items,

  -- Cálculos de precios
  COALESCE(SUM(COALESCE(p.sale_price, 0) * ci.quantity_per_combo), 0) as original_total_price,
  c.combo_price as final_price,
  COALESCE(SUM(COALESCE(p.sale_price, 0) * ci.quantity_per_combo), 0) - c.combo_price as savings_amount,

  -- Porcentaje de ahorro
  CASE
    WHEN COALESCE(SUM(COALESCE(p.sale_price, 0) * ci.quantity_per_combo), 0) > 0 THEN
      ROUND(
        ((COALESCE(SUM(COALESCE(p.sale_price, 0) * ci.quantity_per_combo), 0) - c.combo_price) /
         COALESCE(SUM(COALESCE(p.sale_price, 0) * ci.quantity_per_combo), 1) * 100), 2
      )
    ELSE 0
  END as savings_percentage,

  -- Stock disponible (mínimo stock de todos los productos del mismo club)
  CASE
    WHEN COUNT(ci.id) > 0 THEN
      LEAST(c.stock_quantity,
        COALESCE(MIN(FLOOR(COALESCE(ps.available_stock, 0) / GREATEST(ci.quantity_per_combo, 1))), 0)
      )
    ELSE c.stock_quantity
  END as effective_stock,

  -- Validaciones de disponibilidad
  CASE
    WHEN c.status != 'active' THEN false
    WHEN c.stock_quantity <= 0 THEN false
    WHEN c.max_uses IS NOT NULL AND c.current_uses >= c.max_uses THEN false
    -- Verificar que todos los productos del club están disponibles
    WHEN EXISTS (
      SELECT 1
      FROM public.combo_items ci_check
      LEFT JOIN public.products p_check ON p_check.id = ci_check.product_id AND p_check.club_id = c.club_id
      LEFT JOIN public.product_stock ps_check ON ps_check.product_id = ci_check.product_id AND ps_check.club_id = c.club_id
      WHERE ci_check.combo_id = c.id
        AND (p_check.id IS NULL OR p_check.status != 'active' OR COALESCE(ps_check.available_stock, 0) < ci_check.quantity_per_combo)
    ) THEN false
    ELSE true
  END as is_available,

  -- Alerta de stock bajo
  c.stock_quantity <= c.min_stock_alert as is_low_stock,

  -- Contador de productos en el combo
  COUNT(ci.id) as items_count,

  -- Información del creador
  COALESCE(a.full_name, e.full_name, 'Sistema') as created_by_name,
  COALESCE(au.full_name, eu.full_name, 'Sistema') as updated_by_name

FROM public.combos c
LEFT JOIN public.combo_items ci ON ci.combo_id = c.id
LEFT JOIN public.products p ON p.id = ci.product_id AND p.club_id = c.club_id
LEFT JOIN public.product_stock ps ON ps.product_id = ci.product_id AND ps.club_id = c.club_id
LEFT JOIN public.admins a ON a.user_id = c.created_by AND a.club_id = c.club_id
LEFT JOIN public.employees e ON e.user_id = c.created_by AND e.club_id = c.club_id
LEFT JOIN public.admins au ON au.user_id = c.updated_by AND au.club_id = c.club_id
LEFT JOIN public.employees eu ON eu.user_id = c.updated_by AND eu.club_id = c.club_id
GROUP BY
  c.id, c.club_id, c.name, c.description, c.combo_price, c.stock_quantity,
  c.min_stock_alert, c.max_uses, c.current_uses, c.min_combo_per_client,
  c.max_combo_per_client, c.status, c.priority, c.created_by, c.updated_by,
  c.created_at, c.updated_at, a.full_name, e.full_name, au.full_name, eu.full_name;

-- ========================================
-- PASO 7: FUNCIONES DE NEGOCIO
-- ========================================

-- 7.1) Función para crear combo
CREATE OR REPLACE FUNCTION public.fn_create_combo(
  p_name text,
  p_combo_price numeric,
  p_combo_items jsonb,  -- Array de {product_id, quantity_per_combo}
  p_description text DEFAULT NULL,
  p_stock_quantity integer DEFAULT 0,
  p_min_combo_per_client integer DEFAULT 1,
  p_max_combo_per_client integer DEFAULT 1,
  p_max_uses integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combo_id uuid;
  v_club_id uuid;
  v_item jsonb;
  v_display_order integer := 0;
BEGIN
  -- Verificar que es admin
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden crear combos';
  END IF;

  -- Validaciones básicas
  IF p_combo_price <= 0 THEN
    RAISE EXCEPTION 'El precio del combo debe ser mayor a 0';
  END IF;

  IF p_min_combo_per_client <= 0 THEN
    RAISE EXCEPTION 'El mínimo por cliente debe ser mayor a 0';
  END IF;

  IF p_max_combo_per_client < p_min_combo_per_client THEN
    RAISE EXCEPTION 'El máximo por cliente debe ser mayor o igual al mínimo';
  END IF;

  -- Validar que hay al menos 2 productos en el combo
  IF jsonb_array_length(p_combo_items) < 2 THEN
    RAISE EXCEPTION 'Un combo debe tener al menos 2 productos';
  END IF;

  -- Crear el combo principal
  INSERT INTO public.combos (
    club_id,
    name,
    description,
    combo_price,
    stock_quantity,
    min_combo_per_client,
    max_combo_per_client,
    max_uses,
    created_by,
    updated_by
  ) VALUES (
    v_club_id,
    p_name,
    p_description,
    p_combo_price,
    p_stock_quantity,
    p_min_combo_per_client,
    p_max_combo_per_client,
    p_max_uses,
    auth.uid(),
    auth.uid()
  ) RETURNING id INTO v_combo_id;

  -- Agregar los items del combo
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_combo_items)
  LOOP
    -- Validar cantidad
    IF (v_item->>'quantity_per_combo')::integer <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a 0 para el producto %', v_item->>'product_id';
    END IF;

    -- Verificar que el producto existe y pertenece al club
    IF NOT EXISTS (
      SELECT 1 FROM public.products
      WHERE id = (v_item->>'product_id')::uuid
        AND club_id = v_club_id
        AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Producto % no encontrado o inactivo', v_item->>'product_id';
    END IF;

    -- Insertar item del combo
    INSERT INTO public.combo_items (
      combo_id,
      product_id,
      quantity_per_combo,
      display_order
    ) VALUES (
      v_combo_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity_per_combo')::integer,
      v_display_order
    );

    v_display_order := v_display_order + 1;
  END LOOP;

  RETURN v_combo_id;
END;
$$;

-- 7.2) Función para actualizar combo
CREATE OR REPLACE FUNCTION public.fn_update_combo(
  p_combo_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_combo_price numeric DEFAULT NULL,
  p_stock_quantity integer DEFAULT NULL,
  p_min_combo_per_client integer DEFAULT NULL,
  p_max_combo_per_client integer DEFAULT NULL,
  p_max_uses integer DEFAULT NULL,
  p_status combo_status DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_combo record;
BEGIN
  -- Verificar que es admin
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden actualizar combos';
  END IF;

  -- Obtener combo actual
  SELECT * INTO v_combo
  FROM public.combos
  WHERE id = p_combo_id AND club_id = v_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Combo no encontrado';
  END IF;

  -- Validaciones
  IF p_combo_price IS NOT NULL AND p_combo_price <= 0 THEN
    RAISE EXCEPTION 'El precio del combo debe ser mayor a 0';
  END IF;

  IF p_min_combo_per_client IS NOT NULL AND p_min_combo_per_client <= 0 THEN
    RAISE EXCEPTION 'El mínimo por cliente debe ser mayor a 0';
  END IF;

  IF p_max_combo_per_client IS NOT NULL AND p_min_combo_per_client IS NOT NULL AND p_max_combo_per_client < p_min_combo_per_client THEN
    RAISE EXCEPTION 'El máximo por cliente debe ser mayor o igual al mínimo';
  END IF;

  IF p_max_combo_per_client IS NOT NULL AND p_min_combo_per_client IS NULL AND p_max_combo_per_client < v_combo.min_combo_per_client THEN
    RAISE EXCEPTION 'El máximo por cliente debe ser mayor o igual al mínimo actual';
  END IF;

  -- Actualizar combo
  UPDATE public.combos
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    combo_price = COALESCE(p_combo_price, combo_price),
    stock_quantity = COALESCE(p_stock_quantity, stock_quantity),
    min_combo_per_client = COALESCE(p_min_combo_per_client, min_combo_per_client),
    max_combo_per_client = COALESCE(p_max_combo_per_client, max_combo_per_client),
    max_uses = CASE
      WHEN p_max_uses = -1 THEN NULL  -- -1 significa sin límite
      ELSE COALESCE(p_max_uses, max_uses)
    END,
    status = COALESCE(p_status, status),
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_combo_id;

  RETURN TRUE;
END;
$$;

-- 7.3) Función para validar stock del combo antes de venta
CREATE OR REPLACE FUNCTION public.fn_validate_combo_stock(
  p_combo_id uuid,
  p_combo_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_combo record;
  v_item record;
  v_validation_result jsonb := '{"valid": true, "errors": []}'::jsonb;
  v_errors text[] := '{}';
BEGIN
  -- Verificar permisos (admin o empleado)
  v_club_id := COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id());
  IF v_club_id IS NULL THEN
    RETURN '{"valid": false, "errors": ["Sin permisos para validar combos"]}'::jsonb;
  END IF;

  -- Obtener combo
  SELECT * INTO v_combo
  FROM public.combos
  WHERE id = p_combo_id AND club_id = v_club_id;

  IF NOT FOUND THEN
    RETURN '{"valid": false, "errors": ["Combo no encontrado"]}'::jsonb;
  END IF;

  -- Validar estado del combo
  IF v_combo.status != 'active' THEN
    v_errors := array_append(v_errors, 'El combo no está activo');
  END IF;

  -- Validar stock del combo
  IF v_combo.stock_quantity < p_combo_quantity THEN
    v_errors := array_append(v_errors, 'Stock insuficiente del combo (disponible: ' || v_combo.stock_quantity || ', solicitado: ' || p_combo_quantity || ')');
  END IF;

  -- Validar límite de usos
  IF v_combo.max_uses IS NOT NULL AND (v_combo.current_uses + p_combo_quantity) > v_combo.max_uses THEN
    v_errors := array_append(v_errors, 'Límite de usos excedido');
  END IF;

  -- Validar stock de productos individuales (solo del mismo club)
  FOR v_item IN
    SELECT ci.*, p.name, ps.available_stock, p.club_id as product_club_id
    FROM public.combo_items ci
    LEFT JOIN public.products p ON p.id = ci.product_id AND p.club_id = v_club_id
    LEFT JOIN public.product_stock ps ON ps.product_id = ci.product_id AND ps.club_id = v_club_id
    WHERE ci.combo_id = p_combo_id
  LOOP
    IF v_item.available_stock IS NULL OR v_item.available_stock < (v_item.quantity_per_combo * p_combo_quantity) THEN
      v_errors := array_append(v_errors,
        'Stock insuficiente de ' || COALESCE(v_item.name, 'producto') ||
        ' (necesario: ' || (v_item.quantity_per_combo * p_combo_quantity) ||
        ', disponible: ' || COALESCE(v_item.available_stock, 0) || ')');
    END IF;
  END LOOP;

  -- Construir resultado
  IF array_length(v_errors, 1) > 0 THEN
    v_validation_result := jsonb_build_object(
      'valid', false,
      'errors', to_jsonb(v_errors)
    );
  END IF;

  RETURN v_validation_result;
END;
$$;

-- 7.4) Función para usar combo (decrementar stock y registrar uso)
CREATE OR REPLACE FUNCTION public.fn_use_combo(
  p_combo_id uuid,
  p_combo_quantity integer DEFAULT 1,
  p_sale_id uuid DEFAULT NULL,
  p_customer_identifier text DEFAULT NULL,
  p_employee_name text DEFAULT 'Sistema'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_combo record;
  v_item record;
  v_validation_result jsonb;
BEGIN
  -- Verificar permisos
  v_club_id := COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id());
  IF v_club_id IS NULL THEN
    RETURN false;
  END IF;

  -- Validar stock antes de proceder
  v_validation_result := fn_validate_combo_stock(p_combo_id, p_combo_quantity);
  IF NOT (v_validation_result->>'valid')::boolean THEN
    RAISE EXCEPTION 'Validación fallida: %', v_validation_result->>'errors';
  END IF;

  -- Obtener combo
  SELECT * INTO v_combo
  FROM public.combos
  WHERE id = p_combo_id AND club_id = v_club_id;

  -- Decrementar stock del combo
  UPDATE public.combos
  SET
    stock_quantity = stock_quantity - p_combo_quantity,
    current_uses = current_uses + p_combo_quantity,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_combo_id;

  -- Decrementar stock de productos individuales (solo del mismo club)
  FOR v_item IN
    SELECT ci.*, p.name, p.club_id as product_club_id
    FROM public.combo_items ci
    LEFT JOIN public.products p ON p.id = ci.product_id AND p.club_id = v_club_id
    WHERE ci.combo_id = p_combo_id
  LOOP
    -- Actualizar stock del producto individual usando la función existente
    PERFORM fn_update_product_stock(
      v_item.product_id,
      v_item.quantity_per_combo * p_combo_quantity
    );
  END LOOP;

  -- Registrar uso en log
  INSERT INTO public.combo_usage_log (
    combo_id,
    sale_id,
    customer_identifier,
    employee_id,
    employee_name,
    combo_quantity,
    unit_price,
    total_price
  ) VALUES (
    p_combo_id,
    p_sale_id,
    p_customer_identifier,
    auth.uid(),
    p_employee_name,
    p_combo_quantity,
    v_combo.combo_price,
    v_combo.combo_price * p_combo_quantity
  );

  RETURN true;
END;
$$;

-- 7.5) Función para obtener estadísticas de combos
CREATE OR REPLACE FUNCTION public.fn_get_combo_stats(
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
    'total_combos', (SELECT COUNT(*) FROM public.combos WHERE club_id = v_club_id),
    'active_combos', (SELECT COUNT(*) FROM public.combos WHERE club_id = v_club_id AND status = 'active'),
    'paused_combos', (SELECT COUNT(*) FROM public.combos WHERE club_id = v_club_id AND status = 'paused'),
    'low_stock_combos', (SELECT COUNT(*) FROM public.combos WHERE club_id = v_club_id AND stock_quantity <= min_stock_alert),
    'period_stats', jsonb_build_object(
      'total_sales', COALESCE(SUM(cul.combo_quantity), 0),
      'total_revenue', COALESCE(SUM(cul.total_price), 0),
      'avg_combo_price', COALESCE(AVG(cul.unit_price), 0),
      'top_combos', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'combo_name', c.name,
            'sales_count', combo_sales.total_sales,
            'revenue', combo_sales.total_revenue
          ) ORDER BY combo_sales.total_sales DESC
        )
        FROM (
          SELECT
            cul_inner.combo_id,
            SUM(cul_inner.combo_quantity) as total_sales,
            SUM(cul_inner.total_price) as total_revenue
          FROM public.combo_usage_log cul_inner
          JOIN public.combos c_inner ON c_inner.id = cul_inner.combo_id
          WHERE c_inner.club_id = v_club_id
            AND DATE(cul_inner.usage_date) BETWEEN p_start_date AND p_end_date
          GROUP BY cul_inner.combo_id
          ORDER BY total_sales DESC
          LIMIT 5
        ) combo_sales
        JOIN public.combos c ON c.id = combo_sales.combo_id
      )
    )
  ) INTO v_stats
  FROM public.combo_usage_log cul
  JOIN public.combos c ON c.id = cul.combo_id
  WHERE c.club_id = v_club_id
    AND DATE(cul.usage_date) BETWEEN p_start_date AND p_end_date;

  RETURN v_stats;
END;
$$;

-- ========================================
-- PASO 8: CONFIGURAR SEGURIDAD RLS
-- ========================================

-- Habilitar RLS
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_usage_log ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS para la vista (importante para evitar cross-club data leak)
ALTER VIEW public.combos_with_details SET (security_invoker = true);

-- 8.1) Políticas para service_role
CREATE POLICY combos_all_service_role
  ON public.combos
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

CREATE POLICY combo_items_all_service_role
  ON public.combo_items
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

CREATE POLICY combo_usage_log_all_service_role
  ON public.combo_usage_log
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- 8.2) Políticas para admins
CREATE POLICY combos_admin_select
  ON public.combos
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

CREATE POLICY combos_admin_insert
  ON public.combos
  FOR INSERT
  TO authenticated
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY combos_admin_update
  ON public.combos
  FOR UPDATE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() )
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY combos_admin_delete
  ON public.combos
  FOR DELETE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

-- 8.3) Políticas para empleados (solo lectura)
CREATE POLICY combos_employee_select
  ON public.combos
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

-- 8.4) Políticas para combo_items
CREATE POLICY combo_items_admin_all
  ON public.combo_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.combos c
      WHERE c.id = combo_items.combo_id
        AND c.club_id = fn_current_admin_club_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.combos c
      WHERE c.id = combo_items.combo_id
        AND c.club_id = fn_current_admin_club_id()
    )
  );

CREATE POLICY combo_items_employee_select
  ON public.combo_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.combos c
      WHERE c.id = combo_items.combo_id
        AND c.club_id = fn_current_employee_club_id()
        AND EXISTS (
          SELECT 1
          FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.status = 'active'
            AND e.category IN ('bartender', 'cashier')
        )
    )
  );

-- 8.5) Políticas para combo_usage_log
CREATE POLICY combo_usage_log_admin_select
  ON public.combo_usage_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.combos c
      WHERE c.id = combo_usage_log.combo_id
        AND c.club_id = fn_current_admin_club_id()
    )
  );

CREATE POLICY combo_usage_log_system_insert
  ON public.combo_usage_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.combos c
      WHERE c.id = combo_usage_log.combo_id
        AND (c.club_id = fn_current_admin_club_id() OR c.club_id = fn_current_employee_club_id())
    )
  );

-- ========================================
-- COMENTARIOS Y EJEMPLOS DE USO
-- ========================================

/*
✅ SISTEMA COMPLETO DE COMBOS CREADO

CARACTERÍSTICAS:
- ✅ Combos independientes de promociones
- ✅ Control de stock propio del combo
- ✅ Límites mínimo y máximo por cliente
- ✅ Máximo de usos del combo
- ✅ Validación de stock de productos individuales
- ✅ Descuento automático de stock en ventas
- ✅ Log completo de usos
- ✅ Estados (activo, pausado, inactivo)
- ✅ Filtrado por fecha de creación
- ✅ Estadísticas completas

EJEMPLOS DE USO:

1. CREAR COMBO:
SELECT fn_create_combo(
  'Combo Energizante',
  'RedBull + 2 Speed para la noche',
  25.00,
  50,  -- stock inicial
  1,   -- mínimo por cliente
  2,   -- máximo por cliente
  100, -- máximo 100 usos
  '[
    {"product_id": "redbull-uuid", "quantity_per_combo": 1},
    {"product_id": "speed-uuid", "quantity_per_combo": 2}
  ]'::jsonb
);

2. VALIDAR STOCK ANTES DE VENTA:
SELECT fn_validate_combo_stock('combo-uuid'::uuid, 2);

3. USAR COMBO EN VENTA:
SELECT fn_use_combo(
  'combo-uuid'::uuid,
  1,
  'sale-uuid'::uuid,
  'cliente-123',
  'Juan Pérez'
);

4. VER COMBOS CON DETALLES:
SELECT * FROM combos_with_details
WHERE status = 'active'
ORDER BY created_at DESC;

5. ESTADÍSTICAS:
SELECT fn_get_combo_stats(CURRENT_DATE - 7, CURRENT_DATE);

6. PAUSAR COMBO:
SELECT fn_update_combo('combo-uuid'::uuid, p_status => 'paused');
*/