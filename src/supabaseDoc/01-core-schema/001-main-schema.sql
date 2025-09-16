-- ===========================================================
-- PARTE 1: CLUBS + ADMINS (vinculado a auth.users) + CUENTAS
-- ===========================================================

-- 01) Extensión para UUIDs con gen_random_uuid (suele venir activa en Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- Habilita funciones criptográficas, incluido gen_random_uuid()

-- 02) Tipos enumerados para estados y tipos de cuenta
DO $$
BEGIN
  -- Estado general de un club
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_status') THEN
    CREATE TYPE club_status AS ENUM ('active', 'inactive', 'suspended'); -- Controla si el club opera o no
  END IF;

  -- Estado del admin
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_status') THEN
    CREATE TYPE admin_status AS ENUM ('active', 'inactive'); -- Activo: puede operar; Inactivo: bloqueado
  END IF;

  -- Tipos de cuenta financiera asociada al club
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE account_type AS ENUM ('cash', 'wallet', 'bank', 'other'); -- 'cash' = efectivo; 'wallet' = billetera virtual
  END IF;

  -- Estado de caja (si luego querés operarlas abriendo/cerrando turnos)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'register_status') THEN
    CREATE TYPE register_status AS ENUM ('open', 'closed'); -- Abierta o cerrada (para futuras "cajas")
  END IF;
END$$;

-- 03) Función utilitaria para timestamps automáticos (updated_at)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW(); -- Actualiza el campo updated_at en cada UPDATE
  RETURN NEW;
END;
$$; -- Usaremos este trigger en tablas con updated_at

-- 04) Tabla principal: clubs (un club nocturno)
CREATE TABLE IF NOT EXISTS public.clubs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- Identificador único del club
  name                  text NOT NULL,                               -- Nombre comercial visible del club
  legal_name            text,                                        -- Razón social (si aplica)
  tax_id                text,                                        -- CUIT u otro identificador fiscal
  email                 text,                                        -- Email de contacto
  phone                 text,                                        -- Teléfono de contacto
  -- Dirección (campos simples; si preferís JSON, podemos migrar luego)
  street                text,                                        -- Calle y número
  city                  text,                                        -- Ciudad
  province              text,                                        -- Provincia/Estado
  country               text DEFAULT 'Argentina',                    -- País
  postal_code           text,                                        -- Código postal
  timezone              text NOT NULL DEFAULT 'America/Argentina/Tucuman', -- Zona horaria del club
  status                club_status NOT NULL DEFAULT 'active',       -- Estado operativo del club
  notes                 text,                                        -- Observaciones internas
  created_at            timestamptz NOT NULL DEFAULT NOW(),          -- Fecha de creación del registro
  updated_at            timestamptz NOT NULL DEFAULT NOW()           -- Última actualización del registro
); -- Esta tabla concentra la identidad y metadatos del club

-- 04.1) Índices útiles
CREATE INDEX IF NOT EXISTS clubs_name_idx ON public.clubs (name); -- Búsqueda por nombre
CREATE INDEX IF NOT EXISTS clubs_status_idx ON public.clubs (status); -- Filtrar por estado

-- 04.2) Trigger de updated_at en clubs
DROP TRIGGER IF EXISTS trg_clubs_updated_at ON public.clubs;
CREATE TRIGGER trg_clubs_updated_at
BEFORE UPDATE ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at(); -- Mantiene updated_at coherente

