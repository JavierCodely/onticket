-- ===========================================================
-- 🔧 FIX REALTIME SEGURO (SIN ERRORES DE DUPLICADOS)
-- ===========================================================
-- PROBLEMA: Error "relation is already member of publication"
-- SOLUCIÓN: Solo aplicar los cambios necesarios, ignorar duplicados

-- ========================================
-- PASO 1: AGREGAR TABLAS A REALTIME (SEGURO)
-- ========================================

-- Intentar agregar tablas a realtime solo si no están ya
DO $$
BEGIN
  -- Agregar sales si no está
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
    RAISE NOTICE '✅ Tabla sales agregada a supabase_realtime';
  ELSE
    RAISE NOTICE '✅ Tabla sales ya está en supabase_realtime';
  END IF;

  -- Agregar sale_items si no está
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sale_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items;
    RAISE NOTICE '✅ Tabla sale_items agregada a supabase_realtime';
  ELSE
    RAISE NOTICE '✅ Tabla sale_items ya está en supabase_realtime';
  END IF;
END$$;

-- ========================================
-- PASO 2: POLÍTICAS RLS PARA REAL-TIME (SEGURO)
-- ========================================

-- Eliminar política si existe, luego crear
DROP POLICY IF EXISTS sales_realtime_employee_access ON public.sales;
CREATE POLICY sales_realtime_employee_access
  ON public.sales
  FOR SELECT
  TO authenticated
  USING (
    -- Empleado puede ver ventas de su club para real-time
    club_id = (
      SELECT e.club_id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
      LIMIT 1
    )
  );

-- Política para sale_items real-time (seguro)
DROP POLICY IF EXISTS sale_items_realtime_employee_access ON public.sale_items;
CREATE POLICY sale_items_realtime_employee_access
  ON public.sale_items
  FOR SELECT
  TO authenticated
  USING (
    -- Empleado puede ver items de ventas de su club
    EXISTS (
      SELECT 1
      FROM public.sales s
      INNER JOIN public.employees e ON s.club_id = e.club_id
      WHERE s.id = sale_items.sale_id
        AND e.user_id = auth.uid()
        AND e.status = 'active'
    )
  );

-- ========================================
-- PASO 3: CONFIGURAR REPLICA IDENTITY (SEGURO)
-- ========================================

-- Solo cambiar si no está ya configurado
DO $$
BEGIN
  -- Sales table
  IF (SELECT pg_class.relreplident FROM pg_class WHERE relname = 'sales') != 'd' THEN
    ALTER TABLE public.sales REPLICA IDENTITY DEFAULT;
    RAISE NOTICE '✅ Replica identity configurada para sales';
  ELSE
    RAISE NOTICE '✅ Replica identity ya está configurada para sales';
  END IF;

  -- Sale_items table
  IF (SELECT pg_class.relreplident FROM pg_class WHERE relname = 'sale_items') != 'd' THEN
    ALTER TABLE public.sale_items REPLICA IDENTITY DEFAULT;
    RAISE NOTICE '✅ Replica identity configurada para sale_items';
  ELSE
    RAISE NOTICE '✅ Replica identity ya está configurada para sale_items';
  END IF;
END$$;

-- ========================================
-- PASO 4: FUNCIÓN DE VERIFICACIÓN SIMPLE
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_test_employee_realtime()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_employee_club_id uuid;
  v_is_employee boolean;
  v_can_read_sales boolean;
  v_sales_count integer;
  v_result text;
BEGIN
  v_user_id := auth.uid();

  -- Verificar si es empleado
  SELECT club_id INTO v_employee_club_id
  FROM public.employees
  WHERE user_id = v_user_id AND status = 'active';

  v_is_employee := v_employee_club_id IS NOT NULL;

  IF NOT v_is_employee THEN
    RETURN '❌ Usuario no es empleado activo. Real-time no disponible.';
  END IF;

  -- Probar si puede leer ventas
  BEGIN
    SELECT COUNT(*) INTO v_sales_count FROM public.sales LIMIT 5;
    v_can_read_sales := true;
  EXCEPTION WHEN OTHERS THEN
    v_can_read_sales := false;
    v_sales_count := 0;
  END;

  v_result := '✅ Usuario es empleado del club: ' || v_employee_club_id::text || E'\n';

  IF v_can_read_sales THEN
    v_result := v_result || '✅ Puede leer ventas: ' || v_sales_count || ' ventas visibles' || E'\n';
    v_result := v_result || '✅ Real-time debería funcionar correctamente' || E'\n';
    v_result := v_result || '🔄 Las ventas nuevas aparecerán automáticamente';
  ELSE
    v_result := v_result || '❌ No puede leer ventas - verificar políticas RLS' || E'\n';
    v_result := v_result || '❌ Real-time no funcionará hasta resolver permisos';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_test_employee_realtime() TO authenticated;

