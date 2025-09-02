-- 10.3) Políticas de ESCRITURA mínimas para operación diaria
-- Nota: creaciones/altas (INSERT) de clubs y admins se esperan via service_role (backend),
-- por eso arriba ya dimos “all_service_role”. Aquí habilitamos lo que tiene sentido
-- para un admin operativo dentro de su club (por ejemplo, cargar movimientos).

-- Accounts: por defecto NO permitimos INSERT/UPDATE/DELETE a admins (sólo service_role).
-- Si querés que un admin pueda crear/editar cuentas de su club, descomentar estas políticas:
CREATE POLICY accounts_insert_my_club
   ON public.accounts
   FOR INSERT
   TO authenticated
   WITH CHECK ( club_id = fn_current_admin_club_id() );
--
 CREATE POLICY accounts_update_my_club
   ON public.accounts
   FOR UPDATE
   TO authenticated
   USING ( club_id = fn_current_admin_club_id() )
   WITH CHECK ( club_id = fn_current_admin_club_id() );

 CREATE POLICY accounts_delete_my_club
   ON public.accounts
   FOR DELETE
   TO authenticated
   USING ( club_id = fn_current_admin_club_id() );
