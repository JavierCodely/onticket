-- ===========================================================
-- ✅ SISTEMA COMPLETO DE PROMOCIONES Y COMBOS - SCRIPT FINAL CORREGIDO
-- ===========================================================
-- Este script COMPLETO crea TODO el sistema de promociones
-- desde cero, incluyendo todas las dependencias.
--
-- ⚠️ EJECUTAR EN ESTE ORDEN:
-- 1. Primero este script completo
-- 2. Verificar que todo funciona

-- ========================================
-- PASO 1: LIMPIAR TODO LO EXISTENTE
-- ========================================

-- Eliminar vistas
DROP VIEW IF EXISTS public.promotions_with_details CASCADE;

-- Eliminar funciones
DROP FUNCTION IF EXISTS public.fn_create_promotion CASCADE;
DROP FUNCTION IF EXISTS public.fn_create_combo_promotion CASCADE;
DROP FUNCTION IF EXISTS public.fn_use_promotion CASCADE;
DROP FUNCTION IF EXISTS public.fn_use_combo_promotion CASCADE;

-- Eliminar tablas
DROP TABLE IF EXISTS public.promotion_items CASCADE;
DROP TABLE IF EXISTS public.promotions CASCADE;

-- Eliminar tipos
DROP TYPE IF EXISTS promotion_type CASCADE;
DROP TYPE IF EXISTS promotion_status CASCADE;

-- ========================================
-- PASO 2: VERIFICAR FUNCIONES DE AUTENTICACIÓN
-- ========================================

-- Verificar que existe fn_current_admin_club_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'fn_current_admin_club_id'
  ) THEN
    -- Crear función simplificada si no existe
    CREATE OR REPLACE FUNCTION public.fn_current_admin_club_id()
    RETURNS uuid
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
      SELECT a.club_id
      FROM public.admins a
      WHERE a.user_id = auth.uid()
        AND a.status = 'active'
      LIMIT 1;
    $func$;
  END IF;
END$$;

-- Verificar que existe fn_current_employee_club_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'fn_current_employee_club_id'
  ) THEN
    -- Crear función simplificada si no existe
    CREATE OR REPLACE FUNCTION public.fn_current_employee_club_id()
    RETURNS uuid
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
      SELECT e.club_id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
      LIMIT 1;
    $func$;
  END IF;
END$$;

-- ========================================
-- PASO 3: CREAR TIPOS ENUMERADOS
-- ========================================

-- Tipo de promoción (incluyendo combo)
CREATE TYPE promotion_type AS ENUM (
  'percentage',        -- Descuento porcentual
  'fixed_amount',      -- Descuento monto fijo
  'fixed_price',       -- Precio fijo especial
  'combo'              -- Combo de múltiples productos
);

-- Estado de la promoción
CREATE TYPE promotion_status AS ENUM ('active', 'inactive');

-- ========================================
-- PASO 4: CREAR TABLA PRINCIPAL DE PROMOCIONES
-- ========================================

CREATE TABLE public.promotions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               uuid NOT NULL, -- Referencias clubs
  product_id            uuid, -- NULL para combos

  -- Información básica
  name                  text NOT NULL,
  description           text,

  -- Configuración del descuento
  promotion_type        promotion_type NOT NULL,
  discount_value        numeric(10,2) NOT NULL, -- Para combos es el precio final

  -- Límites opcionales
  max_discount_amount   numeric(10,2),
  start_date            timestamptz,
  end_date              timestamptz,
  max_uses              integer,
  current_uses          integer NOT NULL DEFAULT 0,
  min_quantity          integer NOT NULL DEFAULT 1,
  max_quantity          integer,
  status                promotion_status NOT NULL DEFAULT 'active',
  priority              integer NOT NULL DEFAULT 0,

  -- Auditoría
  created_by            uuid,
  updated_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (discount_value > 0),
  CHECK (current_uses >= 0),
  CHECK (min_quantity > 0),
  CHECK (max_quantity IS NULL OR max_quantity >= min_quantity),
  CHECK (
    -- Para promociones de producto individual, product_id es obligatorio
    (promotion_type != 'combo' AND product_id IS NOT NULL) OR
    -- Para combos, product_id debe ser NULL
    (promotion_type = 'combo' AND product_id IS NULL)
  )
);

