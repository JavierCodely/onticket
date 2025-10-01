# Instrucciones de Implementación - Sistema Inicio/Cierre de Noche

## 📋 Resumen

Sistema completo de control de stock mediante sesiones de inicio y cierre de noche con filtrado por categoría de productos.

## 🗂️ Archivos Creados

### Base de Datos (Supabase)
1. `src/supabaseDoc/07-products-stock/004-update-product-categories.sql`
   - Actualiza categorías de productos
   - Agrega: vinos, cervezas, cocteles, vodka

2. `src/supabaseDoc/14-night-sessions/001-night-sessions-schema.sql`
   - Schema completo optimizado para Supabase
   - Tablas, vistas, funciones, RLS, realtime
   - Función de filtrado por categoría

### TypeScript
3. `src/core/types/database.ts`
   - Tipos actualizados con filtrado por categoría
   - Tipo ProductCategory con nuevas categorías

4. `src/features/night-sessions/services/nightSessionsService.ts`
   - Servicio con soporte de filtrado por categoría

5. `src/features/night-sessions/hooks/useNightSessions.ts`
   - Hook actualizado con dependencia de categoría

6. `src/features/night-sessions/components/NightSessionsPage.tsx`
   - UI con selector de categoría de productos

## 🚀 Pasos de Implementación

### 1. Ejecutar Scripts SQL en Supabase (EN ORDEN)

```sql
-- PASO 1: Actualizar categorías de productos
-- Ejecutar: src/supabaseDoc/07-products-stock/004-update-product-categories.sql
```

**Verificación:**
```sql
-- Verificar que las nuevas categorías existen
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'product_category'::regtype
ORDER BY enumlabel;
```

Deberías ver:
- bebidas_alcoholicas
- bebidas_sin_alcohol
- cervezas ✨ (nuevo)
- cigarrillos
- cocteles ✨ (nuevo)
- comida
- merchandising
- otros
- vinos ✨ (nuevo)
- vodka ✨ (nuevo)

```sql
-- PASO 2: Crear tablas de night sessions
-- Ejecutar: src/supabaseDoc/14-night-sessions/001-night-sessions-schema.sql
```

**Verificación:**
```sql
-- Verificar que las tablas se crearon
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'night_%';
```

Deberías ver:
- night_sessions
- night_session_products

```sql
-- Verificar que las funciones se crearon
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'fn_%night%';
```

Deberías ver:
- fn_start_night_session
- fn_close_night_session
- fn_get_night_session_summary
- fn_get_night_session_by_category ✨ (nuevo)

### 2. Verificar RLS (Row Level Security)

```sql
-- Verificar políticas RLS
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('night_sessions', 'night_session_products');
```

Deberías ver políticas para:
- SELECT, INSERT, UPDATE, DELETE para admins
- Políticas de service_role

### 3. Verificar Realtime

```sql
-- Verificar que las tablas están en realtime
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('night_sessions', 'night_session_products');
```

### 4. Probar Funciones

```sql
-- PRUEBA 1: Iniciar una sesión de noche
SELECT fn_start_night_session();
-- Debe retornar un UUID

-- PRUEBA 2: Ver sesión creada
SELECT * FROM night_sessions
WHERE club_id = fn_current_admin_club_id()
ORDER BY created_at DESC
LIMIT 1;

-- PRUEBA 3: Ver productos capturados
SELECT * FROM night_session_products
WHERE session_id = '<UUID_DE_LA_SESION>'
ORDER BY created_at;

-- PRUEBA 4: Cerrar sesión
SELECT fn_close_night_session('<UUID_DE_LA_SESION>');

-- PRUEBA 5: Ver resumen
SELECT * FROM fn_get_night_session_summary('<UUID_DE_LA_SESION>');

-- PRUEBA 6: Filtrar por categoría
SELECT * FROM fn_get_night_session_by_category('<UUID_DE_LA_SESION>', 'cervezas');
SELECT * FROM fn_get_night_session_by_category('<UUID_DE_LA_SESION>', 'vinos');
SELECT * FROM fn_get_night_session_by_category('<UUID_DE_LA_SESION>', 'vodka');
```

## 🎨 Frontend - Ya Implementado

El código frontend ya está completamente implementado y listo para usar:

### Características
✅ Página principal con tabla de sesiones
✅ Botón Iniciar/Cerrar Noche (estado dinámico)
✅ Filtros:
  - Fecha inicio
  - Fecha fin
  - Estado (abiertas/cerradas)
  - **Categoría de producto** ✨ (nuevo)

✅ Modal de detalles con lista completa de productos
✅ Realtime updates automáticos
✅ Notificaciones con Sonner
✅ Loading states y skeleton loaders
✅ Responsive design

### Uso del Filtro de Categoría

