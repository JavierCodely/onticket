# Sistema de Productos y Stock

Este directorio contiene la implementación completa del sistema de gestión de productos y stock para OnTicket.

## Descripción General

El sistema permite a los administradores gestionar productos y su inventario, mientras que los empleados (bartenders/cajeros) pueden consultar precios y actualizar stock durante las ventas.

## Estructura de Archivos

- `001-products-schema.sql` - Esquema completo de productos y stock con RLS

## Características Principales

### Productos
- Gestión completa de productos con categorías, marcas y SKUs
- Cálculo automático del margen de ganancia
- Control de stock mínimo con alertas
- Estados de producto (activo, inactivo)

### Stock
- Sistema de stock disponible con reservas
- Funciones para reducir stock durante ventas
- Alertas automáticas de stock bajo

### Seguridad
- Row Level Security (RLS) implementado
- Solo administradores pueden CRUD productos
- Empleados (bartender/cajero) solo pueden ver y actualizar stock

## Permisos por Rol

### Administradores
- ✅ Crear productos
- ✅ Editar productos
- ✅ Eliminar productos
- ✅ Ver todos los productos
- ✅ Gestionar stock inicial

### Empleados (Bartender/Cajero)
- ✅ Ver productos activos
- ✅ Ver precios de venta
- ✅ Actualizar stock durante ventas
- ❌ Editar información de productos
- ❌ Crear/eliminar productos

## Tipos de Datos

### Categorías de Productos
- `bebidas` - Bebidas alcohólicas y no alcohólicas
- `comida` - Comidas y snacks
- `tabaco` - Productos de tabaco
- `merchandising` - Productos promocionales
- `otro` - Otros productos

### Estados de Producto
- `active` - Producto disponible para venta
- `inactive` - Producto no disponible

### Unidades de Medida
- `unit` - Unidad
- `liter` - Litro
- `kg` - Kilogramo
- `bottle` - Botella
- `can` - Lata
- `pack` - Paquete

## Funciones Principales

### `fn_update_product_stock()`
Actualiza el stock de un producto durante una venta, validando disponibilidad.

**Parámetros:**
- `p_product_id` - ID del producto
- `p_quantity_sold` - Cantidad vendida

**Validaciones:**
- Stock suficiente disponible
- Producto existe y está activo
- Actualiza automáticamente el flag de stock bajo

## Triggers

### `tr_update_product_stock_on_sale`
Se ejecuta automáticamente al insertar items de venta para actualizar el stock.

## Vistas Calculadas

### Campos Computados en Products
- `profit_margin` - Margen de ganancia calculado automáticamente
- `is_low_stock` - Indica si el stock está por debajo del mínimo

### Joins con Stock
- `available_stock` - Stock disponible para venta
- `current_stock` - Stock total actual
- `reserved_stock` - Stock reservado

## Ejemplos de Uso

### Crear un Producto
```sql
INSERT INTO products (name, category, cost_price, sale_price, min_stock, unit, club_id)
VALUES ('Fernet Branca 750ml', 'bebidas', 2500.00, 4000.00, 5, 'bottle', 'club-uuid');
```

### Actualizar Stock
```sql
SELECT fn_update_product_stock('product-uuid', 2);
```

### Consultar Productos con Stock Bajo
```sql
SELECT * FROM products p
JOIN product_stock ps ON p.id = ps.product_id
WHERE p.is_low_stock = true
AND p.club_id = 'club-uuid';
```