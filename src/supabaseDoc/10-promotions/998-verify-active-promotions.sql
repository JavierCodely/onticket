-- ===========================================================
-- VERIFICAR PROMOCIONES ACTIVAS
-- ===========================================================

-- 1. Ver todas las promociones
SELECT
  '1. TODAS LAS PROMOCIONES' as seccion,
  id,
  name,
  product_id,
  promotion_type,
  status,
  start_date,
  end_date,
  max_uses,
  current_uses,
  created_at
FROM public.promotions
ORDER BY created_at DESC;

-- 2. Ver productos asociados a promociones
SELECT
  '2. PRODUCTOS CON PROMOCIONES' as seccion,
  pr.id as promotion_id,
  pr.name as promotion_name,
  pr.status as promotion_status,
  p.id as product_id,
  p.name as product_name,
  p.status as product_status
FROM public.promotions pr
JOIN public.products p ON p.id = pr.product_id
ORDER BY pr.created_at DESC;

-- 3. Verificar vista promotions_with_details
SELECT
  '3. VISTA promotions_with_details' as seccion,
  *
FROM public.promotions_with_details
LIMIT 5;

-- 4. Verificar promociones activas (mismo query que usa la app)
SELECT
  '4. PROMOCIONES ACTIVAS (query de la app)' as seccion,
  *
FROM public.promotions_with_details
WHERE status = 'active'
  AND is_available = true
ORDER BY priority DESC, final_price ASC;

-- 5. Contar promociones por estado
SELECT
  '5. CONTEO POR ESTADO' as seccion,
  status,
  COUNT(*) as cantidad
FROM public.promotions
GROUP BY status;

-- 6. Verificar disponibilidad de promociones
SELECT
  '6. VERIFICAR is_available' as seccion,
  id,
  name,
  status,
  start_date,
  end_date,
  max_uses,
  current_uses,
  CASE
    WHEN status = 'inactive' THEN 'inactive status'
    WHEN start_date IS NOT NULL AND start_date > NOW() THEN 'not started yet'
    WHEN end_date IS NOT NULL AND end_date < NOW() THEN 'expired'
    WHEN max_uses IS NOT NULL AND current_uses >= max_uses THEN 'max uses reached'
    ELSE 'available'
  END as availability_reason
FROM public.promotions
ORDER BY created_at DESC;

-- 7. Verificar si la vista existe
SELECT
  '7. VERIFICAR VISTA' as seccion,
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname = 'promotions_with_details';

-- RESUMEN
DO $$
DECLARE
  v_total_promotions integer;
  v_active_promotions integer;
  v_available_promotions integer;
  v_view_exists boolean;
BEGIN
  -- Contar promociones
  SELECT COUNT(*) INTO v_total_promotions FROM public.promotions;
  SELECT COUNT(*) INTO v_active_promotions FROM public.promotions WHERE status = 'active';

  -- Verificar vista
  SELECT EXISTS (
    SELECT 1 FROM pg_views WHERE viewname = 'promotions_with_details'
  ) INTO v_view_exists;

  -- Si la vista existe, contar disponibles
  IF v_view_exists THEN
    SELECT COUNT(*) INTO v_available_promotions
    FROM public.promotions_with_details
    WHERE status = 'active' AND is_available = true;
  ELSE
    v_available_promotions := 0;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════╗';
  RAISE NOTICE '║     RESUMEN DE PROMOCIONES                 ║';
  RAISE NOTICE '╠════════════════════════════════════════════╣';
  RAISE NOTICE '║ Total promociones: %                      ║', LPAD(v_total_promotions::text, 5);
  RAISE NOTICE '║ Promociones activas: %                    ║', LPAD(v_active_promotions::text, 5);
  RAISE NOTICE '║ Promociones disponibles: %                ║', LPAD(v_available_promotions::text, 5);
  RAISE NOTICE '║ Vista existe: %                           ║', CASE WHEN v_view_exists THEN 'SÍ' ELSE 'NO' END;
  RAISE NOTICE '╚════════════════════════════════════════════╝';
  RAISE NOTICE '';

  IF v_total_promotions = 0 THEN
    RAISE NOTICE '❌ NO HAY PROMOCIONES CREADAS';
    RAISE NOTICE '   Solución: Crear al menos una promoción';
  ELSIF v_active_promotions = 0 THEN
    RAISE NOTICE '❌ NO HAY PROMOCIONES ACTIVAS';
    RAISE NOTICE '   Solución: Activar una promoción existente';
  ELSIF v_available_promotions = 0 THEN
    RAISE NOTICE '⚠️  HAY PROMOCIONES ACTIVAS PERO NO DISPONIBLES';
    RAISE NOTICE '   Revisar fechas, usos máximos, etc.';
  ELSIF NOT v_view_exists THEN
    RAISE NOTICE '❌ LA VISTA promotions_with_details NO EXISTE';
    RAISE NOTICE '   Solución: Ejecutar script de creación de vista';
  ELSE
    RAISE NOTICE '✅ TODO CORRECTO - Hay % promociones disponibles', v_available_promotions;
  END IF;

END$$;
