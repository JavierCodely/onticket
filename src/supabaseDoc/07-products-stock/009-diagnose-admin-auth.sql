-- ===========================================================
-- DIAGNÓSTICO: ¿POR QUÉ NO SE RECONOCE COMO ADMIN?
-- ===========================================================

-- ========================================
-- 1. VERIFICAR USUARIO ACTUAL
-- ========================================

SELECT
  '1. USUARIO ACTUAL' as seccion,
  auth.uid() as user_id,
  auth.jwt() ->> 'email' as email,
  auth.jwt() ->> 'role' as role;

-- ========================================
-- 2. VERIFICAR ADMIN EN TABLA ADMINS
-- ========================================

SELECT
  '2. REGISTRO EN TABLA ADMINS' as seccion,
  a.*
FROM public.admins a
WHERE a.user_id = auth.uid();

-- ========================================
-- 3. VERIFICAR CLUB DEL ADMIN
-- ========================================

SELECT
  '3. CLUB DEL ADMIN' as seccion,
  c.*
FROM public.clubs c
WHERE c.id IN (
  SELECT club_id FROM public.admins WHERE user_id = auth.uid()
);

-- ========================================
-- 4. PROBAR FUNCIÓN fn_current_admin_club_id
-- ========================================

SELECT
  '4. RESULTADO DE fn_current_admin_club_id()' as seccion,
  fn_current_admin_club_id() as club_id;

-- ========================================
-- 5. VER DEFINICIÓN DE LA FUNCIÓN
-- ========================================

SELECT
  '5. DEFINICIÓN DE fn_current_admin_club_id' as seccion,
  pg_get_functiondef(p.oid) as definicion
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'fn_current_admin_club_id';

-- ========================================
-- 6. VERIFICAR TODOS LOS ADMINS EXISTENTES
-- ========================================

SELECT
  '6. TODOS LOS ADMINS EN EL SISTEMA' as seccion,
  a.id,
  a.user_id,
  a.club_id,
  c.name as club_name,
  a.status as admin_status,
  a.created_at
FROM public.admins a
JOIN public.clubs c ON c.id = a.club_id
ORDER BY a.created_at DESC;

-- ========================================
-- 7. VERIFICAR PERMISOS RLS
-- ========================================

-- Ver si puedo ver productos
SELECT
  '7a. ¿PUEDO VER PRODUCTOS?' as seccion,
  COUNT(*) as productos_visibles
FROM public.products;

-- Ver si puedo ver mi club
SELECT
  '7b. ¿PUEDO VER MI CLUB?' as seccion,
  *
FROM public.clubs
WHERE id = fn_current_admin_club_id();

-- ========================================
-- RESUMEN EJECUTIVO
-- ========================================

DO $$
DECLARE
  v_user_id uuid;
  v_club_id uuid;
  v_admin_record record;
  v_club_record record;
BEGIN
  v_user_id := auth.uid();
  v_club_id := fn_current_admin_club_id();

  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════╗';
  RAISE NOTICE '║   DIAGNÓSTICO DE AUTENTICACIÓN ADMIN       ║';
  RAISE NOTICE '╠════════════════════════════════════════════╣';
  RAISE NOTICE '';

  -- Verificar user_id
  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ NO HAY USUARIO AUTENTICADO';
    RAISE NOTICE '   Solución: Asegúrate de estar logueado';
    RETURN;
  ELSE
    RAISE NOTICE '✓ Usuario autenticado: %', v_user_id;
  END IF;

  -- Verificar registro en admins
  SELECT * INTO v_admin_record
  FROM public.admins
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE NOTICE '❌ NO HAY REGISTRO EN TABLA ADMINS';
    RAISE NOTICE '   Usuario ID: %', v_user_id;
    RAISE NOTICE '   Solución: Este usuario NO es admin';
    RAISE NOTICE '   Debes crear un admin con este user_id';
    RETURN;
  ELSE
    RAISE NOTICE '✓ Registro en admins encontrado';
    RAISE NOTICE '   Admin ID: %', v_admin_record.id;
    RAISE NOTICE '   Club ID: %', v_admin_record.club_id;
    RAISE NOTICE '   Status: %', v_admin_record.status;
  END IF;

  -- Verificar status del admin
  IF v_admin_record.status != 'active' THEN
    RAISE NOTICE '❌ ADMIN NO ESTÁ ACTIVO';
    RAISE NOTICE '   Status actual: %', v_admin_record.status;
    RAISE NOTICE '   Solución: Cambiar status a ''active''';
    RETURN;
  ELSE
    RAISE NOTICE '✓ Admin está activo';
  END IF;

  -- Verificar club
  SELECT * INTO v_club_record
  FROM public.clubs
  WHERE id = v_admin_record.club_id;

  IF NOT FOUND THEN
    RAISE NOTICE '❌ CLUB NO EXISTE';
    RAISE NOTICE '   Club ID: %', v_admin_record.club_id;
    RAISE NOTICE '   Solución: El club fue eliminado o no existe';
    RETURN;
  ELSE
    RAISE NOTICE '✓ Club encontrado: %', v_club_record.name;
    RAISE NOTICE '   Club status: %', v_club_record.status;
  END IF;

  -- Verificar función
  IF v_club_id IS NULL THEN
    RAISE NOTICE '❌ fn_current_admin_club_id() RETORNA NULL';
    RAISE NOTICE '   Esto NO debería pasar si todo lo anterior está OK';
    RAISE NOTICE '   Solución: Revisar la definición de la función';
    RETURN;
  ELSE
    RAISE NOTICE '✓ fn_current_admin_club_id() funciona: %', v_club_id;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════╗';
  RAISE NOTICE '║  ✓✓✓ TODO ESTÁ CORRECTO ✓✓✓               ║';
  RAISE NOTICE '║  Deberías poder crear productos            ║';
  RAISE NOTICE '╚════════════════════════════════════════════╝';
  RAISE NOTICE '';

END$$;