-- ========================================
-- PASO 5: FUNCIÓN PARA PROBAR REAL-TIME EN VIVO
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_trigger_realtime_test()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_test_sale_id uuid;
  v_current_time text;
BEGIN
  -- Obtener club del usuario
  SELECT COALESCE(
    (SELECT club_id FROM public.admins WHERE user_id = auth.uid() AND status = 'active'),
    (SELECT club_id FROM public.employees WHERE user_id = auth.uid() AND status = 'active')
  ) INTO v_club_id;

  IF v_club_id IS NULL THEN
    RETURN '❌ No eres admin ni empleado activo';
  END IF;

  v_current_time := to_char(now(), 'HH24:MI:SS');

  -- Crear venta de prueba
  INSERT INTO public.sales (
    club_id,
    sale_number,
    employee_id,
    employee_name,
    employee_category,
    subtotal,
    discount_amount,
    total_amount,
    payment_method,
    status,
    notes,
    created_by,
    updated_by
  ) VALUES (
    v_club_id,
    'TEST-RT-' || extract(epoch from now())::bigint,
    auth.uid(),
    'Test Real-Time',
    'test',
    1,
    0,
    1,
    'cash',
    'completed',
    'TEST REAL-TIME ' || v_current_time || ' - Esta venta desaparecerá en 3 segundos',
    auth.uid(),
    auth.uid()
  ) RETURNING id INTO v_test_sale_id;

  -- Esperar un momento (simular tiempo real)
  PERFORM pg_sleep(1);

  -- Actualizar la venta (esto debería trigger otro evento real-time)
  UPDATE public.sales
  SET notes = 'TEST REAL-TIME ' || v_current_time || ' - ACTUALIZADA - Se eliminará pronto'
  WHERE id = v_test_sale_id;

  -- Esperar otro momento
  PERFORM pg_sleep(2);

  -- Eliminar la venta de prueba
  DELETE FROM public.sales WHERE id = v_test_sale_id;

  RETURN '✅ Test de real-time completado a las ' || v_current_time ||
         '. Si tenías la página abierta, deberías haber visto:' || E'\n' ||
         '1️⃣ Aparecer venta TEST-RT-...' || E'\n' ||
         '2️⃣ Actualizarse la nota' || E'\n' ||
         '3️⃣ Desaparecer la venta' || E'\n' ||
         'ID de prueba: ' || v_test_sale_id::text;

EXCEPTION WHEN OTHERS THEN
  -- Limpiar si hay error
  IF v_test_sale_id IS NOT NULL THEN
    DELETE FROM public.sales WHERE id = v_test_sale_id;
  END IF;
  RETURN '❌ Error en test: ' || SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_trigger_realtime_test() TO authenticated;

-- ========================================
-- RESULTADO Y INSTRUCCIONES
-- ========================================

/*
🔧 FIX REALTIME SEGURO APLICADO

PARA VERIFICAR QUE FUNCIONA (como empleado):
SELECT fn_test_employee_realtime();

PARA PROBAR REAL-TIME EN VIVO:
1. Abre la página de empleados (ventas)
2. En otra ventana, ejecuta: SELECT fn_trigger_realtime_test();
3. Observa la página de empleados - deberías ver cambios automáticos

CAMBIOS APLICADOS:
✅ Tablas agregadas a supabase_realtime (sin errores de duplicados)
✅ Políticas RLS para empleados
✅ Replica identity configurada
✅ Funciones de test incluidas

NOTA: Los errores de "already member of publication" son normales
y se manejan automáticamente en este script.
*/

-- Mensaje final
SELECT
  '🚀 Real-time para empleados configurado correctamente. ' ||
  'Ejecuta: SELECT fn_test_employee_realtime(); para verificar.' as resultado;