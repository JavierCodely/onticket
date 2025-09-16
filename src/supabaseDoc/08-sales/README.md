# Sistema de Ventas con Edición para Administradores

Este directorio contiene la implementación completa del sistema de ventas con actualizaciones en tiempo real y funcionalidad de edición para OnTicket.

## Descripción General

El sistema registra todas las ventas realizadas por empleados, actualiza automáticamente el stock de productos, envía notificaciones en tiempo real y permite a los administradores editar ventas existentes de manera segura.

## Estructura de Archivos

- `001-sales-schema.sql` - Esquema completo de ventas con notificaciones en tiempo real
- `002-sales-edit-schema.sql` - **NUEVO**: Extensiones para edición de ventas por administradores

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

## ✨ NUEVAS FUNCIONALIDADES DE EDICIÓN ✨

### Funciones de Edición (002-sales-edit-schema.sql)

#### `fn_update_sale()`
Actualiza información básica de una venta existente.

**Parámetros:**
- `p_sale_id`: ID de la venta a actualizar
- `p_employee_name`: Nuevo nombre del empleado (opcional)
- `p_payment_method`: Nuevo método de pago (opcional)
- `p_payment_details`: Detalles de pago (opcional)
- `p_discount_amount`: Nuevo monto de descuento (opcional)
- `p_notes`: Notas adicionales (opcional)
- `p_status`: Nuevo estado (opcional)
- `p_refund_reason`: Razón de reembolso (opcional)

#### `fn_add_sale_item()`
Agrega un nuevo item a una venta existente.

#### `fn_update_sale_item()`
Actualiza cantidad y/o precio de un item existente.

#### `fn_remove_sale_item()`
Elimina un item de una venta (no puede ser el último).

#### `fn_cancel_refund_sale()`
Cancela o reembolsa una venta completa restaurando stock.

### Nuevos Permisos de Edición

#### Administradores
- ✅ **NUEVO**: Editar cualquier venta de su club
- ✅ **NUEVO**: Cancelar/reembolsar ventas
- ✅ **NUEVO**: Agregar/eliminar/modificar items
- ✅ **NUEVO**: Cambiar estados de venta

#### Empleados (Bartenders/Cajeros)
- ⚠️ **NUEVO**: Editar sus propias ventas (solo 'pending'/'completed')
- ❌ No pueden cancelar/reembolsar
- ✅ **NUEVO**: Modificar items de sus propias ventas

### Nuevos Estados de Venta
- `pending` - Venta pendiente, totalmente editable
- `completed` - Venta completada, editable por admins
- `cancelled` - **NUEVO**: Venta cancelada, no editable
- `refunded` - **NUEVO**: Venta reembolsada, no editable

### Componentes Frontend Nuevos

#### EditSaleModal
Modal completo para edición con:
- ✅ **NUEVO**: Edición de información básica
- ✅ **NUEVO**: Modificación de items en tiempo real
- ✅ **NUEVO**: Agregado de productos desde inventario
- ✅ **NUEVO**: Eliminación de items con validación
- ✅ **NUEVO**: Cálculo automático de totales
- ✅ **NUEVO**: Cancelación/reembolso con motivos

#### SalesList (Actualizada)
- ✅ **NUEVO**: Columna de estado visible
- ✅ **NUEVO**: Botón de edición para administradores
- ✅ **NUEVO**: Menú contextual de acciones

#### useSales Hook (Extendido)
- ✅ **NUEVO**: `updateSale()` - Actualizar venta
- ✅ **NUEVO**: `addSaleItem()` - Agregar item
- ✅ **NUEVO**: `updateSaleItem()` - Modificar item
- ✅ **NUEVO**: `removeSaleItem()` - Eliminar item
- ✅ **NUEVO**: `cancelRefundSale()` - Cancelar/reembolsar

### Control Automático de Stock
- ✅ **NUEVO**: Ajustes automáticos en modificaciones
- ✅ **NUEVO**: Restauración completa en cancelaciones
- ✅ **NUEVO**: Compensación en eliminación de items
- ✅ **NUEVO**: Validación de stock en nuevos items

## Instalación de Nuevas Funcionalidades

1. **Aplicar extensión de edición:**
   ```sql
   -- Ejecutar en Supabase SQL Editor
   \i 002-sales-edit-schema.sql
   ```

2. **Verificar nuevas políticas:**
   ```sql
   SELECT schemaname, tablename, policyname, cmd
   FROM pg_policies
   WHERE tablename IN ('sales', 'sale_items')
   ORDER BY tablename, cmd;
   ```

3. **Probar funciones de edición:**
   ```sql
   -- Actualizar venta
   SELECT fn_update_sale(
     'your-sale-id',
     'Empleado Actualizado',
     'credit'::payment_method,
     NULL,
     25.00,
     'Venta modificada por admin'
   );
   ```

## Ejemplos de Uso de Edición

### Modificar Información de Venta
```typescript
const { updateSale } = useSales();

await updateSale({
  saleId: 'sale-uuid',
  employeeName: 'Juan Carlos',
  paymentMethod: 'transfer',
  discountAmount: 50.00,
  notes: 'Cliente VIP - descuento especial'
});
```

### Agregar Producto a Venta
```typescript
const { addSaleItem } = useSales();

await addSaleItem('sale-uuid', {
  product_id: 'product-uuid',
  quantity: 2,
  unit_price: 35.00
});
```

### Cancelar Venta
```typescript
const { cancelRefundSale } = useSales();

await cancelRefundSale(
  'sale-uuid',
  'cancelled',
  'Error en el pedido - cliente no satisfecho'
);
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