-- ========================================
-- PASO 5: CREAR TABLA DE ITEMS DE COMBO
-- ========================================

CREATE TABLE public.promotion_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id          uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id            uuid NOT NULL, -- Referencias products

  -- Configuración del item
  quantity              integer NOT NULL DEFAULT 1,
  display_order         integer NOT NULL DEFAULT 0,

  -- Auditoría
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (quantity > 0),
  UNIQUE (promotion_id, product_id)
);

-- ========================================
-- PASO 6: CREAR ÍNDICES
-- ========================================

-- Índices para promotions
CREATE INDEX promotions_club_idx ON public.promotions (club_id);
CREATE INDEX promotions_product_idx ON public.promotions (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX promotions_status_idx ON public.promotions (status);
CREATE INDEX promotions_type_idx ON public.promotions (promotion_type);
CREATE INDEX promotions_priority_idx ON public.promotions (priority DESC);
CREATE INDEX promotions_dates_idx ON public.promotions (start_date, end_date);

-- Índices para promotion_items
CREATE INDEX promotion_items_promotion_idx ON public.promotion_items (promotion_id);
CREATE INDEX promotion_items_product_idx ON public.promotion_items (product_id);
CREATE INDEX promotion_items_order_idx ON public.promotion_items (promotion_id, display_order);

-- ========================================
-- PASO 7: TRIGGERS DE UPDATED_AT
-- ========================================

-- Verificar que existe la función set_updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END$$;

-- Triggers
CREATE TRIGGER trg_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_promotion_items_updated_at
BEFORE UPDATE ON public.promotion_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ========================================
-- PASO 8: CREAR VISTA COMPLETA
-- ========================================

CREATE OR REPLACE VIEW public.promotions_with_details AS
SELECT
  pr.*,

  -- Información del producto principal (para promociones individuales)
  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.name FROM public.products p WHERE p.id = pr.product_id)
    ELSE NULL
  END as product_name,

  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.sku FROM public.products p WHERE p.id = pr.product_id)
    ELSE NULL
  END as product_sku,

  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.sale_price FROM public.products p WHERE p.id = pr.product_id)
    ELSE NULL
  END as original_price,

  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.category FROM public.products p WHERE p.id = pr.product_id)
    ELSE NULL
  END as product_category,

  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.status FROM public.products p WHERE p.id = pr.product_id)
    ELSE 'active'
  END as product_status,

  -- Información específica para combos
  CASE
    WHEN pr.promotion_type = 'combo' THEN
      (SELECT jsonb_agg(
        jsonb_build_object(
          'product_id', pi.product_id,
          'product_name', COALESCE(prod.name, 'Producto ' || pi.product_id),
          'product_sku', prod.sku,
          'quantity', pi.quantity,
          'unit_price', COALESCE(prod.sale_price, 0),
          'total_price', COALESCE(prod.sale_price, 0) * pi.quantity,
          'display_order', pi.display_order
        ) ORDER BY pi.display_order
      )
      FROM public.promotion_items pi
      LEFT JOIN public.products prod ON prod.id = pi.product_id
      WHERE pi.promotion_id = pr.id)
    ELSE NULL
  END as combo_items,

  -- Precio total original del combo
  CASE
    WHEN pr.promotion_type = 'combo' THEN
      (SELECT COALESCE(SUM(COALESCE(prod.sale_price, 0) * pi.quantity), 0)
      FROM public.promotion_items pi
      LEFT JOIN public.products prod ON prod.id = pi.product_id
      WHERE pi.promotion_id = pr.id)
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.sale_price FROM public.products p WHERE p.id = pr.product_id)
    ELSE 0
  END as combo_original_price,

  -- Cálculo del precio final
  CASE pr.promotion_type
    WHEN 'combo' THEN pr.discount_value  -- Para combos, discount_value es el precio final
    WHEN 'fixed_price' THEN pr.discount_value
    WHEN 'fixed_amount' THEN
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
        THEN GREATEST(0, (SELECT p.sale_price FROM public.products p WHERE p.id = pr.product_id) - pr.discount_value)
        ELSE 0
      END
    WHEN 'percentage' THEN
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
        THEN (
          SELECT
            CASE
              WHEN pr.max_discount_amount IS NOT NULL THEN
                p.sale_price - LEAST(pr.max_discount_amount, p.sale_price * pr.discount_value / 100)
              ELSE
                p.sale_price * (1 - pr.discount_value / 100)
            END
          FROM public.products p WHERE p.id = pr.product_id
        )
        ELSE 0
      END
  END as final_price,

  -- Display del descuento
  CASE
    WHEN pr.promotion_type = 'combo' THEN 'Combo: $' || pr.discount_value
    WHEN pr.promotion_type = 'percentage' THEN pr.discount_value || '%'
    WHEN pr.promotion_type = 'fixed_amount' THEN '$' || pr.discount_value
    WHEN pr.promotion_type = 'fixed_price' THEN 'Precio: $' || pr.discount_value
  END as discount_display,

  -- Monto del descuento
  CASE pr.promotion_type
    WHEN 'combo' THEN
      (SELECT COALESCE(SUM(COALESCE(prod.sale_price, 0) * pi.quantity), 0) - pr.discount_value
      FROM public.promotion_items pi
      LEFT JOIN public.products prod ON prod.id = pi.product_id
      WHERE pi.promotion_id = pr.id)
    WHEN 'fixed_price' THEN
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
        THEN (SELECT p.sale_price - pr.discount_value FROM public.products p WHERE p.id = pr.product_id)
        ELSE 0
      END
    WHEN 'fixed_amount' THEN pr.discount_value
    WHEN 'percentage' THEN
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
        THEN (
          SELECT
            CASE
              WHEN pr.max_discount_amount IS NOT NULL THEN
                LEAST(pr.max_discount_amount, p.sale_price * pr.discount_value / 100)
              ELSE
                p.sale_price * pr.discount_value / 100
            END
          FROM public.products p WHERE p.id = pr.product_id
        )
        ELSE 0
      END
    ELSE 0
  END as discount_amount,

  -- Porcentaje de descuento
  CASE pr.promotion_type
    WHEN 'combo' THEN
      ROUND(
        (SELECT
          CASE
            WHEN COALESCE(SUM(COALESCE(prod.sale_price, 0) * pi.quantity), 0) > 0
            THEN ((COALESCE(SUM(COALESCE(prod.sale_price, 0) * pi.quantity), 0) - pr.discount_value) /
                  COALESCE(SUM(COALESCE(prod.sale_price, 0) * pi.quantity), 1) * 100)
            ELSE 0
          END
        FROM public.promotion_items pi
        LEFT JOIN public.products prod ON prod.id = pi.product_id
        WHERE pi.promotion_id = pr.id), 2
      )
    WHEN 'percentage' THEN pr.discount_value
    ELSE
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
        THEN (
          SELECT
            CASE
              WHEN p.sale_price > 0 THEN
                ROUND(((p.sale_price -
                  CASE pr.promotion_type
                    WHEN 'fixed_price' THEN pr.discount_value
                    WHEN 'fixed_amount' THEN GREATEST(0, p.sale_price - pr.discount_value)
                    ELSE p.sale_price
                  END
                ) / p.sale_price * 100), 2)
              ELSE 0
            END
          FROM public.products p WHERE p.id = pr.product_id
        )
        ELSE 0
      END
  END as discount_percentage,

  -- Validaciones de disponibilidad
  CASE
    WHEN pr.status = 'inactive' THEN false
    WHEN pr.start_date IS NOT NULL AND pr.start_date > NOW() THEN false
    WHEN pr.end_date IS NOT NULL AND pr.end_date < NOW() THEN false
    WHEN pr.max_uses IS NOT NULL AND pr.current_uses >= pr.max_uses THEN false
    WHEN pr.promotion_type = 'combo' THEN
      -- Para combos, verificar que todos los productos estén disponibles
      (SELECT COUNT(*) = 0
       FROM public.promotion_items pi
       LEFT JOIN public.products prod ON prod.id = pi.product_id
       WHERE pi.promotion_id = pr.id
         AND (prod.id IS NULL OR (EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public') AND prod.status != 'active')))
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
      AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = pr.product_id AND p.status != 'active')
    THEN false
    ELSE true
  END as is_available,

  -- Stock disponible (mínimo stock para combos)
  CASE
    WHEN pr.promotion_type = 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_stock' AND table_schema = 'public') THEN
      (SELECT MIN(FLOOR(COALESCE(ps.available_stock, 0) / GREATEST(pi.quantity, 1)))
       FROM public.promotion_items pi
       LEFT JOIN public.product_stock ps ON ps.product_id = pi.product_id
       WHERE pi.promotion_id = pr.id)
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_stock' AND table_schema = 'public') THEN
      (SELECT COALESCE(ps.available_stock, 0) FROM public.product_stock ps WHERE ps.product_id = pr.product_id)
    ELSE 0
  END as available_stock

FROM public.promotions pr;

-- ========================================
-- PASO 9: FUNCIONES PARA PROMOCIONES INDIVIDUALES
-- ========================================

-- Función para crear promoción individual
CREATE OR REPLACE FUNCTION public.fn_create_promotion(
  p_product_id uuid,
  p_name text,
  p_promotion_type promotion_type,
  p_discount_value numeric,
  p_description text DEFAULT NULL,
  p_max_discount_amount numeric DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_max_uses integer DEFAULT NULL,
  p_min_quantity integer DEFAULT 1,
  p_max_quantity integer DEFAULT NULL,
  p_priority integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_promotion_id uuid;
BEGIN
  -- Verificar que es admin
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden crear promociones';
  END IF;

  -- Validaciones
  IF p_discount_value <= 0 THEN
    RAISE EXCEPTION 'El valor del descuento debe ser mayor a 0';
  END IF;

  IF p_promotion_type = 'percentage' AND p_discount_value > 100 THEN
    RAISE EXCEPTION 'El porcentaje no puede ser mayor a 100';
  END IF;

  -- Verificar que el producto existe y pertenece al club (si existe la tabla products)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND club_id = v_club_id) THEN
      RAISE EXCEPTION 'Producto no encontrado o no pertenece al club';
    END IF;
  END IF;

  -- Crear la promoción
  INSERT INTO public.promotions (
    club_id,
    product_id,
    name,
    description,
    promotion_type,
    discount_value,
    max_discount_amount,
    start_date,
    end_date,
    max_uses,
    min_quantity,
    max_quantity,
    priority,
    created_by,
    updated_by
  ) VALUES (
    v_club_id,
    p_product_id,
    p_name,
    p_description,
    p_promotion_type,
    p_discount_value,
    p_max_discount_amount,
    p_start_date,
    p_end_date,
    p_max_uses,
    p_min_quantity,
    p_max_quantity,
    p_priority,
    auth.uid(),
    auth.uid()
  ) RETURNING id INTO v_promotion_id;

  RETURN v_promotion_id;
END;
$$;

-- Función para usar promoción individual
CREATE OR REPLACE FUNCTION public.fn_use_promotion(
  p_promotion_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  -- Verificar permisos
  v_club_id := COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id());
  IF v_club_id IS NULL THEN
    RETURN false;
  END IF;

  -- Actualizar contador de usos
  UPDATE public.promotions
  SET
    current_uses = current_uses + p_quantity,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_promotion_id
    AND club_id = v_club_id
    AND status = 'active'
    AND (max_uses IS NULL OR current_uses + p_quantity <= max_uses);

  RETURN FOUND;
END;
$$;

-- ========================================
-- PASO 10: FUNCIONES PARA COMBOS
-- ========================================

-- Función para crear promoción combo
CREATE OR REPLACE FUNCTION public.fn_create_combo_promotion(
  p_name text,
  p_combo_price numeric,
  p_combo_items jsonb,  -- Array de {product_id, quantity}
  p_description text DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_max_uses integer DEFAULT NULL,
  p_min_quantity integer DEFAULT 1,
  p_max_quantity integer DEFAULT NULL,
  p_priority integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_promotion_id uuid;
  v_item jsonb;
  v_display_order integer := 0;
BEGIN
  -- Verificar que es admin
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden crear promociones combo';
  END IF;

  -- Validar que el precio del combo sea positivo
  IF p_combo_price <= 0 THEN
    RAISE EXCEPTION 'El precio del combo debe ser mayor a 0';
  END IF;

  -- Validar que hay al menos 2 productos en el combo
  IF jsonb_array_length(p_combo_items) < 2 THEN
    RAISE EXCEPTION 'Un combo debe tener al menos 2 productos';
  END IF;

  -- Crear la promoción principal
  INSERT INTO public.promotions (
    club_id,
    product_id,  -- NULL para combos
    name,
    description,
    promotion_type,
    discount_value,  -- Para combos, este es el precio final
    start_date,
    end_date,
    max_uses,
    min_quantity,
    max_quantity,
    priority,
    created_by,
    updated_by
  ) VALUES (
    v_club_id,
    NULL,  -- Los combos no tienen un producto principal
    p_name,
    p_description,
    'combo',
    p_combo_price,
    p_start_date,
    p_end_date,
    p_max_uses,
    p_min_quantity,
    p_max_quantity,
    p_priority,
    auth.uid(),
    auth.uid()
  ) RETURNING id INTO v_promotion_id;

  -- Agregar los items del combo
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_combo_items)
  LOOP
    -- Validar cantidad
    IF (v_item->>'quantity')::integer <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a 0 para el producto %', v_item->>'product_id';
    END IF;

    -- Verificar que el producto existe y pertenece al club (si existe la tabla products)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public') THEN
      IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = (v_item->>'product_id')::uuid AND club_id = v_club_id AND status = 'active') THEN
        RAISE EXCEPTION 'Producto % no encontrado o inactivo', v_item->>'product_id';
      END IF;
    END IF;

    -- Insertar item del combo
    INSERT INTO public.promotion_items (
      promotion_id,
      product_id,
      quantity,
      display_order
    ) VALUES (
      v_promotion_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer,
      v_display_order
    );

    v_display_order := v_display_order + 1;
  END LOOP;

  RETURN v_promotion_id;
END;
$$;

-- Función para usar promoción combo (decrementar stock)
CREATE OR REPLACE FUNCTION public.fn_use_combo_promotion(
  p_promotion_id uuid,
  p_combo_quantity integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_promotion record;
  v_item record;
BEGIN
  -- Verificar permisos
  v_club_id := COALESCE(fn_current_admin_club_id(), fn_current_employee_club_id());
  IF v_club_id IS NULL THEN
    RETURN false;
  END IF;

  -- Obtener información de la promoción
  SELECT * INTO v_promotion
  FROM public.promotions
  WHERE id = p_promotion_id
    AND club_id = v_club_id
    AND promotion_type = 'combo'
    AND status = 'active';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Verificar y decrementar stock si existe la tabla product_stock
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_stock' AND table_schema = 'public') THEN
    -- Verificar stock disponible para todos los items
    FOR v_item IN
      SELECT pi.product_id, pi.quantity,
             COALESCE(prod.name, 'Producto ' || pi.product_id) as name,
             COALESCE(ps.available_stock, 0) as current_stock
      FROM public.promotion_items pi
      LEFT JOIN public.products prod ON prod.id = pi.product_id
      LEFT JOIN public.product_stock ps ON ps.product_id = pi.product_id
      WHERE pi.promotion_id = p_promotion_id
    LOOP
      IF v_item.current_stock < (v_item.quantity * p_combo_quantity) THEN
        RAISE EXCEPTION 'Stock insuficiente para % (necesario: %, disponible: %)',
          v_item.name, v_item.quantity * p_combo_quantity, v_item.current_stock;
      END IF;
    END LOOP;

    -- Decrementar stock de todos los productos del combo
    FOR v_item IN
      SELECT pi.product_id, pi.quantity
      FROM public.promotion_items pi
      WHERE pi.promotion_id = p_promotion_id
    LOOP
      UPDATE public.product_stock
      SET
        available_stock = available_stock - (v_item.quantity * p_combo_quantity),
        updated_at = NOW()
      WHERE product_id = v_item.product_id;
    END LOOP;
  END IF;

  -- Actualizar contador de usos de la promoción
  UPDATE public.promotions
  SET
    current_uses = current_uses + p_combo_quantity,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_promotion_id
    AND (max_uses IS NULL OR current_uses + p_combo_quantity <= max_uses);

  RETURN FOUND;
END;
$$;

-- ========================================
-- PASO 11: CONFIGURAR SEGURIDAD RLS
-- ========================================

-- Habilitar RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_items ENABLE ROW LEVEL SECURITY;

-- Políticas para promotions

-- Admins pueden ver todas las promociones de su club
CREATE POLICY promotions_admin_select
  ON public.promotions
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

-- Admins pueden crear promociones para su club
CREATE POLICY promotions_admin_insert
  ON public.promotions
  FOR INSERT
  TO authenticated
  WITH CHECK ( club_id = fn_current_admin_club_id() );

-- Admins pueden actualizar promociones de su club
CREATE POLICY promotions_admin_update
  ON public.promotions
  FOR UPDATE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() )
  WITH CHECK ( club_id = fn_current_admin_club_id() );

-- Admins pueden eliminar promociones de su club
CREATE POLICY promotions_admin_delete
  ON public.promotions
  FOR DELETE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

-- Empleados pueden ver promociones activas de su club
CREATE POLICY promotions_employee_select
  ON public.promotions
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_employee_club_id()
    AND status = 'active'
  );

