# Módulo de Productos - Frontend

Sistema completo de gestión de productos con interfaz React, usando shadcn/ui y TypeScript.

## Estructura de Archivos

```
src/features/products/
├── components/           # Componentes React
│   ├── ProductsView.tsx  # Vista principal
│   ├── ProductCard.tsx   # Tarjeta de producto
│   ├── ProductModal.tsx  # Modal crear/editar
│   ├── ProductTable.tsx  # Tabla de productos
│   └── index.ts         # Exportaciones
├── hooks/
│   └── useProducts.ts   # Hook principal
├── types/
│   └── products.ts      # Tipos TypeScript
├── index.ts             # Exportaciones del módulo
└── README.md           # Esta documentación
```

## Componentes Principales

### ProductsView
Vista principal que incluye:
- Estadísticas de productos (total, activos, stock bajo, margen promedio)
- Filtros por categoría, estado y stock bajo
- Búsqueda por nombre/marca/SKU
- Toggle entre vista de tarjetas y tabla
- Modal para crear nuevos productos

### ProductCard
Tarjeta individual de producto con:
- Información básica (nombre, marca, categoría)
- Precios y margen de ganancia
- Stock actual con alertas de stock bajo
- Modal para actualizar stock
- Acciones de editar y eliminar

### ProductTable
Tabla completa con:
- Todas las columnas de productos
- Indicadores visuales de estado
- Alertas de stock bajo
- Acciones inline

### ProductModal
Modal unificado para crear/editar productos:
- Formulario completo con validación
- Cálculo en tiempo real del margen de ganancia
- Gestión de stock inicial
- Validaciones de precios

## Hook useProducts

### Estado Gestionado
```typescript
const {
  products,              // Lista de productos
  loading,              // Estado de carga
  error,                // Errores

  // Funciones CRUD
  createProduct,        // Crear producto
  updateProduct,        // Actualizar producto
  updateStock,          // Actualizar solo stock
  deleteProduct,        // Eliminar producto

  // Utilidades
  filterProducts,       // Filtrar productos
  getLowStockProducts,  // Productos con stock bajo
  getProductStats       // Estadísticas
} = useProducts();
```

### Funciones Principales

#### `createProduct(data: CreateProductData)`
Crea un nuevo producto con stock inicial.

#### `updateProduct(id: string, data: UpdateProductData)`
Actualiza información del producto.

#### `updateStock(id: string, data: UpdateStockData)`
Actualiza solo el stock de un producto.

#### `filterProducts(search, category, status, lowStock)`
Filtra productos por múltiples criterios.

## Tipos TypeScript

### ProductWithStock
Interfaz principal que incluye producto y stock:
```typescript
interface ProductWithStock {
  id: string;
  name: string;
  brand?: string;
  sku?: string;
  category: ProductCategory;
  cost_price: number;
  sale_price: number;
  profit_margin: number;
  min_stock: number;
  unit: ProductUnit;
  status: ProductStatus;
  club_id: string;

  // Datos de stock
  current_stock: number;
  available_stock: number;
  reserved_stock: number;
  is_low_stock: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}
```

### Configuraciones

#### PRODUCT_CATEGORY_CONFIG
Configuración visual para categorías:
```typescript
{
  bebidas: {
    label: 'Bebidas',
    bgColor: 'bg-blue-100',
    color: 'text-blue-800'
  },
  // ...
}
```

#### PRODUCT_STATUS_CONFIG
Estados de productos con variantes de badges.

#### PRODUCT_UNIT_CONFIG
Unidades de medida con abreviaciones.

## Características Técnicas

### Validaciones
- Precio de venta debe ser mayor al precio de costo
- Stock mínimo debe ser positivo
- Campos requeridos validados

### Cálculos Automáticos
- Margen de ganancia en tiempo real
- Stock disponible vs reservado
- Alertas de stock bajo

### Optimizaciones
- Debounce en búsquedas
- Memoización de filtros
- Lazy loading de imágenes

### Responsividad
- Grid adaptativo para tarjetas
- Tabla responsive con scroll horizontal
- Modales adaptados a móviles

## Integración con Backend

### Supabase
- Conexión directa con tablas `products` y `product_stock`
- RLS automático por club
- Subscripciones en tiempo real para stock

### Funciones SQL Utilizadas
- `fn_update_product_stock()` - Actualizar stock
- Triggers automáticos para cálculos

## Permisos y Seguridad

### Administradores
- Acceso completo a todas las funciones
- CRUD de productos
- Gestión de stock

### Empleados
- Solo lectura de productos activos
- Actualización de stock durante ventas (via módulo sales)

## Uso en Dashboard

```typescript
// En Dashboard.tsx
import { ProductsView } from '@/features/products';

// Render
case 'products':
  return <ProductsView />;
```

## Estilos y UI

### shadcn/ui Components
- Card, CardContent, CardHeader, CardTitle
- Button con variantes
- Input, Label
- Select, SelectContent, SelectItem
- Badge con variantes
- Dialog, DialogContent
- Table responsive

### Tailwind Classes
- Responsive design con prefijos md:, lg:
- Estados hover y focus
- Colores semánticos (green para precios, red para alertas)
- Espaciado consistente

## Mejoras Futuras

- [ ] Exportación a Excel/CSV
- [ ] Códigos de barras
- [ ] Categorías personalizadas
- [ ] Historial de cambios de precios
- [ ] Alertas automáticas por email
- [ ] Integración con proveedores