-- 05) Tabla de cuentas financieras del club (efectivo, billetera virtual, etc.)
CREATE TABLE IF NOT EXISTS public.accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- Identificador único de la cuenta
  club_id           uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE, -- Dueño de la cuenta
  type              account_type NOT NULL,                       -- Tipo de cuenta: cash, wallet, bank, other
  name              text NOT NULL,                               -- Nombre legible (p. ej., "Caja Principal", "Billetera Virtual")
  currency          char(3) NOT NULL DEFAULT 'ARS',              -- Moneda (ISO 4217), por defecto pesos argentinos
  initial_balance   numeric(14,2) NOT NULL DEFAULT 0,            -- Saldo inicial para la cuenta
  is_primary        boolean NOT NULL DEFAULT false,              -- Marcar una cuenta principal si querés
  created_at        timestamptz NOT NULL DEFAULT NOW(),          -- Creación
  updated_at        timestamptz NOT NULL DEFAULT NOW(),          -- Última actualización
  UNIQUE (club_id, name)                                         -- Evita duplicados de nombre de cuenta dentro del mismo club
); -- Permite que cada club tenga múltiples cuentas de dinero separadas

-- 05.1) Índices e updated_at para accounts
CREATE INDEX IF NOT EXISTS accounts_club_idx ON public.accounts (club_id);
CREATE INDEX IF NOT EXISTS accounts_type_idx ON public.accounts (type);

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 06) Movimientos de las cuentas (para obtener saldos reales por suma)
CREATE TABLE IF NOT EXISTS public.account_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),     -- Identificador del movimiento
  account_id      uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE, -- Cuenta afectada
  occurred_at     timestamptz NOT NULL DEFAULT NOW(),             -- Cuándo ocurrió el movimiento
  amount          numeric(14,2) NOT NULL CHECK (amount <> 0),     -- Monto (+ ingreso, - egreso)
  description     text,                                           -- Descripción libre (p. ej., "Apertura de caja")
  ref_type        text,                                           -- Tipo de referencia (p. ej., "venta", "ajuste", "retiro")
  ref_id          uuid,                                           -- ID externo si querés enlazar a ventas, etc.
  created_by      uuid,                                           -- auth.users.id del usuario que generó el movimiento (opcional)
  created_at      timestamptz NOT NULL DEFAULT NOW()              -- Fecha de creación del registro
); -- Con esto podés reconstruir saldos reales al sumar movimientos

-- 06.1) Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS account_tx_account_idx ON public.account_transactions (account_id);
CREATE INDEX IF NOT EXISTS account_tx_occurred_at_idx ON public.account_transactions (occurred_at);

-- 07) Vista de conveniencia: saldo actual por cuenta (initial_balance + SUM(movimientos))
CREATE OR REPLACE VIEW public.accounts_with_balance AS
SELECT
  a.*,
  (a.initial_balance + COALESCE(SUM(t.amount), 0))::numeric(14,2) AS current_balance -- Saldo actual calculado
FROM public.accounts a
LEFT JOIN public.account_transactions t
  ON t.account_id = a.id
GROUP BY a.id; -- Agrega movimientos a partir del saldo inicial

-- 08) Tabla de admins (1 admin ↔ 1 club), vinculada a auth.users
CREATE TABLE IF NOT EXISTS public.admins (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Usuario de Supabase Auth
  club_id     uuid NOT NULL UNIQUE REFERENCES public.clubs(id) ON DELETE CASCADE, -- Club asignado (único → 1:1)
  full_name   text,                                        -- Nombre completo del admin (opcional)
  phone       text,                                        -- Teléfono del admin (opcional)
  status      admin_status NOT NULL DEFAULT 'active',      -- Activo/Inactivo
  created_at  timestamptz NOT NULL DEFAULT NOW(),          -- Creación
  updated_at  timestamptz NOT NULL DEFAULT NOW()           -- Última actualización
); -- Cada admin pertenece a exactamente 1 club, y cada club tiene a lo sumo 1 admin

-- 08.1) Índices y trigger de updated_at para admins
CREATE INDEX IF NOT EXISTS admins_club_idx ON public.admins (club_id);
CREATE INDEX IF NOT EXISTS admins_status_idx ON public.admins (status);

DROP TRIGGER IF EXISTS trg_admins_updated_at ON public.admins;
CREATE TRIGGER trg_admins_updated_at
BEFORE UPDATE ON public.admins
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 09) Helpers para RLS (Row Level Security)

