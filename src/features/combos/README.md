# Sistema de Combos - OnTicket

## 📋 Descripción

El sistema de combos permite crear ofertas especiales que combinan múltiples productos a un precio reducido. Es completamente independiente del sistema de promociones y ofrece control granular de stock, límites por cliente y validaciones específicas para ventas.

## 🏗️ Arquitectura

### Base de Datos

El sistema está compuesto por 3 tablas principales:

- **`combos`**: Información principal del combo
- **`combo_items`**: Productos que componen cada combo
- **`combo_usage_log`**: Historial de usos y ventas de combos

### Vista Principal

- **`combos_with_details`**: Vista que combina toda la información de combos con cálculos automáticos

### Funciones RPC

- `fn_create_combo()`: Crear nuevos combos
- `fn_update_combo()`: Actualizar combos existentes
- `fn_validate_combo_stock()`: Validar disponibilidad antes de venta
- `fn_use_combo()`: Procesar venta de combo (decrementar stock)
- `fn_get_combo_stats()`: Obtener estadísticas de combos

## 🚀 Características Principales

### ✅ Gestión de Combos
- **Crear combos** con múltiples productos
- **Editar** detalles sin modificar productos
- **Pausar/Activar** combos sin eliminarlos
- **Eliminar** (cambio a estado inactivo)

### ✅ Control de Stock
- **Stock propio** del combo (independiente de productos)
- **Validación automática** de stock de productos individuales
- **Stock efectivo** calculado (mínimo entre combo y productos)
- **Alertas de stock bajo**

### ✅ Límites por Cliente
- **Mínimo por cliente**: Cantidad mínima que debe comprar
- **Máximo por cliente**: Cantidad máxima por compra
- **Validación en ventas**

### ✅ Máximo de Usos
- **Límite global** de usos del combo (opcional)
- **Contador automático** de usos
- **Desactivación automática** al alcanzar límite

### ✅ Cálculos Automáticos
- **Precio original** vs **precio del combo**
- **Porcentaje de ahorro**
- **Stock efectivo** (considerando productos individuales)
- **Disponibilidad** en tiempo real

### ✅ Filtros y Búsqueda
- **Por estado**: Activos, pausados, inactivos
- **Por texto**: Nombre y descripción
- **Por fecha de creación**
- **Solo stock bajo**

## 📦 Componentes

### CombosPage
Página principal que muestra la lista de combos con filtros y estadísticas.

```tsx
import { CombosPage } from '@/features/combos';

// Uso en router
<Route path="/combos" component={CombosPage} />
```

### CreateComboModal
Modal para crear nuevos combos con selección de productos paso a paso.

```tsx
import { CreateComboModal } from '@/features/combos';

<CreateComboModal
  open={isOpen}
  onOpenChange={setIsOpen}
/>
```

### EditComboModal
Modal para editar combos existentes (sin modificar productos).

```tsx
import { EditComboModal } from '@/features/combos';

<EditComboModal
  combo={selectedCombo}
  open={isOpen}
  onOpenChange={setIsOpen}
/>
```

## 🎣 Hooks

### useCombos
Hook principal para gestión de combos.

```tsx
import { useCombos } from '@/features/combos';

const {
  combos,
  loading,
  error,
  createCombo,
  updateCombo,
  deleteCombo,
  toggleComboStatus,
  applyFilters
} = useCombos();
```

### useActiveCombos
Hook para obtener solo combos activos y disponibles.

```tsx
import { useActiveCombos } from '@/features/combos';

const { activeCombos, loading, error } = useActiveCombos();
```

### useComboValidation
Hook para validar stock y procesar ventas.

```tsx
import { useComboValidation } from '@/features/combos';

const { validateStock, useCombo, loading } = useComboValidation();

// Validar antes de venta
const validation = await validateStock(comboId, quantity);
if (validation.valid) {
  // Procesar venta
  await useCombo(comboId, quantity, saleId, clientId, employeeName);
}
```

## 🔧 Servicios

### CombosService
Servicio principal con métodos estáticos para interactuar con la API.

```tsx
import { CombosService } from '@/features/combos';

// Obtener combos
const combos = await CombosService.getCombos(filters);

// Crear combo
const comboId = await CombosService.createCombo(comboData);

// Validar stock
const validation = await CombosService.validateComboStock(comboId, quantity);
```

## 📊 Validaciones de Venta

