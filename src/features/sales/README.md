# Módulo de Ventas - Frontend

Sistema completo de ventas en tiempo real con interfaz React, usando shadcn/ui y TypeScript.

## Estructura de Archivos

```
src/features/sales/
├── components/              # Componentes React
│   ├── SalesView.tsx        # Vista principal
│   ├── TodaySalesCard.tsx   # Ventas en tiempo real
│   ├── SalesList.tsx        # Lista histórica
│   ├── SalesStats.tsx       # Estadísticas detalladas
│   ├── NewSaleModal.tsx     # Modal crear venta
│   └── index.ts            # Exportaciones
├── hooks/
│   └── useSales.ts         # Hook principal
├── types/
│   └── sales.ts            # Tipos TypeScript
├── index.ts                # Exportaciones del módulo
└── README.md              # Esta documentación
```

## Componentes Principales

### SalesView
Vista principal que incluye:
- Cards con estadísticas del día (ventas, total, promedio, empleados activos)
- Ventas de hoy en tiempo real
- Estadísticas detalladas del período
- Lista histórica con filtros
- Botón para crear nueva venta

### TodaySalesCard
Componente de tiempo real que muestra:
- Ventas del día actual
- Actualización automática via WebSocket
- Información de empleado, método de pago y hora
- Badge con cantidad total de ventas

### SalesList
Lista histórica con:
- Tabla responsive de ventas
- Información completa de cada transacción
- Filtros por empleado, método de pago y fechas
- Paginación y búsqueda

### SalesStats
Estadísticas detalladas incluyendo:
- Métricas principales (total, promedio, empleados activos)
- Distribución por métodos de pago
- Ranking de empleados más activos
- Gráfico de ventas por hora

### NewSaleModal
Modal para crear ventas con:
- Búsqueda de productos en tiempo real
- Carrito de compras interactivo
- Cálculo automático de totales
- Validación de stock disponible
- Selección de método de pago

## Hook useSales

### Estado Gestionado
```typescript
const {
  sales,              // Todas las ventas
  todaySales,         // Ventas de hoy (tiempo real)
  loading,            // Estado de carga
  error,              // Errores
  stats,              // Estadísticas calculadas

  // Funciones
  createSale,         // Crear nueva venta
  filterSales,        // Filtrar ventas
  getSalesByEmployee, // Ventas por empleado

  // Tiempo real
  isConnected         // Estado de conexión WebSocket
} = useSales();
```

### Funcionalidades Principales

#### `createSale(saleData: NewSaleData)`
Crea una nueva venta completa:
- Valida stock disponible
- Actualiza inventario automáticamente
- Envía notificación en tiempo real
- Actualiza estadísticas

#### `filterSales(search, paymentMethod, startDate, endDate)`
Filtra ventas por múltiples criterios:
- Búsqueda por empleado o número de venta
- Filtro por método de pago
- Rango de fechas personalizable

#### Tiempo Real
Suscripción automática a:
- Nuevas ventas del club
- Actualizaciones de stock
- Notificaciones de sistema

## Tipos TypeScript

### SaleWithDetails
Interfaz principal de venta con detalles:
```typescript
interface SaleWithDetails {
  id: string;
  sale_number: string;
  employee_name: string;
  payment_method: PaymentMethod;
  total_amount: number;
  sale_date: string;
  status: SaleStatus;
  items_count: number;
  club_id: string;
  created_at: string;
}
```

### NewSaleData
Datos para crear nueva venta:
```typescript
interface NewSaleData {
  employee_name: string;
  payment_method: PaymentMethod;
  items: Array<{
    product_id: string;
    quantity: number;
    price: number;
  }>;
}
```

### SalesStats
Estadísticas completas del período:
```typescript
interface SalesStats {
  total_sales: number;
  total_count: number;
  average_sale: number;
  employees_count: number;
  payment_methods: PaymentMethodStats[];
  top_employees: EmployeeStats[];
  hourly_sales: HourlySales[];
}
```

### Configuraciones

#### PAYMENT_METHOD_CONFIG
Configuración visual para métodos de pago:
```typescript
{
  cash: {
    label: 'Efectivo',
    bgColor: 'bg-green-100',
    color: 'text-green-800'
  },
  transfer: {
    label: 'Transferencia',
    bgColor: 'bg-blue-100',
    color: 'text-blue-800'
  },
  // ...
}
```

## Características Técnicas

### Tiempo Real
- WebSocket connection a Supabase
- Notificaciones automáticas de nuevas ventas
- Actualización inmediata de estadísticas
- Reconexión automática

### Validaciones
- Stock suficiente antes de venta
- Empleado válido requerido
- Items de venta no vacíos
- Precios positivos

### Optimizaciones
- Debounce en búsquedas
- Memoización de filtros
- Lazy loading de estadísticas
- Cache de productos frecuentes

### Responsividad
- Grid adaptativo para estadísticas
- Tabla responsive con scroll
- Modal adaptado a móviles
- Cards que se adaptan al espacio

## Integración con Backend

### Supabase
- Funciones SQL: `fn_create_sale()`, `fn_get_today_sales()`, `fn_get_sales_stats()`
- RLS automático por club
- Subscripciones en tiempo real via PostgreSQL NOTIFY

### Real-time Subscriptions
```typescript
// Auto-suscripción en useEffect
const channel = supabase
  .channel(`new_sale_${admin.club_id}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'sales'
  }, handleNewSale)
  .subscribe();
```

## Flujo de Venta Completo

### 1. Crear Venta
- Empleado busca productos
- Agrega items al carrito
- Selecciona método de pago
- Confirma venta

### 2. Procesamiento Backend
- Valida stock disponible
- Crea registro de venta
- Inserta items de venta
- Actualiza stock automáticamente
- Envía notificación en tiempo real

### 3. Actualización Frontend
- Recibe notificación WebSocket
- Actualiza lista de ventas del día
- Recalcula estadísticas
- Muestra confirmación al usuario

## Permisos y Seguridad

### Administradores
- Ver todas las ventas del club
- Crear ventas
- Ver estadísticas completas
- Acceso a reportes históricos

### Empleados
- Crear ventas propias
- Ver ventas del día actual
- Sin acceso a datos de otros empleados

## Uso en Dashboard

```typescript
// En Dashboard.tsx
import { SalesView } from '@/features/sales';

// Render
case 'sales':
  return <SalesView />;
```

## Métricas y Análisis

### Estadísticas Disponibles
- **Ventas del día**: Total, cantidad, promedio
- **Métodos de pago**: Distribución porcentual
- **Empleados**: Ranking por performance
- **Horarios**: Patrones de venta por hora
- **Tendencias**: Comparación con períodos anteriores

### Reportes
- Exportación de datos
- Gráficos interactivos
- Filtros avanzados
- Comparativas temporales

## Estilos y UI

### shadcn/ui Components
- Card para estadísticas
- Table para listas
- Dialog para modal de venta
- Badge para estados y métodos
- Select para filtros
- Button con variantes

### Indicadores Visuales
- Verde para totales positivos
- Badges de colores por método de pago
- Iconos descriptivos (ShoppingCart, CreditCard, Users)
- Estados de carga y error

## Mejoras Futuras

- [ ] Impresión de tickets
- [ ] Códigos QR para pagos
- [ ] Integración con sistemas de pago
- [ ] Reportes PDF automáticos
- [ ] Notificaciones push
- [ ] Dashboard de gerencia
- [ ] Análisis predictivo
- [ ] Promociones y descuentos