```typescript
// El usuario puede filtrar sesiones por categoría:
// - Todas (muestra todos los productos)
// - Vinos (solo productos de categoría 'vinos')
// - Cervezas (solo productos de categoría 'cervezas')
// - Cocteles (solo productos de categoría 'cocteles')
// - Vodka (solo productos de categoría 'vodka')
// - Otras Bebidas Alcohólicas
// - Bebidas Sin Alcohol
// - Comida
// - Cigarrillos
// - Merchandising
// - Otros
```

## 📊 Migración de Datos Existentes (Opcional)

Si ya tienes productos en la categoría genérica `bebidas_alcoholicas`, puedes migrarlos a las nuevas categorías:

```sql
-- Migrar cervezas
UPDATE products
SET category = 'cervezas'
WHERE category = 'bebidas_alcoholicas'
  AND (
    LOWER(name) LIKE '%cerveza%'
    OR LOWER(name) LIKE '%beer%'
    OR LOWER(name) LIKE '%brahma%'
    OR LOWER(name) LIKE '%quilmes%'
    OR LOWER(name) LIKE '%heineken%'
  );

-- Migrar vinos
UPDATE products
SET category = 'vinos'
WHERE category = 'bebidas_alcoholicas'
  AND (
    LOWER(name) LIKE '%vino%'
    OR LOWER(name) LIKE '%wine%'
    OR LOWER(name) LIKE '%malbec%'
    OR LOWER(name) LIKE '%cabernet%'
  );

-- Migrar vodka
UPDATE products
SET category = 'vodka'
WHERE category = 'bebidas_alcoholicas'
  AND LOWER(name) LIKE '%vodka%';

-- Migrar cocteles
UPDATE products
SET category = 'cocteles'
WHERE category = 'bebidas_alcoholicas'
  AND (
    LOWER(name) LIKE '%mojito%'
    OR LOWER(name) LIKE '%caipirinha%'
    OR LOWER(name) LIKE '%margarita%'
    OR LOWER(name) LIKE '%daiquiri%'
  );

-- Verificar migración
SELECT category, COUNT(*) as total
FROM products
GROUP BY category
ORDER BY category;
```

## ✅ Checklist de Implementación

- [ ] Ejecutar `004-update-product-categories.sql`
- [ ] Verificar nuevas categorías en pg_enum
- [ ] Ejecutar `001-night-sessions-schema.sql`
- [ ] Verificar tablas creadas
- [ ] Verificar funciones creadas
- [ ] Verificar políticas RLS
- [ ] Verificar realtime habilitado
- [ ] Probar iniciar sesión
- [ ] Probar cerrar sesión
- [ ] Probar filtrado por categoría
- [ ] (Opcional) Migrar productos existentes
- [ ] Probar frontend en el navegador
- [ ] Verificar filtros funcionan correctamente

## 🔧 Troubleshooting

### Error: "type already exists"
Si el enum `product_category` ya existe y no incluye las nuevas categorías, necesitas recrear el enum:

```sql
-- Opción 1: Si no tienes datos
DROP TYPE product_category CASCADE;
-- Luego ejecuta el script completo de nuevo

-- Opción 2: Si tienes datos (más seguro)
-- Solo usa ALTER TYPE ADD VALUE (como en el script 004)
```

### Error: "function already exists"
```sql
-- Eliminar función existente
DROP FUNCTION IF EXISTS fn_get_night_session_by_category;
-- Luego ejecuta el script de nuevo
```

### Error de RLS
```sql
-- Verificar que las funciones helper existen
SELECT * FROM fn_current_admin_club_id();
```

## 📝 Notas Adicionales

1. **Orden de Ejecución**: Es CRÍTICO ejecutar primero el script 004 (categorías) antes del script 001 (night sessions)

2. **Backup**: Antes de ejecutar los scripts en producción, hacer backup de la base de datos

3. **Testing**: Probar primero en un ambiente de desarrollo

4. **Categorías**: Las nuevas categorías son:
   - `vinos`: Vinos tintos, blancos, rosados, espumantes
   - `cervezas`: Cervezas nacionales e importadas
   - `cocteles`: Cocteles preparados
   - `vodka`: Vodka y sus derivados

5. **Filtrado**: El filtrado por categoría funciona tanto en el frontend (client-side) como en la base de datos (server-side con la función `fn_get_night_session_by_category`)

## 🎯 Resultado Final

Una vez implementado, tendrás:

✅ Sistema completo de inicio/cierre de noche
✅ 10 categorías de productos (4 nuevas)
✅ Filtrado multi-criterio (fecha, estado, categoría)
✅ Cálculo automático de ventas
✅ RLS para multi-tenancy
✅ Realtime updates
✅ UI intuitiva con shadcn/ui
✅ Compatible 100% con Supabase
