-- ===========================================================
-- 🧪 TEST COMPLETO: ACTUALIZACIONES DE STOCK CROSS-USER
-- ===========================================================
-- OBJETIVO: Verificar que admin → empleado reciben actualizaciones real-time

-- ========================================
-- FUNCIÓN DE TEST COMPLETA
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_test_admin_employee_stock_sync()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_test_product_id uuid;
  v_product_name text;
  v_initial_stock integer;
  v_test_stock_1 integer;
  v_test_stock_2 integer;
  v_current_time text;
  v_user_role text;
BEGIN
  -- Obtener club e info del usuario actual
  SELECT COALESCE(
    (SELECT club_id FROM public.admins WHERE user_id = auth.uid() AND status = 'active'),
    (SELECT club_id FROM public.employees WHERE user_id = auth.uid() AND status = 'active')
  ) INTO v_club_id;

  IF v_club_id IS NULL THEN
    RETURN '❌ No eres admin ni empleado activo';
  END IF;

  -- Determinar rol
  IF EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND status = 'active') THEN
    v_user_role := 'admin';
  ELSE
    v_user_role := 'employee';
  END IF;

  v_current_time := to_char(now(), 'HH24:MI:SS');

  -- Buscar producto para test
  SELECT p.id, p.name INTO v_test_product_id, v_product_name
  FROM public.products p
  WHERE p.club_id = v_club_id
    AND p.status = 'active'
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_test_product_id IS NULL THEN
    RETURN '❌ No hay productos activos en tu club para probar';
  END IF;

  -- Obtener stock actual
  SELECT COALESCE(available_stock, 0) INTO v_initial_stock
  FROM public.product_stock
  WHERE product_id = v_test_product_id;

  -- Calcular stocks de prueba
  v_test_stock_1 := GREATEST(0, v_initial_stock - 5); -- Reducir stock
  v_test_stock_2 := v_initial_stock + 15; -- Aumentar stock

  -- === SECUENCIA DE PRUEBAS ===

  -- 1. Reducir stock (simular venta o ajuste)
  INSERT INTO public.product_stock (product_id, available_stock, reserved_stock)
  VALUES (v_test_product_id, v_test_stock_1, 0)
  ON CONFLICT (product_id)
  DO UPDATE SET
    available_stock = v_test_stock_1,
    updated_at = NOW();

  -- Pausa para observar cambio
  PERFORM pg_sleep(2);

  -- 2. Aumentar stock significativamente (simular restock)
  INSERT INTO public.product_stock (product_id, available_stock, reserved_stock)
  VALUES (v_test_product_id, v_test_stock_2, 0)
  ON CONFLICT (product_id)
  DO UPDATE SET
    available_stock = v_test_stock_2,
    updated_at = NOW();

  -- Pausa para observar cambio
  PERFORM pg_sleep(2);

  -- 3. Poner stock en 0 (producto sin stock)
  INSERT INTO public.product_stock (product_id, available_stock, reserved_stock)
  VALUES (v_test_product_id, 0, 0)
  ON CONFLICT (product_id)
  DO UPDATE SET
    available_stock = 0,
    updated_at = NOW();

  -- Pausa para observar que desaparece
  PERFORM pg_sleep(2);

  -- 4. Restaurar stock original
  INSERT INTO public.product_stock (product_id, available_stock, reserved_stock)
  VALUES (v_test_product_id, v_initial_stock, 0)
  ON CONFLICT (product_id)
  DO UPDATE SET
    available_stock = v_initial_stock,
    updated_at = NOW();

  RETURN '✅ TEST COMPLETO de sincronización admin-empleado (' || v_user_role || ') - ' || v_current_time || E'\n' ||
         'Producto: ' || v_product_name || ' (' || v_test_product_id::text || ')' || E'\n' ||
         'Secuencia ejecutada:' || E'\n' ||
         '1️⃣ Stock: ' || v_initial_stock || ' → ' || v_test_stock_1 || ' (reducción)' || E'\n' ||
         '2️⃣ Stock: ' || v_test_stock_1 || ' → ' || v_test_stock_2 || ' (aumento)' || E'\n' ||
         '3️⃣ Stock: ' || v_test_stock_2 || ' → 0 (sin stock)' || E'\n' ||
         '4️⃣ Stock: 0 → ' || v_initial_stock || ' (restaurado)' || E'\n' ||
         E'\n' ||
         '🔍 Si tenías el modal de ventas abierto, deberías haber visto:' || E'\n' ||
         '• Producto aparecer/desaparecer según stock' || E'\n' ||
         '• Promociones activarse/desactivarse automáticamente' || E'\n' ||
         '• Cambios sin necesidad de borrar/escribir en búsqueda';