-- 09.1) Devuelve el club_id del admin autenticado (o NULL si no es admin activo)
CREATE OR REPLACE FUNCTION public.fn_current_admin_club_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.club_id
  FROM public.admins a
  WHERE a.user_id = auth.uid()        -- auth.uid() = id del usuario autenticado en Supabase
    AND a.status = 'active'
  LIMIT 1;
$$; -- Esta función permite a las policies saber "de qué club es" el usuario autenticado

-- 09.2) Chequea si una cuenta pertenece al club del admin autenticado
CREATE OR REPLACE FUNCTION public.fn_account_belongs_to_my_club(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = p_account_id
      AND a.club_id = fn_current_admin_club_id()
  );
$$; -- Útil para permitir insertar movimientos sólo en cuentas de tu propio club

-- 10) Habilitar RLS (multi-tenant seguro)
ALTER TABLE public.clubs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins                ENABLE ROW LEVEL SECURITY;

-- 10.1) Política “service_role puede todo” (para tareas de backend con la Service Key)
-- Nota: auth.jwt() ->> 'role' = 'service_role' cuando usás la service key
CREATE POLICY clubs_all_service_role
  ON public.clubs
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

CREATE POLICY accounts_all_service_role
  ON public.accounts
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

CREATE POLICY account_tx_all_service_role
  ON public.account_transactions
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

CREATE POLICY admins_all_service_role
  ON public.admins
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- 10.2) Políticas de LECTURA por club (para usuarios autenticados que sean admins activos)
-- Clubs: sólo puedo ver MI club
CREATE POLICY clubs_select_my_club
  ON public.clubs
  FOR SELECT
  TO authenticated
  USING ( id = fn_current_admin_club_id() ); -- Filtra a tu club

-- Accounts: sólo cuentas de MI club
CREATE POLICY accounts_select_my_club
  ON public.accounts
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

-- Account transactions: sólo movimientos de cuentas de MI club
CREATE POLICY account_tx_select_my_club
  ON public.account_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_transactions.account_id
        AND a.club_id = fn_current_admin_club_id()
    )
  );

-- Admins: sólo puedo ver MI propio registro de admin
CREATE POLICY admins_select_self
  ON public.admins
  FOR SELECT
  TO authenticated
  USING ( user_id = auth.uid() );

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

-- Account transactions: permitir que el admin cargue movimientos en cuentas de su club
CREATE POLICY account_tx_insert_my_club
  ON public.account_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK ( fn_account_belongs_to_my_club(account_id) ); -- Sólo puedo insertar si la cuenta es de mi club

-- UPDATE/DELETE de movimientos: opcional (por ahora, restringimos a service_role)
-- Si querés permitir correcciones por el admin, descomentalas:
-- CREATE POLICY account_tx_update_my_club
--   ON public.account_transactions
--   FOR UPDATE
--   TO authenticated
--   USING ( fn_account_belongs_to_my_club(account_id) )
--   WITH CHECK ( fn_account_belongs_to_my_club(account_id) );
--
-- CREATE POLICY account_tx_delete_my_club
--   ON public.account_transactions
--   FOR DELETE
--   TO authenticated
--   USING ( fn_account_belongs_to_my_club(account_id) );

-- Admins y Clubs: escritura reservada al service_role (alta/baja/edición desde tu backend).
-- Así evitás que un admin se reasigne a otro club, o cree clubes por su cuenta.

-- 11) Recomendación operativa:
--    1) Creás al usuario en Supabase Auth (manualmente, sin registro público).
--    2) INSERT en public.clubs para crear el club.
--    3) INSERT en public.accounts para "Caja en efectivo" y "Billetera virtual".
--    4) INSERT en public.admins (user_id del auth.users + club_id del club creado).
--    Todo esto con la Service Key (bypassea las restricciones pensadas para front-end).