### Flujo de Validación

1. **Validar estado** del combo (debe estar activo)
2. **Validar stock del combo** (cantidad disponible)
3. **Validar límite de usos** (si está configurado)
4. **Validar stock de productos** individuales
5. **Validar límites por cliente** (mínimo/máximo)

### Ejemplo de Integración en Ventas

```tsx
// En el sistema de ventas
import { CombosService } from '@/features/combos';

const processComboSale = async (comboId: string, quantity: number) => {
  // 1. Validar stock
  const validation = await CombosService.validateComboStock(comboId, quantity);

  if (!validation.valid) {
    throw new Error(`Validación fallida: ${validation.errors.join(', ')}`);
  }

  // 2. Procesar venta
  await CombosService.useCombo(
    comboId,
    quantity,
    saleId,
    customerIdentifier,
    employeeName
  );

  console.log('Combo vendido exitosamente');
};
```

## 🗃️ Estructura de Archivos

```
src/features/combos/
├── components/
│   ├── CombosPage.tsx           # Página principal
│   ├── CreateComboModal.tsx     # Modal de crear
│   └── EditComboModal.tsx       # Modal de editar
├── hooks/
│   └── useCombos.ts            # Todos los hooks
├── services/
│   └── combosService.ts        # Servicio principal
├── index.ts                    # Exportaciones
└── README.md                   # Documentación

src/supabaseDoc/13-combos/
└── 001-combos-system.sql       # Schema completo

src/core/types/database.ts      # Tipos TypeScript
```

## 🚦 Estados del Combo

- **`active`**: Disponible para ventas
- **`paused`**: Temporalmente no disponible
- **`inactive`**: Eliminado (no se muestra)

## 💰 Ejemplo de Uso Completo

### 1. Crear Combo
```tsx
const comboData = {
  name: 'Combo Energizante',
  description: 'RedBull + 2 Speed para la noche',
  combo_price: 25.00,
  stock_quantity: 50,
  min_combo_per_client: 1,
  max_combo_per_client: 2,
  max_uses: 100,
  combo_items: [
    { product_id: 'redbull-uuid', quantity_per_combo: 1 },
    { product_id: 'speed-uuid', quantity_per_combo: 2 }
  ]
};

const comboId = await CombosService.createCombo(comboData);
```

### 2. Validar y Vender
```tsx
// Validar disponibilidad
const validation = await CombosService.validateComboStock(comboId, 1);

if (validation.valid) {
  // Procesar venta
  await CombosService.useCombo(
    comboId,
    1,                    // cantidad
    saleId,              // ID de venta
    'cliente-123',       // identificador cliente
    'Juan Pérez'         // nombre empleado
  );
}
```

### 3. Obtener Estadísticas
```tsx
const stats = await CombosService.getComboStats(
  '2024-01-01',  // fecha inicio
  '2024-01-31'   // fecha fin
);

console.log('Combos vendidos:', stats.period_stats.total_sales);
console.log('Revenue:', stats.period_stats.total_revenue);
```

## 🔐 Seguridad

- **RLS (Row Level Security)** habilitado en todas las tablas
- **Políticas específicas** para admins y empleados
- **Solo admins** pueden crear/editar combos
- **Empleados** pueden ver y usar combos en ventas
- **Funciones SECURITY DEFINER** para operaciones críticas

## ⚠️ Consideraciones Importantes

1. **Los productos del combo no se pueden modificar** después de crearlo
2. **El stock del combo es independiente** del stock de productos individuales
3. **Las validaciones son automáticas** en cada venta
4. **Los límites por cliente se validan** en cada compra
5. **El sistema mantiene un log completo** de todos los usos

## 🔄 Integración con Ventas

Para integrar los combos en el sistema de ventas, consulta las validaciones en:

```sql
-- Validar antes de venta
SELECT fn_validate_combo_stock('combo-uuid', 1);

-- Procesar venta
SELECT fn_use_combo('combo-uuid', 1, 'sale-uuid', 'client-123', 'Employee Name');
```

---

## 🎯 Próximos Pasos

Para completar la integración, será necesario:

1. **Modificar el sistema de ventas** para incluir validaciones de combos
2. **Agregar combos al POS** o sistema de punto de venta
3. **Implementar reportes específicos** de combos
4. **Crear dashboards** con métricas de rendimiento

¡El sistema de combos está listo para ser usado! 🚀