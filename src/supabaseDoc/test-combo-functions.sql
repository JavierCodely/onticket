-- =======================================================
-- TEST: VERIFICAR FUNCIONES DE COMBOS
-- =======================================================

-- 1. Verificar si existen las funciones
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%combo%'
ORDER BY routine_name;

-- 2. Verificar si existe fn_create_sale_as_employee_with_combos
SELECT
  routine_name,
  routine_type,
  specific_name,
  external_language
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'fn_create_sale_as_employee_with_combos';

-- 3. Verificar si existe fn_use_combo
SELECT
  routine_name,
  routine_type,
  specific_name,
  external_language
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'fn_use_combo';

-- 4. Verificar tablas de combos
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%combo%'
ORDER BY table_name;

-- 5. Verificar si la vista combos_with_details existe
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'combos_with_details';

-- 6. Test básico de fn_use_combo (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'fn_use_combo'
  ) THEN
    RAISE NOTICE '✅ fn_use_combo existe';
  ELSE
    RAISE NOTICE '❌ fn_use_combo NO existe';
  END IF;
END $$;

-- 7. Test de permisos de empleado actual
DO $$
DECLARE
  v_club_id uuid;
  v_employee_club_id uuid;
  v_admin_club_id uuid;
BEGIN
  -- Test fn_current_employee_club_id
  BEGIN
    v_employee_club_id := fn_current_employee_club_id();
    RAISE NOTICE '✅ fn_current_employee_club_id retorna: %', v_employee_club_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error en fn_current_employee_club_id: %', SQLERRM;
  END;

  -- Test fn_current_admin_club_id
  BEGIN
    v_admin_club_id := fn_current_admin_club_id();
    RAISE NOTICE '✅ fn_current_admin_club_id retorna: %', v_admin_club_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error en fn_current_admin_club_id: %', SQLERRM;
  END;
END $$;