-- ===========================================================
-- CALENDARIO Y TAREAS DEL CLUB
-- ===========================================================

-- 01) Tipos enumerados para el calendario
DO $$
BEGIN
  -- Prioridades de las tareas
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE task_priority AS ENUM (
      'high',      -- Rojo - Importante
      'medium',    -- Azul - Medio importante
      'low'        -- Amarillo - No tan importante
    );
  END IF;

  -- Tipos de eventos del calendario
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calendar_event_type') THEN
    CREATE TYPE calendar_event_type AS ENUM (
      'task',           -- Tarea general
      'dj_missing',     -- Sábado sin DJ asignado
      'event',          -- Evento del club
      'maintenance',    -- Mantenimiento
      'meeting',        -- Reunión
      'other'           -- Otros
    );
  END IF;

  -- Estados de las tareas
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM (
      'pending',        -- Pendiente
      'in_progress',    -- En progreso
      'completed',      -- Completada
      'cancelled'       -- Cancelada
    );
  END IF;
END$$;

-- 02) Tabla principal del calendario
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Información del evento
  title                 text NOT NULL,                               -- Título de la tarea/evento
  description           text,                                        -- Descripción detallada
  event_type            calendar_event_type NOT NULL DEFAULT 'task', -- Tipo de evento

  -- Fechas y tiempo
  event_date            date NOT NULL,                               -- Fecha del evento
  start_time            time,                                        -- Hora de inicio (opcional)
  end_time              time,                                        -- Hora de fin (opcional)
  all_day               boolean NOT NULL DEFAULT true,               -- Evento de todo el día

  -- Propiedades de la tarea
  priority              task_priority NOT NULL DEFAULT 'medium',     -- Prioridad (color)
  status                task_status NOT NULL DEFAULT 'pending',      -- Estado de la tarea
  is_completed          boolean NOT NULL DEFAULT false,              -- Checkbox completado

  -- Metadatos específicos
  is_recurring          boolean NOT NULL DEFAULT false,              -- Si se repite
  recurrence_pattern    text,                                        -- Patrón de recurrencia (JSON o string)
  assigned_to           uuid REFERENCES auth.users(id),              -- Asignado a (empleado)

  -- DJ específico para sábados
  needs_dj              boolean NOT NULL DEFAULT false,              -- Sábado que necesita DJ
  dj_assigned           boolean NOT NULL DEFAULT false,              -- DJ ya asignado
  dj_user_id            uuid REFERENCES auth.users(id),              -- DJ asignado

  -- Notas y observaciones
  notes                 text,                                        -- Notas adicionales
  attachments           jsonb,                                       -- URLs de archivos adjuntos

  -- Auditoría
  created_by            uuid REFERENCES auth.users(id),              -- Quién creó el evento
  updated_by            uuid REFERENCES auth.users(id),              -- Quién actualizó
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW()
);

-- 02.1) Índices para optimización
CREATE INDEX IF NOT EXISTS calendar_events_club_idx ON public.calendar_events (club_id);
CREATE INDEX IF NOT EXISTS calendar_events_date_idx ON public.calendar_events (event_date);
CREATE INDEX IF NOT EXISTS calendar_events_type_idx ON public.calendar_events (event_type);
CREATE INDEX IF NOT EXISTS calendar_events_priority_idx ON public.calendar_events (priority);
CREATE INDEX IF NOT EXISTS calendar_events_status_idx ON public.calendar_events (status);
CREATE INDEX IF NOT EXISTS calendar_events_assigned_idx ON public.calendar_events (assigned_to);
CREATE INDEX IF NOT EXISTS calendar_events_dj_idx ON public.calendar_events (dj_user_id);

-- Índice compuesto para consultas por club y fecha
CREATE INDEX IF NOT EXISTS calendar_events_club_date_idx ON public.calendar_events (club_id, event_date);

-- 02.2) Trigger de updated_at
DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 03) Función para auto-crear eventos de sábados sin DJ
CREATE OR REPLACE FUNCTION public.fn_create_saturday_dj_check(
  p_club_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_date date;
  v_created_count integer := 0;
BEGIN
  -- Iterar por cada sábado en el rango
  FOR v_current_date IN
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date
    WHERE EXTRACT(dow FROM generate_series(p_start_date, p_end_date, '1 day'::interval)) = 6 -- 6 = sábado
  LOOP
    -- Verificar si ya existe un evento para este sábado
    IF NOT EXISTS (
      SELECT 1 FROM public.calendar_events
      WHERE club_id = p_club_id
        AND event_date = v_current_date
        AND event_type = 'dj_missing'
    ) THEN
      -- Crear evento de verificación de DJ
      INSERT INTO public.calendar_events (
        club_id,
        title,
        description,
        event_type,
        event_date,
        priority,
        needs_dj,
        dj_assigned,
        created_by
      ) VALUES (
        p_club_id,
        'Verificar DJ para sábado',
        'Confirmar que hay DJ asignado para la noche del sábado',
        'dj_missing',
        v_current_date,
        'high',
        true,
        false,
        auth.uid()
      );

      v_created_count := v_created_count + 1;
    END IF;
  END LOOP;

  RETURN v_created_count;
END;
$$;

-- 04) Función para marcar tarea como completada
CREATE OR REPLACE FUNCTION public.fn_complete_task(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  -- Verificar que el evento pertenece al club del admin
  SELECT club_id INTO v_club_id
  FROM public.calendar_events
  WHERE id = p_event_id;

  -- Verificar permisos
  IF v_club_id != fn_current_admin_club_id() THEN
    RETURN false;
  END IF;

  -- Actualizar estado
  UPDATE public.calendar_events
  SET
    is_completed = true,
    status = 'completed',
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_event_id;

  RETURN FOUND;
END;
$$;

-- 05) Función para obtener eventos del mes
CREATE OR REPLACE FUNCTION public.fn_get_calendar_events(
  p_year integer,
  p_month integer
)
RETURNS SETOF public.calendar_events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.calendar_events
  WHERE club_id = fn_current_admin_club_id()
    AND EXTRACT(year FROM event_date) = p_year
    AND EXTRACT(month FROM event_date) = p_month
  ORDER BY event_date, start_time NULLS LAST;
