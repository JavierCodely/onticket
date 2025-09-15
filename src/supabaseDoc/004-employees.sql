-- ===========================================================
-- TABLA EMPLOYEES: Personal del club vinculado a auth.users
-- ===========================================================

-- 01) Tipo enumerado para categorías de empleados
DO $$
BEGIN
  -- Categorías de empleados de un club nocturno
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_category') THEN
    CREATE TYPE employee_category AS ENUM (
      'bartender',     -- Bartender/Barman
      'security',      -- Seguridad/Patovica
      'dj',            -- DJ/Disc Jockey
      'waiter',        -- Mozo/Mesero
      'cashier',       -- Cajero
      'cleaner',       -- Personal de limpieza
      'host',          -- Host/Anfitrión
      'manager',       -- Gerente/Supervisor
      'technician',    -- Técnico (sonido, luces, etc.)
      'promoter',      -- Promotor/Relaciones públicas
      'other'          -- Otros roles
    );
  END IF;

  -- Estado del empleado
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_status') THEN
    CREATE TYPE employee_status AS ENUM ('active', 'inactive');
  END IF;
END$$;

-- 02) Tabla de empleados (similar a admins pero con categorías)
CREATE TABLE IF NOT EXISTS public.employees (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Usuario de Supabase Auth
  club_id           uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,   -- Club al que pertenece
  employee_number   text,                                        -- Número de empleado (opcional)
  full_name         text NOT NULL,                               -- Nombre completo del empleado
  phone             text,                                        -- Teléfono del empleado
  category          employee_category NOT NULL,                  -- Categoría/rol del empleado
  hourly_rate       numeric(10,2),                              -- Tarifa por hora (opcional)
  hire_date         date,                                        -- Fecha de contratación
  status            employee_status NOT NULL DEFAULT 'active',   -- Activo/Inactivo (si está inactivo no puede iniciar sesión)
  notes             text,                                        -- Observaciones sobre el empleado
  created_at        timestamptz NOT NULL DEFAULT NOW(),          -- Fecha de creación del registro
  updated_at        timestamptz NOT NULL DEFAULT NOW(),          -- Última actualización del registro

  -- Índice único para evitar empleados duplicados en el mismo club
  UNIQUE (club_id, employee_number)
);

-- 02.1) Índices útiles para consultas
CREATE INDEX IF NOT EXISTS employees_club_idx ON public.employees (club_id);
CREATE INDEX IF NOT EXISTS employees_category_idx ON public.employees (category);
CREATE INDEX IF NOT EXISTS employees_status_idx ON public.employees (status);
CREATE INDEX IF NOT EXISTS employees_hire_date_idx ON public.employees (hire_date);

-- 02.2) Trigger de updated_at para employees
DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 03) Función helper para verificar si el usuario autenticado es un empleado activo
CREATE OR REPLACE FUNCTION public.fn_current_employee_club_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.club_id
  FROM public.employees e
  WHERE e.user_id = auth.uid()
    AND e.status = 'active'
  LIMIT 1;
$$;

-- 04) Función para verificar si el empleado autenticado puede acceder a ciertos datos
CREATE OR REPLACE FUNCTION public.fn_is_active_employee()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND e.status = 'active'
  );
$$;

-- 05) Habilitar RLS en la tabla employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 06) Políticas RLS para employees

-- 06.1) Service role puede hacer todo (para operaciones de backend/admin)
DROP POLICY IF EXISTS employees_all_service_role ON public.employees;
CREATE POLICY employees_all_service_role
  ON public.employees
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- 06.2) Los admins pueden ver empleados de su club
DROP POLICY IF EXISTS employees_select_my_club_admin ON public.employees;
CREATE POLICY employees_select_my_club_admin
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id() -- Solo empleados del club del admin
  );

-- 06.3) Los admins pueden actualizar empleados de su club (SOLO EDICIÓN, NO CREACIÓN)
DROP POLICY IF EXISTS employees_update_my_club_admin ON public.employees;
CREATE POLICY employees_update_my_club_admin
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id() -- Solo empleados de su club
  )
  WITH CHECK (
    club_id = fn_current_admin_club_id() -- Asegurar que sigue siendo de su club
  );

-- 06.4) Los empleados pueden ver su propio registro
DROP POLICY IF EXISTS employees_select_self ON public.employees;
CREATE POLICY employees_select_self
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'active' -- Solo empleados activos pueden ver su registro
  );

-- 06.5) Los empleados pueden actualizar campos limitados de su propio registro
DROP POLICY IF EXISTS employees_update_self_limited ON public.employees;
CREATE POLICY employees_update_self_limited
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'active' -- Solo empleados activos pueden actualizar
  )
  WITH CHECK (
    user_id = auth.uid() -- Solo puede actualizar su propio registro
  );

-- 06.6) IMPORTANTE: Bloquear INSERT y DELETE para usuarios regulares
-- Solo service_role puede crear/eliminar empleados (desde Supabase Dashboard)
DROP POLICY IF EXISTS employees_block_insert ON public.employees;
CREATE POLICY employees_block_insert
  ON public.employees
  FOR INSERT
  TO authenticated
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

DROP POLICY IF EXISTS employees_block_delete ON public.employees;
CREATE POLICY employees_block_delete
  ON public.employees
  FOR DELETE
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' );

-- 07) Vista de conveniencia: empleados con información del club
CREATE OR REPLACE VIEW public.employees_with_club AS
SELECT
  e.*,
  c.name as club_name,
  c.status as club_status
FROM public.employees e
JOIN public.clubs c ON c.id = e.club_id;

-- 08) RLS en la vista employees_with_club
ALTER VIEW public.employees_with_club SET (security_invoker = on);

-- 09) Función helper adicional para verificar si un usuario es admin o empleado
CREATE OR REPLACE FUNCTION public.fn_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.admins
      WHERE user_id = auth.uid() AND status = 'active'
    ) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.employees
      WHERE user_id = auth.uid() AND status = 'active'
    ) THEN 'employee'
    ELSE 'none'
  END;
$$;

-- 10) Comentarios sobre el uso actual:
-- CREACIÓN DE EMPLEADOS (Solo desde Supabase Dashboard):
-- 1) Dashboard de Supabase → Authentication → Users → Invite user
-- 2) Una vez creado el usuario en auth.users, insertar en employees:
--    INSERT INTO employees (user_id, club_id, full_name, category, status)
--    VALUES (user_uuid, club_uuid, 'Nombre del Empleado', 'categoria', 'active');
-- 3) El empleado podrá iniciar sesión solo si status = 'active'
--
-- GESTIÓN DESDE LA APP:
-- - Los ADMINS pueden: ver, editar y activar/desactivar empleados de su club
-- - Los EMPLEADOS pueden: ver y editar campos limitados de su propio perfil
-- - NADIE puede crear o eliminar empleados desde la app (solo desde Supabase)
--
-- SEGURIDAD:
-- - RLS está habilitado en todas las tablas
-- - Multi-tenancy: cada club solo ve sus propios datos
-- - Service role puede hacer todo (para operaciones administrativas)
-- - Los empleados inactivos no pueden acceder a ningún dato