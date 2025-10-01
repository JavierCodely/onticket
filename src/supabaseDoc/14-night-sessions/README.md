# Sistema de Inicio y Cierre de Noche

Este directorio contiene la implementación completa del sistema de control de inicio/cierre de noche para OnTicket.

## Descripción General

El sistema permite a los administradores registrar el stock de inicio y cierre de cada noche para calcular automáticamente las ventas totales por producto, proporcionando un control detallado del inventario y las operaciones nocturnas.

## Estructura de Archivos

- `001-night-sessions-schema.sql` - Esquema completo de sesiones de noche con RLS

## Características Principales

### Sesiones de Noche
- Registro de fecha y hora de inicio/cierre de cada noche
- Una sesión por día por club
- Estados: `open` (abierta) y `closed` (cerrada)
- Control de quién inició y cerró la sesión

### Control de Stock
- Captura automática del stock de todos los productos activos al iniciar la noche
- Captura del stock final al cerrar la noche
- Cálculo automático de unidades vendidas (stock inicio - stock cierre)
- Productos con 0 ventas se registran automáticamente

### Filtrado y Consultas
- Filtrado por rango de fechas
- Consulta de sesiones abiertas
- Resumen detallado por sesión con todos los productos

### Seguridad
- Row Level Security (RLS) implementado
- Solo administradores pueden iniciar/cerrar sesiones
- Cada club solo ve sus propias sesiones

## Permisos por Rol

### Administradores
- ✅ Iniciar sesión de noche
- ✅ Cerrar sesión de noche
- ✅ Ver todas las sesiones de su club
- ✅ Filtrar por fechas
- ✅ Ver resumen de ventas por sesión

### Empleados
- ❌ Sin acceso a este sistema

## Tipos de Datos

### Estados de Sesión
- `open` - Sesión iniciada (stock de inicio capturado)
- `closed` - Sesión cerrada (stock de cierre capturado, ventas calculadas)

## Tablas Principales

### `night_sessions`
Registra cada sesión de noche con:
- `session_date` - Fecha de la noche
- `status` - Estado (open/closed)
- `started_at` - Timestamp de inicio
- `closed_at` - Timestamp de cierre
- `started_by` - Usuario que inició
- `closed_by` - Usuario que cerró

### `night_session_products`
Registra el stock de cada producto por sesión:
- `opening_stock` - Stock al inicio de la noche
- `closing_stock` - Stock al final de la noche
- `total_sold` - Ventas calculadas (generado automáticamente)

## Funciones Principales

### `fn_start_night_session(p_session_date)`
Inicia una nueva sesión de noche capturando el stock actual de todos los productos activos.

**Parámetros:**
- `p_session_date` - Fecha de la sesión (default: fecha actual)

**Validaciones:**
- Solo un admin puede iniciar
- No puede haber otra sesión para la misma fecha
- Captura solo productos activos

**Retorna:** UUID de la sesión creada

### `fn_close_night_session(p_session_id)`
Cierra una sesión de noche capturando el stock final y calculando ventas.

**Parámetros:**
- `p_session_id` - ID de la sesión a cerrar

**Validaciones:**
- Solo un admin puede cerrar
- La sesión debe estar abierta
- La sesión debe pertenecer al club del admin

**Retorna:** Boolean indicando éxito

### `fn_get_night_session_summary(p_session_id)`
Obtiene un resumen detallado de una sesión con todos los productos.

**Parámetros:**
- `p_session_id` - ID de la sesión

**Retorna:** Tabla con:
- product_id, product_name, product_category
- opening_stock, closing_stock, total_sold

## Vista Calculada

### `night_sessions_with_products`
Vista que combina sesiones con sus productos, mostrando:
- Información completa de la sesión
- Detalles de cada producto incluido
- Stocks de inicio, cierre y ventas calculadas

## Flujo de Uso

1. **Iniciar Noche**
   - Admin hace clic en "Iniciar Noche"
   - Sistema captura automáticamente el stock actual de todos los productos activos
   - Botón cambia a "Cerrar Noche"

2. **Durante la Noche**
   - Las ventas se realizan normalmente
   - El stock se actualiza en tiempo real

3. **Cerrar Noche**
   - Admin hace clic en "Cerrar Noche"
   - Sistema captura el stock final
   - Calcula automáticamente las ventas (inicio - cierre)
   - Productos sin cambios muestran 0 en ventas

## Ejemplos de Uso

### Iniciar una Sesión de Noche
```sql
-- Iniciar noche para hoy
SELECT fn_start_night_session();

-- Iniciar noche para una fecha específica
SELECT fn_start_night_session('2025-10-15');
```

### Cerrar una Sesión
```sql
SELECT fn_close_night_session('session-uuid');
```

### Consultar Sesiones
```sql
-- Ver todas las sesiones del club
SELECT * FROM night_sessions
WHERE club_id = fn_current_admin_club_id()
ORDER BY session_date DESC;

-- Ver sesión abierta actual
SELECT * FROM night_sessions
WHERE club_id = fn_current_admin_club_id()
  AND status = 'open';

-- Filtrar por rango de fechas
SELECT * FROM night_sessions
WHERE club_id = fn_current_admin_club_id()
  AND session_date BETWEEN '2025-10-01' AND '2025-10-31'
ORDER BY session_date DESC;
```

### Obtener Resumen de una Sesión
```sql
SELECT * FROM fn_get_night_session_summary('session-uuid');
```

### Ver Sesiones con Productos
```sql
SELECT * FROM night_sessions_with_products
WHERE club_id = fn_current_admin_club_id()
  AND session_date = '2025-10-01';
```

## Características de Seguridad

- ✅ RLS habilitado en todas las tablas
- ✅ Solo admins tienen acceso
- ✅ Validación de pertenencia al club
- ✅ Una sesión por día por club
- ✅ No se puede cerrar una sesión ya cerrada
- ✅ Stock de cierre no puede exceder stock de inicio

## Realtime

Las tablas están configuradas para actualizaciones en tiempo real, permitiendo que múltiples usuarios vean cambios instantáneamente.
