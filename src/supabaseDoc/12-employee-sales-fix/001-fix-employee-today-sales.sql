-- ===========================================================
-- 🔧 FIX: PROBLEMA CON VENTAS DEL DÍA PARA EMPLEADOS
-- ===========================================================
-- PROBLEMA: fn_get_employee_today_sales no carga ventas del día actual
-- CAUSA: Función actualizada ya no filtra por club_id, problemas de timezone
-- SOLUCIÓN: Recrear función con filtros explícitos y timezone correcto

-- ========================================
-- PASO 1: FUNCIÓN CORREGIDA PARA VENTAS DEL DÍA
-- ========================================

-- Función corregida que funciona para empleados
CREATE OR REPLACE FUNCTION public.fn_get_employee_today_sales()
RETURNS SETOF public.sales_with_details
LANGUAGE sql
SECURITY DEFINER  -- Necesario para acceder a datos
SET search_path = public
AS $$
  SELECT *
  FROM public.sales_with_details
  WHERE club_id = fn_current_employee_club_id()
    AND sale_date::date = CURRENT_DATE
    AND club_id IS NOT NULL  -- Asegurar que tenemos club_id válido
  ORDER BY sale_date DESC;
$$;

-- ========================================
-- PASO 2: FUNCIÓN ALTERNATIVA USANDO TIMEZONE LOCAL
-- ========================================

-- Función alternativa que maneja mejor la zona horaria
CREATE OR REPLACE FUNCTION public.fn_get_employee_today_sales_local()
RETURNS SETOF public.sales_with_details
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_today_start timestamptz;
  v_today_end timestamptz;
BEGIN
  -- Obtener club del empleado actual
  v_club_id := fn_current_employee_club_id();

  IF v_club_id IS NULL THEN
    -- Si no es empleado, no devolver nada
    RETURN;
  END IF;

  -- Calcular el inicio y fin del día actual en timezone local
  v_today_start := CURRENT_DATE::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires';
  v_today_end := (CURRENT_DATE + INTERVAL '1 day')::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires';

  RETURN QUERY
  SELECT *
  FROM public.sales_with_details
  WHERE club_id = v_club_id
    AND sale_date >= v_today_start
    AND sale_date < v_today_end
  ORDER BY sale_date DESC;
END;
$$;

-- ========================================
-- PASO 3: FUNCIÓN DE DEBUG PARA DIAGNÓSTICO
-- ========================================

-- Función para diagnosticar problemas con ventas del día
CREATE OR REPLACE FUNCTION public.fn_debug_employee_today_sales()
RETURNS TABLE (
  info_type text,
  info_value text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_club_id uuid;
  v_today_sales_count integer;
  v_total_sales_count integer;
  v_current_date_pg date;
  v_current_timestamp_pg timestamptz;
BEGIN
  v_user_id := auth.uid();

  -- Info básica
  RETURN QUERY SELECT 'user_id'::text, COALESCE(v_user_id::text, 'NULL')::text, 'Usuario actual autenticado'::text;

  -- Club del empleado
  v_club_id := fn_current_employee_club_id();
  RETURN QUERY SELECT 'employee_club_id'::text, COALESCE(v_club_id::text, 'NULL')::text,
    CASE WHEN v_club_id IS NULL THEN 'ERROR: Usuario no es empleado activo' ELSE 'OK: Empleado encontrado' END::text;

  IF v_club_id IS NULL THEN
    RETURN;
  END IF;

  -- Fechas del sistema
  v_current_date_pg := CURRENT_DATE;
  v_current_timestamp_pg := NOW();
  RETURN QUERY SELECT 'current_date'::text, v_current_date_pg::text, 'Fecha actual según PostgreSQL'::text;
  RETURN QUERY SELECT 'current_timestamp'::text, v_current_timestamp_pg::text, 'Timestamp actual según PostgreSQL'::text;

  -- Contar ventas de hoy usando DATE()
  SELECT COUNT(*) INTO v_today_sales_count
  FROM public.sales_with_details
  WHERE club_id = v_club_id AND DATE(sale_date) = CURRENT_DATE;

  RETURN QUERY SELECT 'today_sales_date_function'::text, v_today_sales_count::text,
    'Ventas de hoy usando DATE(sale_date) = CURRENT_DATE'::text;

  -- Contar ventas de hoy usando cast a date
  SELECT COUNT(*) INTO v_today_sales_count
  FROM public.sales_with_details
  WHERE club_id = v_club_id AND sale_date::date = CURRENT_DATE;

  RETURN QUERY SELECT 'today_sales_cast_date'::text, v_today_sales_count::text,
    'Ventas de hoy usando sale_date::date = CURRENT_DATE'::text;

  -- Total de ventas del club
  SELECT COUNT(*) INTO v_total_sales_count
  FROM public.sales_with_details
  WHERE club_id = v_club_id;

  RETURN QUERY SELECT 'total_club_sales'::text, v_total_sales_count::text,
    'Total de ventas del club'::text;

  -- Mostrar algunas fechas de ventas recientes para debug
  RETURN QUERY
  SELECT 'recent_sales_dates'::text,
         string_agg(sale_date::text, ', ')::text,
         'Fechas de las 5 ventas más recientes del club'::text
  FROM (
    SELECT sale_date
    FROM public.sales_with_details
    WHERE club_id = v_club_id
    ORDER BY sale_date DESC
    LIMIT 5
  ) recent_sales;

END;
$$;

-- ========================================
-- PASO 4: PERMISOS
-- ========================================

-- Otorgar permisos a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.fn_get_employee_today_sales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_employee_today_sales_local() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_debug_employee_today_sales() TO authenticated;

-- ========================================
-- INSTRUCCIONES DE USO
-- ========================================

/*
🔧 FIX APLICADO PARA VENTAS DEL DÍA DE EMPLEADOS

FUNCIONES DISPONIBLES:

1. fn_get_employee_today_sales() - Versión corregida original
2. fn_get_employee_today_sales_local() - Versión con timezone explícito
3. fn_debug_employee_today_sales() - Función de diagnóstico

PARA DIAGNOSTICAR PROBLEMAS:
SELECT * FROM fn_debug_employee_today_sales();

PARA PROBAR LAS FUNCIONES:
-- Función original corregida:
SELECT COUNT(*) as ventas_hoy_v1 FROM fn_get_employee_today_sales();

-- Función con timezone:
SELECT COUNT(*) as ventas_hoy_v2 FROM fn_get_employee_today_sales_local();

CAMBIOS APLICADOS:
✅ Restaurado filtro por club_id explícito
✅ Cambio de DATE() a sale_date::date para mejor performance
✅ Función alternativa con timezone específico
✅ Función de debug para diagnosticar problemas
✅ SECURITY DEFINER para acceso a datos
*/