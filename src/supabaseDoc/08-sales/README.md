# Sistema de Ventas en Tiempo Real

Este directorio contiene la implementación completa del sistema de ventas con actualizaciones en tiempo real para OnTicket.

## Descripción General

El sistema registra todas las ventas realizadas por empleados, actualiza automáticamente el stock de productos y envía notificaciones en tiempo real para monitoreo inmediato.

## Estructura de Archivos

- `001-sales-schema.sql` - Esquema completo de ventas con notificaciones en tiempo real

## Características Principales

### Ventas
- Registro completo de transacciones
- Múltiples métodos de pago
- Tracking por empleado y fecha/hora
- Numeración automática de ventas

### Items de Venta
- Detalle de productos vendidos
- Precios al momento de la venta
- Cálculo automático de subtotales

### Tiempo Real
- Notificaciones automáticas de nuevas ventas
- Actualización inmediata de stock
- Estadísticas en vivo

### Seguridad
- Row Level Security (RLS) por club
- Solo empleados autorizados pueden crear ventas
- Historial completo e inmutable

## Métodos de Pago

- `cash` - Efectivo
- `transfer` - Transferencia bancaria
- `credit` - Tarjeta de crédito
- `debit` - Tarjeta de débito

## Estados de Venta

- `completed` - Venta completada
- `cancelled` - Venta cancelada

## Funciones Principales

### `fn_create_sale()`
Crea una venta completa con validaciones y actualización de stock.

**Parámetros:**
- `p_club_id` - ID del club
- `p_employee_name` - Nombre del empleado
- `p_payment_method` - Método de pago
- `p_items` - Array de items (product_id, quantity, price)

**Proceso:**
1. Valida stock disponible
2. Crea la venta principal
3. Inserta items de venta
4. Actualiza stock automáticamente
5. Envía notificación en tiempo real

### `fn_get_today_sales()`
Obtiene todas las ventas del día actual con detalles completos.

**Retorna:**
- Información de venta
- Nombre del empleado
- Método de pago
- Total de items
- Timestamp completo

### `fn_get_sales_stats()`
Calcula estadísticas de ventas para un período específico.

**Parámetros:**
- `p_club_id` - ID del club
- `p_start_date` - Fecha de inicio
- `p_end_date` - Fecha de fin

**Estadísticas incluidas:**
- Total de ventas y cantidad
- Promedio por venta
- Desglose por método de pago
- Top empleados
- Ventas por hora
- Conteo de empleados activos

## Notificaciones en Tiempo Real

### `notify_new_sale()`
Trigger que envía notificación PostgreSQL cuando se crea una nueva venta.

**Canal:** `new_sale_${club_id}`
**Payload:** JSON con datos de la venta

### Suscripción en Frontend
```typescript
// El hook useSales se suscribe automáticamente
const { todaySales } = useSales();
```

## Triggers

### `tr_notify_new_sale`
Se ejecuta después de insertar una nueva venta para enviar notificación en tiempo real.

### `tr_update_product_stock_on_sale`
Se ejecuta después de insertar items de venta para actualizar el stock automáticamente.

## Permisos por Rol

### Administradores
- ✅ Ver todas las ventas
- ✅ Crear ventas
- ✅ Ver estadísticas completas
- ✅ Acceso a reportes históricos

### Empleados (Bartender/Cajero)
- ✅ Crear ventas
- ✅ Ver ventas propias del día
- ❌ Ver ventas de otros empleados
- ❌ Modificar ventas existentes

## Ejemplos de Uso

### Crear una Venta
```sql
SELECT fn_create_sale(
  'club-uuid',
  'Juan Pérez',
  'cash',
  '[
    {"product_id": "prod-1", "quantity": 2, "price": 4000.00},
    {"product_id": "prod-2", "quantity": 1, "price": 1500.00}
  ]'::jsonb
);
```

### Obtener Ventas de Hoy
```sql
SELECT * FROM fn_get_today_sales('club-uuid');
```

### Obtener Estadísticas del Mes
```sql
SELECT * FROM fn_get_sales_stats(
  'club-uuid',
  '2024-01-01'::date,
  '2024-01-31'::date
);
```

### Suscribirse a Ventas en Tiempo Real
```sql
LISTEN new_sale_club_uuid;
```

## Integración Frontend

### Componentes Principales
- `SalesView` - Vista principal con filtros y estadísticas
- `TodaySalesCard` - Ventas del día en tiempo real
- `SalesList` - Lista histórica con filtros
- `SalesStats` - Estadísticas detalladas
- `NewSaleModal` - Formulario para nueva venta

### Hook Principal
```typescript
const {
  sales,           // Todas las ventas
  todaySales,      // Ventas de hoy (tiempo real)
  stats,           // Estadísticas calculadas
  createSale,      // Función para crear venta
  filterSales      // Función para filtrar
} = useSales();
```

## Reportes y Análisis

### Métricas Disponibles
- Total de ventas por período
- Promedio por transacción
- Rendimiento por empleado
- Distribución de métodos de pago
- Patrones de ventas por hora
- Productos más vendidos

### Exportación
Las funciones SQL permiten generar reportes que pueden ser exportados desde el frontend en formatos CSV, Excel o PDF.