EXCEPTION WHEN OTHERS THEN
  -- Restaurar en caso de error
  BEGIN
    INSERT INTO public.product_stock (product_id, available_stock, reserved_stock)
    VALUES (v_test_product_id, v_initial_stock, 0)
    ON CONFLICT (product_id)
    DO UPDATE SET
      available_stock = v_initial_stock,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar errores de restauración
  END;

  RETURN '❌ Error en test: ' || SQLERRM || E'\n' ||
         'Stock restaurado automáticamente.';
END;
$$;

-- ========================================
-- FUNCIÓN PARA CREAR PRODUCTO DE PRUEBA
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_create_test_product_for_realtime()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_product_id uuid;
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

  -- Crear producto de prueba
  INSERT INTO public.products (
    club_id,
    name,
    sku,
    category,
    cost_price,
    sale_price,
    status,
    created_by,
    updated_by
  ) VALUES (
    v_club_id,
    'TEST Real-Time ' || v_current_time,
    'TEST-RT-' || extract(epoch from now())::bigint,
    'beverage',
    5.00,
    10.00,
    'active',
    auth.uid(),
    auth.uid()
  ) RETURNING id INTO v_product_id;

  -- Crear stock inicial
  INSERT INTO public.product_stock (product_id, available_stock, reserved_stock)
  VALUES (v_product_id, 20, 0);

  RETURN '✅ Producto de prueba creado: TEST Real-Time ' || v_current_time || E'\n' ||
         'ID: ' || v_product_id::text || E'\n' ||
         'Stock inicial: 20 unidades' || E'\n' ||
         'Precio: $5.00 → $10.00' || E'\n' ||
         E'\n' ||
         'Ahora puedes:' || E'\n' ||
         '1. Abrir modal de ventas' || E'\n' ||
         '2. Ejecutar: SELECT fn_test_admin_employee_stock_sync();' || E'\n' ||
         '3. Observar cambios en tiempo real';

EXCEPTION WHEN OTHERS THEN
  RETURN '❌ Error creando producto de prueba: ' || SQLERRM;
END;
$$;

-- ========================================
-- FUNCIÓN PARA LIMPIAR PRODUCTOS DE PRUEBA
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_cleanup_test_products()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_deleted_count integer;
BEGIN
  -- Obtener club del usuario
  SELECT COALESCE(
    (SELECT club_id FROM public.admins WHERE user_id = auth.uid() AND status = 'active'),
    (SELECT club_id FROM public.employees WHERE user_id = auth.uid() AND status = 'active')
  ) INTO v_club_id;

  IF v_club_id IS NULL THEN
    RETURN '❌ No eres admin ni empleado activo';
  END IF;

  -- Eliminar stock de productos de prueba
  DELETE FROM public.product_stock
  WHERE product_id IN (
    SELECT id FROM public.products
    WHERE club_id = v_club_id AND name LIKE 'TEST Real-Time%'
  );

  -- Eliminar productos de prueba
  DELETE FROM public.products
  WHERE club_id = v_club_id AND name LIKE 'TEST Real-Time%';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN '✅ Limpieza completada: ' || v_deleted_count || ' productos de prueba eliminados.';

EXCEPTION WHEN OTHERS THEN
  RETURN '❌ Error en limpieza: ' || SQLERRM;
END;
$$;

-- ========================================
-- OTORGAR PERMISOS
-- ========================================

GRANT EXECUTE ON FUNCTION public.fn_test_admin_employee_stock_sync() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_test_product_for_realtime() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cleanup_test_products() TO authenticated;

-- ========================================
-- INSTRUCCIONES DE USO
-- ========================================

/*
🧪 TESTS DE SINCRONIZACIÓN ADMIN-EMPLEADO LISTOS

SECUENCIA DE PRUEBA COMPLETA:

1. PREPARACIÓN:
   SELECT fn_create_test_product_for_realtime();

2. ABRIR DOS VENTANAS:
   - Ventana A: Admin (gestión de productos/stock)
   - Ventana B: Empleado (modal de ventas)

3. EJECUTAR TEST (desde cualquier ventana):
   SELECT fn_test_admin_employee_stock_sync();

4. OBSERVAR EN VENTANA B (empleado):
   - Producto aparece/desaparece automáticamente
   - Stock se actualiza en tiempo real
   - Búsqueda se actualiza sin interacción

5. LIMPIAR DESPUÉS:
   SELECT fn_cleanup_test_products();

RESULTADO ESPERADO:
✅ Empleado ve cambios de stock instantáneamente
✅ Productos con stock=0 desaparecen automáticamente
✅ Productos con stock>0 aparecen automáticamente
✅ Promociones se activan/desactivan según stock
✅ No necesidad de refresh manual

CASOS DE USO REALES:
- Admin ajusta inventario → Empleado ve cambios inmediatos
- Admin agrega stock → Producto aparece automáticamente para venta
- Admin pone stock=0 → Producto desaparece de opciones de venta
*/

-- Mensaje final
SELECT '🧪 Tests de sincronización admin-empleado configurados. Ejecuta: SELECT fn_create_test_product_for_realtime(); para empezar.' as resultado;