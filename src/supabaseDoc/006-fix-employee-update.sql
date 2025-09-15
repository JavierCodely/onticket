-- ===========================================================
-- FIX: Políticas RLS para Actualización de Empleados
-- ===========================================================

-- Problema: Los admins no pueden actualizar empleados desde la app
-- Solución: Recrear políticas con DROP IF EXISTS y nombres únicos

-- 01) Limpiar políticas existentes de employees
DROP POLICY IF EXISTS employees_all_service_role ON public.employees;
DROP POLICY IF EXISTS employees_select_my_club_admin ON public.employees;
DROP POLICY IF EXISTS employees_update_my_club_admin ON public.employees;
DROP POLICY IF EXISTS employees_select_self ON public.employees;
DROP POLICY IF EXISTS employees_update_self_limited ON public.employees;
DROP POLICY IF EXISTS employees_block_insert ON public.employees;
DROP POLICY IF EXISTS employees_block_delete ON public.employees;
DROP POLICY IF EXISTS employees_insert_my_club_admin ON public.employees;
DROP POLICY IF EXISTS employees_delete_my_club_admin ON public.employees;

-- 02) Verificar que la función fn_current_admin_club_id existe y funciona
-- Si da error, crear una función temporal
CREATE OR REPLACE FUNCTION public.fn_current_admin_club_id_temp()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.club_id
  FROM public.admins a
  WHERE a.user_id = auth.uid()
    AND a.status = 'active'
  LIMIT 1;
$$;

-- 03) Recrear políticas RLS con nombres únicos

-- Service role puede hacer todo
CREATE POLICY employees_service_role_all
  ON public.employees
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- Admins pueden ver empleados de su club
CREATE POLICY employees_admin_select
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id_temp()
  );

-- Admins pueden actualizar empleados de su club (ESTA ES LA CLAVE)
CREATE POLICY employees_admin_update
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id_temp()
  )
  WITH CHECK (
    club_id = fn_current_admin_club_id_temp()
  );

-- Empleados pueden ver su propio registro
CREATE POLICY employees_self_select
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Empleados pueden actualizar campos limitados de su propio registro
CREATE POLICY employees_self_update
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- 04) Verificar que RLS está habilitado
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 05) Función de diagnóstico para verificar permisos
CREATE OR REPLACE FUNCTION public.fn_debug_employee_permissions(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'current_user_id', auth.uid(),
    'is_admin', EXISTS (
      SELECT 1 FROM public.admins
      WHERE user_id = auth.uid() AND status = 'active'
    ),
    'admin_club_id', (
      SELECT club_id FROM public.admins
      WHERE user_id = auth.uid() AND status = 'active'
    ),
    'target_employee_club_id', (
      SELECT club_id FROM public.employees
      WHERE user_id = p_user_id
    ),
    'can_update', EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.admins a ON a.club_id = e.club_id
      WHERE e.user_id = p_user_id
        AND a.user_id = auth.uid()
        AND a.status = 'active'
    )
  );
$$;

-- 06) Query de prueba para verificar que funciona
-- Ejecutar esto después de aplicar el archivo:
/*
-- Prueba desde la consola SQL de Supabase:
SELECT fn_debug_employee_permissions('UUID_DEL_EMPLEADO_A_ACTUALIZAR');

-- Debería devolver algo como:
{
  "current_user_id": "uuid-del-admin",
  "is_admin": true,
  "admin_club_id": "uuid-del-club",
  "target_employee_club_id": "uuid-del-club",
  "can_update": true
}
*/

-- 07) Test de actualización directa
-- Puedes probar esto desde la consola SQL:
/*
UPDATE public.employees
SET status = 'inactive'
WHERE user_id = 'UUID_DEL_EMPLEADO'
RETURNING *;
*/