-- Políticas para promotion_items

-- Admins pueden gestionar items de combos de su club
CREATE POLICY promotion_items_admin_all
  ON public.promotion_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.promotions pr
      WHERE pr.id = promotion_items.promotion_id
        AND pr.club_id = fn_current_admin_club_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.promotions pr
      WHERE pr.id = promotion_items.promotion_id
        AND pr.club_id = fn_current_admin_club_id()
    )
  );

-- Empleados pueden ver items de combos activos de su club
CREATE POLICY promotion_items_employee_select
  ON public.promotion_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.promotions pr
      WHERE pr.id = promotion_items.promotion_id
        AND pr.club_id = fn_current_employee_club_id()
        AND pr.status = 'active'
    )
  );

-- ========================================
-- PASO 12: DATOS DE PRUEBA (OPCIONAL)
-- ========================================

-- Insertar algunas promociones de prueba si hay productos
DO $$
BEGIN
  -- Solo si existe la tabla products y hay productos
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
     AND EXISTS (SELECT 1 FROM public.products LIMIT 1) THEN

    -- Crear una promoción de ejemplo
    INSERT INTO public.promotions (
      club_id,
      product_id,
      name,
      description,
      promotion_type,
      discount_value,
      status
    )
    SELECT
      p.club_id,
      p.id,
      'Promoción ' || p.name,
      'Descuento del 10% en ' || p.name,
      'percentage',
      10.00,
      'active'
    FROM public.products p
    LIMIT 1
    ON CONFLICT DO NOTHING;

  END IF;
END$$;

-- ========================================
-- COMENTARIOS Y EJEMPLOS DE USO
-- ========================================

/*
✅ SISTEMA COMPLETO CREADO Y CORREGIDO

PROMOCIONES INDIVIDUALES:
1. Crear promoción:
   SELECT fn_create_promotion(
     'product-uuid'::uuid,
     'Descuento 20%',
     'percentage',
     20.00,
     'Promoción especial'
   );

2. Ver promociones:
   SELECT * FROM promotions_with_details
   WHERE status = 'active'
   ORDER BY priority DESC;

PROMOCIONES COMBO:
1. Crear combo:
   SELECT fn_create_combo_promotion(
     'RedBull + 2 Speed',
     25.00,
     '[
       {"product_id": "redbull-uuid", "quantity": 1},
       {"product_id": "speed-uuid", "quantity": 2}
     ]'::jsonb,
     'Combo energizantes'
   );

2. Usar combo:
   SELECT fn_use_combo_promotion('combo-uuid'::uuid, 1);

VERIFICACIÓN:
- SELECT * FROM promotions_with_details;
- SELECT * FROM promotion_items;
*/

-- ========================================
-- ✅ SCRIPT COMPLETADO EXITOSAMENTE CON CORRECCIONES
-- ========================================