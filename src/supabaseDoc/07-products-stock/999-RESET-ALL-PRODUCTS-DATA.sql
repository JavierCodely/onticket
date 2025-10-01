-- ===========================================================
-- ⚠️⚠️⚠️ RESET TOTAL DEL SISTEMA DE PRODUCTOS ⚠️⚠️⚠️
-- ===========================================================
-- Este script ELIMINA TODOS LOS DATOS de productos y transacciones
-- de TODOS LOS CLUBS y reconstruye el schema con las nuevas categorías.
--
-- ⚠️⚠️⚠️ MÁXIMA ADVERTENCIA ⚠️⚠️⚠️
-- Este script es EXTREMADAMENTE DESTRUCTIVO
-- ELIMINA DATOS DE TODOS LOS CLUBS
-- NO SE PUEDE DESHACER

-- ========================================
-- PASO 1: ELIMINAR TODOS LOS DATOS
-- ========================================

DO $$
DECLARE
  v_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INICIANDO RESET TOTAL';
  RAISE NOTICE '========================================';

  -- Sesiones de noche
  DELETE FROM public.night_session_products;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Productos de sesiones eliminados: %', v_count;

  DELETE FROM public.night_sessions;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Sesiones de noche eliminadas: %', v_count;

  -- Combos
  DELETE FROM public.combo_usage_log;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Uso de combos eliminado: %', v_count;

  DELETE FROM public.combo_items;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Items de combos eliminados: %', v_count;

  DELETE FROM public.combos;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Combos eliminados: %', v_count;

  -- Promociones
  DELETE FROM public.promotion_items;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Items de promociones eliminados: %', v_count;

  DELETE FROM public.promotions;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Promociones eliminadas: %', v_count;

  -- Ventas
  DELETE FROM public.sale_items;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Items de ventas eliminados: %', v_count;

  DELETE FROM public.sales;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Ventas eliminadas: %', v_count;

  -- Pagos y transacciones
  DELETE FROM public.account_transactions;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Transacciones eliminadas: %', v_count;

  DELETE FROM public.payments;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Pagos eliminados: %', v_count;

  -- Stock y productos
  DELETE FROM public.product_stock;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Stocks eliminados: %', v_count;

  DELETE FROM public.products;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Productos eliminados: %', v_count;

  RAISE NOTICE 'Todos los datos eliminados';
END$$;

-- ========================================
-- PASO 2: ELIMINAR VISTAS
-- ========================================

DROP VIEW IF EXISTS public.night_sessions_with_products CASCADE;
DROP VIEW IF EXISTS public.products_with_stock CASCADE;
DROP VIEW IF EXISTS public.promotions_with_details CASCADE;
DROP VIEW IF EXISTS public.combos_with_details CASCADE;

-- ========================================
-- PASO 3: RECREAR ENUM DE CATEGORÍAS
-- ========================================

ALTER TABLE public.products DROP COLUMN IF EXISTS category CASCADE;
DROP TYPE IF EXISTS product_category CASCADE;

CREATE TYPE product_category AS ENUM (
  'vinos',
  'cervezas',
  'cocteles',
  'vodka',
  'bebidas_alcoholicas',
  'bebidas_sin_alcohol',
  'comida',
  'cigarrillos',
  'merchandising',
  'otros'
);

ALTER TABLE public.products
  ADD COLUMN category product_category NOT NULL DEFAULT 'otros';

ALTER TABLE public.products
  ALTER COLUMN category DROP DEFAULT;

-- ========================================
-- PASO 4: RECREAR VISTAS
-- ========================================

CREATE OR REPLACE VIEW public.products_with_stock AS
SELECT
  p.*,
  COALESCE(ps.current_stock, 0) as current_stock,
  COALESCE(ps.reserved_stock, 0) as reserved_stock,
  COALESCE(ps.available_stock, 0) as available_stock,
  CASE
    WHEN COALESCE(ps.available_stock, 0) <= p.min_stock THEN true
    ELSE false
  END as is_low_stock,
  ps.last_restock_date,
  ps.last_sale_date
FROM public.products p
LEFT JOIN public.product_stock ps ON ps.product_id = p.id;

ALTER VIEW public.products_with_stock SET (security_invoker = on);

CREATE OR REPLACE VIEW public.night_sessions_with_products AS
SELECT
  ns.id as session_id,
  ns.club_id,
  ns.session_date,
  ns.status,
  ns.started_at,
  ns.closed_at,
  ns.started_by,
  ns.closed_by,
  nsp.id as product_entry_id,
  nsp.product_id,
  p.name as product_name,
  p.category as product_category,
  p.unit as product_unit,
  p.sku as product_sku,
  nsp.opening_stock,
  nsp.closing_stock,
  nsp.total_sold
FROM public.night_sessions ns
LEFT JOIN public.night_session_products nsp ON nsp.session_id = ns.id
LEFT JOIN public.products p ON p.id = nsp.product_id
ORDER BY ns.session_date DESC, p.category ASC, p.name ASC;

ALTER VIEW public.night_sessions_with_products SET (security_invoker = on);

-- ========================================
-- PASO 5: RECREAR ÍNDICES
-- ========================================

DROP INDEX IF EXISTS products_category_idx;
CREATE INDEX products_category_idx ON public.products (category);

DROP INDEX IF EXISTS products_club_category_idx;
CREATE INDEX products_club_category_idx ON public.products (club_id, category);

-- ========================================
-- VERIFICACIÓN FINAL
-- ========================================

DO $$
DECLARE
  v_categories integer;
  v_products integer;
  v_clubs integer;
BEGIN
  SELECT COUNT(*) INTO v_categories
  FROM pg_enum
  WHERE enumtypid = 'product_category'::regtype;

  SELECT COUNT(*) INTO v_products
  FROM public.products;

  SELECT COUNT(*) INTO v_clubs
  FROM public.clubs;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESET COMPLETADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Categorías: %', v_categories;
  RAISE NOTICE 'Productos: %', v_products;
  RAISE NOTICE 'Clubs: %', v_clubs;
  RAISE NOTICE '';
  RAISE NOTICE 'Categorías disponibles:';
  RAISE NOTICE '  vinos, cervezas, cocteles, vodka,';
  RAISE NOTICE '  bebidas_alcoholicas, bebidas_sin_alcohol,';
  RAISE NOTICE '  comida, cigarrillos, merchandising, otros';
  RAISE NOTICE '';
END$$;
