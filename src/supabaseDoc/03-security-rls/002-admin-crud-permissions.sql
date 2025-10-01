-- ===========================================================
-- PARCHE DE PERMISOS: ADMIN CON CRUD COMPLETO EN SU CLUB
-- ===========================================================

-- 1) CLUBS: permitir que el admin actualice LOS DATOS de su propio club
DROP POLICY IF EXISTS clubs_update_my_club ON public.clubs;
CREATE POLICY clubs_update_my_club
  ON public.clubs
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING     ( id = fn_current_admin_club_id() )          -- Solo puede tocar su club
  WITH CHECK( id = fn_current_admin_club_id() );          -- Y el resultado debe seguir siendo su club

-- (Opcional y NO recomendado) permitir INSERT/DELETE de clubs por admins:
-- ¡Riesgoso! Rompe la garantía "1 admin = 1 club" y la curaduría por backend.
-- DROP POLICY IF EXISTS clubs_insert_admin ON public.clubs;
-- CREATE POLICY clubs_insert_admin
--   ON public.clubs
--   FOR INSERT TO authenticated
--   WITH CHECK ( true );
-- DROP POLICY IF EXISTS clubs_delete_admin ON public.clubs;
-- CREATE POLICY clubs_delete_admin
--   ON public.clubs
--   FOR DELETE TO authenticated
--   USING ( id = fn_current_admin_club_id() );

-- 2) ACCOUNTS: permitir INSERT/UPDATE/DELETE de cuentas del propio club
DROP POLICY IF EXISTS accounts_insert_my_club ON public.accounts;
CREATE POLICY accounts_insert_my_club
  ON public.accounts
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ( club_id = fn_current_admin_club_id() );    -- Solo puede crear cuentas para su club

DROP POLICY IF EXISTS accounts_update_my_club ON public.accounts;
CREATE POLICY accounts_update_my_club
  ON public.accounts
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING     ( club_id = fn_current_admin_club_id() )      -- Solo edita cuentas de su club
  WITH CHECK( club_id = fn_current_admin_club_id() );      -- Y no puede moverlas a otro club

DROP POLICY IF EXISTS accounts_delete_my_club ON public.accounts;
CREATE POLICY accounts_delete_my_club
  ON public.accounts
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );          -- Solo borra cuentas de su club

-- 3) ACCOUNT TRANSACTIONS: permitir INSERT/UPDATE/DELETE en cuentas de su club
DROP POLICY IF EXISTS account_tx_insert_my_club ON public.account_transactions;
CREATE POLICY account_tx_insert_my_club
  ON public.account_transactions
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ( fn_account_belongs_to_my_club(account_id) ); -- Solo inserta si la cuenta es de su club

DROP POLICY IF EXISTS account_tx_update_my_club ON public.account_transactions;
CREATE POLICY account_tx_update_my_club
  ON public.account_transactions
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING     ( fn_account_belongs_to_my_club(account_id) )  -- Solo edita movimientos de su club
  WITH CHECK( fn_account_belongs_to_my_club(account_id) ); -- Y el resultado sigue siendo su club

DROP POLICY IF EXISTS account_tx_delete_my_club ON public.account_transactions;
CREATE POLICY account_tx_delete_my_club
  ON public.account_transactions
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING ( fn_account_belongs_to_my_club(account_id) );      -- Solo borra movimientos de su club

-- 4) ADMINS: permitir que el admin edite SOLO su propio registro (sin cambiarse de club)
DROP POLICY IF EXISTS admins_update_self ON public.admins;
CREATE POLICY admins_update_self
  ON public.admins
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING     ( user_id = auth.uid() )                        -- Solo su fila
  WITH CHECK( user_id = auth.uid()
              AND club_id = fn_current_admin_club_id() );   -- No puede reasignarse a otro club

-- Nota:
-- Seguimos dejando INSERT/DELETE de public.admins y public.clubs para service_role,
-- para cuidar el flujo: backend crea el club, le crea cuentas base y lo vincula a un admin.
