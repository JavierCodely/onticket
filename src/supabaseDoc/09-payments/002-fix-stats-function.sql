-- ===========================================================
-- FIX: Corregir función de estadísticas de pagos
-- ===========================================================
-- Soluciona el error "aggregate function calls cannot be nested"

-- Reemplazar la función existente con una versión corregida
CREATE OR REPLACE FUNCTION public.fn_get_payments_stats(
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
  v_by_type jsonb;
  v_by_method jsonb;
  v_by_category jsonb;
BEGIN
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden ver estadísticas de pagos';
  END IF;

  -- Obtener estadísticas básicas
  SELECT jsonb_build_object(
    'total_payments', COUNT(*),
    'total_amount', COALESCE(SUM(amount), 0),
    'total_cash', COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0),
    'total_transfer', COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN amount ELSE 0 END), 0),
    'total_other', COALESCE(SUM(CASE WHEN payment_method IN ('check', 'other') THEN amount ELSE 0 END), 0)
  ) INTO v_stats
  FROM public.payments p
  WHERE p.club_id = v_club_id
    AND p.status = 'completed'
    AND DATE(p.payment_date) BETWEEN p_start_date AND p_end_date;

  -- Obtener estadísticas por tipo
  SELECT COALESCE(jsonb_object_agg(payment_type, type_stats), '{}'::jsonb) INTO v_by_type
  FROM (
    SELECT
      payment_type,
      jsonb_build_object(
        'count', COUNT(*),
        'amount', SUM(amount)
      ) as type_stats
    FROM public.payments p
    WHERE p.club_id = v_club_id
      AND p.status = 'completed'
      AND DATE(p.payment_date) BETWEEN p_start_date AND p_end_date
    GROUP BY payment_type
  ) t;

  -- Obtener estadísticas por método
  SELECT COALESCE(jsonb_object_agg(payment_method, method_stats), '{}'::jsonb) INTO v_by_method
  FROM (
    SELECT
      payment_method,
      jsonb_build_object(
        'count', COUNT(*),
        'amount', SUM(amount)
      ) as method_stats
    FROM public.payments p
    WHERE p.club_id = v_club_id
      AND p.status = 'completed'
      AND DATE(p.payment_date) BETWEEN p_start_date AND p_end_date
    GROUP BY payment_method
  ) m;

  -- Obtener estadísticas por categoría
  SELECT COALESCE(jsonb_object_agg(COALESCE(category, 'Sin categoría'), category_stats), '{}'::jsonb) INTO v_by_category
  FROM (
    SELECT
      COALESCE(category, 'Sin categoría') as category,
      jsonb_build_object(
        'count', COUNT(*),
        'amount', SUM(amount)
      ) as category_stats
    FROM public.payments p
    WHERE p.club_id = v_club_id
      AND p.status = 'completed'
      AND DATE(p.payment_date) BETWEEN p_start_date AND p_end_date
    GROUP BY COALESCE(category, 'Sin categoría')
  ) c;

  -- Combinar todas las estadísticas
  v_stats := v_stats || jsonb_build_object(
    'by_type', v_by_type,
    'by_method', v_by_method,
    'by_category', v_by_category
  );

  RETURN v_stats;
END;
$$;

-- Función alternativa más simple si la anterior sigue dando problemas
CREATE OR REPLACE FUNCTION public.fn_get_payments_stats_simple(
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
  v_total_payments integer := 0;
  v_total_amount numeric := 0;
  v_total_cash numeric := 0;
  v_total_transfer numeric := 0;
  v_total_other numeric := 0;
BEGIN
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden ver estadísticas de pagos';
  END IF;

  -- Obtener totales básicos
  SELECT
    COUNT(*),
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_method IN ('check', 'other') THEN amount ELSE 0 END), 0)
  INTO
    v_total_payments,
    v_total_amount,
    v_total_cash,
    v_total_transfer,
    v_total_other
  FROM public.payments p
  WHERE p.club_id = v_club_id
    AND p.status = 'completed'
    AND DATE(p.payment_date) BETWEEN p_start_date AND p_end_date;

  RETURN jsonb_build_object(
    'total_payments', v_total_payments,
    'total_amount', v_total_amount,
    'total_cash', v_total_cash,
    'total_transfer', v_total_transfer,
    'total_other', v_total_other
  );
END;
$$;

-- Comentario de uso:
-- Si fn_get_payments_stats sigue dando problemas, usar fn_get_payments_stats_simple