$$;

-- 06) Vista para eventos con información del usuario asignado
CREATE OR REPLACE VIEW public.calendar_events_with_assignee AS
SELECT
  ce.*,
  u.email as assigned_email,
  e.full_name as assigned_name,
  dj.email as dj_email,
  dj_emp.full_name as dj_name
FROM public.calendar_events ce
LEFT JOIN auth.users u ON u.id = ce.assigned_to
LEFT JOIN public.employees e ON e.user_id = ce.assigned_to
LEFT JOIN auth.users dj ON dj.id = ce.dj_user_id
LEFT JOIN public.employees dj_emp ON dj_emp.user_id = ce.dj_user_id;

-- 06.1) RLS en la vista
ALTER VIEW public.calendar_events_with_assignee SET (security_invoker = on);

-- 07) Habilitar RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- 08) Políticas RLS

-- 08.1) Service role puede todo
CREATE POLICY calendar_events_all_service_role
  ON public.calendar_events
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- 08.2) Admins pueden ver eventos de su club
CREATE POLICY calendar_events_select_my_club
  ON public.calendar_events
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

-- 08.3) Admins pueden crear eventos para su club
CREATE POLICY calendar_events_insert_my_club
  ON public.calendar_events
  FOR INSERT
  TO authenticated
  WITH CHECK ( club_id = fn_current_admin_club_id() );

-- 08.4) Admins pueden actualizar eventos de su club
CREATE POLICY calendar_events_update_my_club
  ON public.calendar_events
  FOR UPDATE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() )
  WITH CHECK ( club_id = fn_current_admin_club_id() );

-- 08.5) Admins pueden eliminar eventos de su club
CREATE POLICY calendar_events_delete_my_club
  ON public.calendar_events
  FOR DELETE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

-- 08.6) Empleados pueden ver eventos de su club
CREATE POLICY calendar_events_employee_select
  ON public.calendar_events
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_employee_club_id()
    OR club_id = fn_current_admin_club_id()
  );

-- 08.7) Empleados pueden actualizar solo sus tareas asignadas
CREATE POLICY calendar_events_employee_update_assigned
  ON public.calendar_events
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    AND club_id = fn_current_employee_club_id()
  )
  WITH CHECK (
    assigned_to = auth.uid()
    AND club_id = fn_current_employee_club_id()
  );

-- 09) Función RPC para crear eventos desde la app
CREATE OR REPLACE FUNCTION public.create_calendar_event(
  p_title text,
  p_event_date date,
  p_description text DEFAULT NULL,
  p_event_type calendar_event_type DEFAULT 'task',
  p_priority task_priority DEFAULT 'medium',
  p_start_time time DEFAULT NULL,
  p_end_time time DEFAULT NULL,
  p_all_day boolean DEFAULT true,
  p_assigned_to uuid DEFAULT NULL,
  p_needs_dj boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_club_id uuid;
BEGIN
  -- Obtener club del admin
  v_club_id := fn_current_admin_club_id();

  -- Verificar que es admin
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo admins pueden crear eventos';
  END IF;

  -- Crear el evento
  INSERT INTO public.calendar_events (
    club_id,
    title,
    description,
    event_type,
    event_date,
    priority,
    start_time,
    end_time,
    all_day,
    assigned_to,
    needs_dj,
    created_by
  ) VALUES (
    v_club_id,
    p_title,
    p_description,
    p_event_type,
    p_event_date,
    p_priority,
    p_start_time,
    p_end_time,
    p_all_day,
    p_assigned_to,
    p_needs_dj,
    auth.uid()
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- 10) Comentarios sobre el uso
/*
EJEMPLOS DE USO:

-- Crear tarea normal
SELECT create_calendar_event(
  'Revisar sistema de sonido',
  '2024-03-15',
  'Verificar que todos los equipos funcionen correctamente',
  'task',
  'high'
);

-- Crear verificación de DJ para sábados del mes
SELECT fn_create_saturday_dj_check(
  'club-uuid',
  '2024-03-01',
  '2024-03-31'
);

-- Marcar tarea como completada
SELECT fn_complete_task('event-uuid');

-- Obtener eventos del mes actual
SELECT * FROM fn_get_calendar_events(2024, 3);

COLORES POR PRIORIDAD:
- high (rojo): #EF4444 / bg-red-500
- medium (azul): #3B82F6 / bg-blue-500
- low (amarillo): #EAB308 / bg-yellow-500

TIPOS DE EVENTOS:
- task: Tarea general
- dj_missing: Sábado sin DJ
- event: Evento del club
- maintenance: Mantenimiento
- meeting: Reunión
- other: Otros
*/