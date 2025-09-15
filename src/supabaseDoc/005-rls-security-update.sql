-- ===========================================================
-- ACTUALIZACIÓN DE SEGURIDAD RLS - POLÍTICAS RESTRICTIVAS
-- ===========================================================

-- 01) Actualizar funciones helper para incluir empleados en verificaciones

-- Función que devuelve el club_id del usuario autenticado (admin o empleado)
CREATE OR REPLACE FUNCTION public.fn_current_user_club_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Primero verificar si es admin
  SELECT a.club_id
  FROM public.admins a
  WHERE a.user_id = auth.uid() AND a.status = 'active'

  UNION

  -- Si no es admin, verificar si es empleado
  SELECT e.club_id
  FROM public.employees e
  WHERE e.user_id = auth.uid() AND e.status = 'active'

  LIMIT 1;
$$;

-- Función para verificar si el usuario puede acceder a datos de un club específico
CREATE OR REPLACE FUNCTION public.fn_can_access_club(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_club_id = fn_current_user_club_id();
$$;

-- 02) Mejorar políticas RLS para clubs

-- Clubs: lectura solo para usuarios autenticados de ese club
DROP POLICY IF EXISTS clubs_select_my_club ON public.clubs;
CREATE POLICY clubs_select_my_club
  ON public.clubs
  FOR SELECT
  TO authenticated
  USING (
    id = fn_current_user_club_id() -- Admins y empleados pueden ver su club
  );

-- Clubs: actualización solo para admins
DROP POLICY IF EXISTS clubs_update_my_club ON public.clubs;
CREATE POLICY clubs_update_my_club
  ON public.clubs
  FOR UPDATE
  TO authenticated
  USING (
    id = fn_current_admin_club_id() -- Solo admins pueden editar
  )
  WITH CHECK (
    id = fn_current_admin_club_id()
  );

-- 03) Mejorar políticas RLS para accounts

-- Accounts: lectura para admins y empleados del club
DROP POLICY IF EXISTS accounts_select_my_club ON public.accounts;
CREATE POLICY accounts_select_my_club
  ON public.accounts
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_user_club_id() -- Admins y empleados pueden ver cuentas
  );

-- Accounts: modificación solo para admins
DROP POLICY IF EXISTS accounts_insert_my_club ON public.accounts;
CREATE POLICY accounts_insert_my_club
  ON public.accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id = fn_current_admin_club_id() -- Solo admins pueden crear cuentas
  );

DROP POLICY IF EXISTS accounts_update_my_club ON public.accounts;
CREATE POLICY accounts_update_my_club
  ON public.accounts
  FOR UPDATE
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id() -- Solo admins pueden editar cuentas
  )
  WITH CHECK (
    club_id = fn_current_admin_club_id()
  );

DROP POLICY IF EXISTS accounts_delete_my_club ON public.accounts;
CREATE POLICY accounts_delete_my_club
  ON public.accounts
  FOR DELETE
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id() -- Solo admins pueden eliminar cuentas
  );

-- 04) Mejorar políticas RLS para account_transactions

-- Transacciones: lectura para admins y empleados (para ver movimientos)
DROP POLICY IF EXISTS account_tx_select_my_club ON public.account_transactions;
CREATE POLICY account_tx_select_my_club
  ON public.account_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_transactions.account_id
        AND a.club_id = fn_current_user_club_id()
    )
  );

-- Transacciones: creación para admins y empleados (para registrar ventas/movimientos)
DROP POLICY IF EXISTS account_tx_insert_my_club ON public.account_transactions;
CREATE POLICY account_tx_insert_my_club
  ON public.account_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_transactions.account_id
        AND a.club_id = fn_current_user_club_id()
    )
  );

-- Transacciones: edición/eliminación solo para admins
DROP POLICY IF EXISTS account_tx_update_my_club ON public.account_transactions;
CREATE POLICY account_tx_update_my_club
  ON public.account_transactions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_transactions.account_id
        AND a.club_id = fn_current_admin_club_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_transactions.account_id
        AND a.club_id = fn_current_admin_club_id()
    )
  );

DROP POLICY IF EXISTS account_tx_delete_my_club ON public.account_transactions;
CREATE POLICY account_tx_delete_my_club
  ON public.account_transactions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_transactions.account_id
        AND a.club_id = fn_current_admin_club_id()
    )
  );

-- 05) Políticas RLS para admins (sin cambios mayores)

-- Admins: solo pueden ver su propio registro
DROP POLICY IF EXISTS admins_select_self ON public.admins;
CREATE POLICY admins_select_self
  ON public.admins
  FOR SELECT
  TO authenticated
  USING ( user_id = auth.uid() );

-- Admins: pueden actualizar su propio perfil (sin cambiar club)
DROP POLICY IF EXISTS admins_update_self ON public.admins;
CREATE POLICY admins_update_self
  ON public.admins
  FOR UPDATE
  TO authenticated
  USING ( user_id = auth.uid() )
  WITH CHECK (
    user_id = auth.uid()
    AND club_id = fn_current_admin_club_id() -- No puede cambiar de club
  );

-- 06) RLS en vistas (asegurar que hereden las políticas)
ALTER VIEW public.accounts_with_balance SET (security_invoker = on);

-- 07) Función adicional para logging de accesos (opcional)
CREATE OR REPLACE FUNCTION public.fn_log_user_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Registrar acceso en logs (implementar si se necesita auditoría)
  -- INSERT INTO access_logs (user_id, table_name, action, timestamp)
  -- VALUES (auth.uid(), TG_TABLE_NAME, TG_OP, NOW());

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 08) Comentarios sobre la nueva estructura de seguridad
/*
RESUMEN DE PERMISOS POST-ACTUALIZACIÓN:

SERVICE ROLE:
- Puede hacer todo en todas las tablas

ADMINS:
- Ver: su club, empleados de su club, cuentas de su club, transacciones de su club
- Editar: su perfil, datos del club, empleados del club, cuentas del club
- Crear/Eliminar: cuentas del club, transacciones (con restricciones)

EMPLEADOS:
- Ver: su club, su perfil, empleados del mismo club, cuentas del club, transacciones del club
- Editar: campos limitados de su perfil
- Crear: transacciones (para registrar ventas)
- NO pueden: crear/editar otros empleados, crear/editar cuentas, eliminar nada

USUARIOS NO AUTENTICADOS:
- NO pueden acceder a nada (todas las tablas tienen RLS habilitado)

USUARIOS INACTIVOS:
- NO pueden acceder a nada (las funciones verifican status = 'active')
*/