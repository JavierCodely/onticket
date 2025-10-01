-- ===========================================================
-- FUNCIONES RPC PARA DEBUGGING Y ACTUALIZACIONES
-- ===========================================================

-- 01) Función RPC para actualizar empleados con logging
CREATE OR REPLACE FUNCTION public.update_employee_status(
  p_user_id uuid,
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid;
  v_admin_club_id uuid;
  v_employee_club_id uuid;
  v_result jsonb;
  v_updated_employee public.employees;
BEGIN
  -- Obtener usuario actual
  v_current_user_id := auth.uid();

  -- Verificar que hay un usuario autenticado
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuario no autenticado'
    );
  END IF;

  -- Obtener club del admin
  SELECT club_id INTO v_admin_club_id
  FROM public.admins
  WHERE user_id = v_current_user_id AND status = 'active';

  -- Verificar que es admin
  IF v_admin_club_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuario no es admin activo'
    );
  END IF;

  -- Obtener club del empleado a actualizar
  SELECT club_id INTO v_employee_club_id
  FROM public.employees
  WHERE user_id = p_user_id;

  -- Verificar que el empleado existe
  IF v_employee_club_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Empleado no encontrado'
    );
  END IF;

  -- Verificar que pertenecen al mismo club
  IF v_admin_club_id != v_employee_club_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No puede actualizar empleado de otro club'
    );
  END IF;

  -- Realizar la actualización
  UPDATE public.employees
  SET
    status = COALESCE((p_updates->>'status')::employee_status, status),
    full_name = COALESCE(p_updates->>'full_name', full_name),
    phone = COALESCE(p_updates->>'phone', phone),
    category = COALESCE((p_updates->>'category')::employee_category, category),
    hourly_rate = COALESCE((p_updates->>'hourly_rate')::numeric, hourly_rate),
    hire_date = COALESCE((p_updates->>'hire_date')::date, hire_date),
    employee_number = COALESCE(p_updates->>'employee_number', employee_number),
    notes = COALESCE(p_updates->>'notes', notes),
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING * INTO v_updated_employee;

  -- Verificar que se actualizó
  IF v_updated_employee IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se pudo actualizar el empleado'
    );
  END IF;

  -- Retornar éxito con datos actualizados
  RETURN jsonb_build_object(
    'success', true,
    'data', row_to_json(v_updated_employee),
    'debug', jsonb_build_object(
      'current_user_id', v_current_user_id,
      'admin_club_id', v_admin_club_id,
      'employee_club_id', v_employee_club_id,
      'updates_applied', p_updates
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

-- 02) Función simple para toggle de status
CREATE OR REPLACE FUNCTION public.toggle_employee_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status employee_status;
  v_new_status employee_status;
  v_result jsonb;
BEGIN
  -- Obtener status actual
  SELECT status INTO v_current_status
  FROM public.employees
  WHERE user_id = p_user_id;

  -- Determinar nuevo status
  IF v_current_status = 'active' THEN
    v_new_status := 'inactive';
  ELSE
    v_new_status := 'active';
  END IF;

  -- Usar la función de actualización
  SELECT update_employee_status(
    p_user_id,
    jsonb_build_object('status', v_new_status)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 03) Función para obtener empleados con información extendida
CREATE OR REPLACE FUNCTION public.get_employees_with_debug()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_agg(
    jsonb_build_object(
      'employee', row_to_json(e),
      'club', row_to_json(c),
      'can_edit', EXISTS (
        SELECT 1 FROM public.admins a
        WHERE a.user_id = auth.uid()
          AND a.status = 'active'
          AND a.club_id = e.club_id
      )
    ) ORDER BY e.full_name
  )
  FROM public.employees e
  JOIN public.clubs c ON c.id = e.club_id
  WHERE e.club_id = fn_current_admin_club_id_temp();
$$;

-- 04) Función de test directo (para usar desde la consola)
CREATE OR REPLACE FUNCTION public.test_employee_update(
  p_user_id uuid,
  p_new_status employee_status DEFAULT 'inactive'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text;
BEGIN
  -- Bypass RLS y actualizar directamente
  UPDATE public.employees
  SET status = p_new_status, updated_at = NOW()
  WHERE user_id = p_user_id;

  IF FOUND THEN
    v_result := 'SUCCESS: Employee status updated to ' || p_new_status;
  ELSE
    v_result := 'ERROR: Employee not found or not updated';
  END IF;

  RETURN v_result;
END;
$$;

-- 05) Comentarios sobre uso:
/*
-- Para probar desde Supabase SQL Editor:

-- 1. Verificar permisos:
SELECT fn_debug_employee_permissions('UUID_DEL_EMPLEADO');

-- 2. Actualizar con RPC:
SELECT update_employee_status(
  'UUID_DEL_EMPLEADO',
  '{"status": "inactive"}'::jsonb
);

-- 3. Toggle status:
SELECT toggle_employee_status('UUID_DEL_EMPLEADO');

-- 4. Test directo (bypass RLS):
SELECT test_employee_update('UUID_DEL_EMPLEADO', 'active');

-- 5. Ver empleados con debug:
SELECT get_employees_with_debug();
*/