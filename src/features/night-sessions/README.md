# Sistema de Inicio/Cierre de Noche

Este módulo implementa un sistema completo de control de stock mediante sesiones de inicio y cierre de noche, permitiendo calcular automáticamente las ventas totales por producto.

## Descripción

El sistema permite a los administradores:
- **Iniciar Noche**: Capturar automáticamente el stock actual de todos los productos activos
- **Cerrar Noche**: Capturar el stock final y calcular automáticamente las ventas (stock inicio - stock cierre)
- **Consultar Historial**: Ver todas las sesiones pasadas con filtros por fecha y estado
- **Ver Detalles**: Acceder a un desglose completo de cada sesión con todos los productos

## Estructura del Módulo

```
src/features/night-sessions/
├── components/
│   ├── NightSessionsPage.tsx      # Página principal con listado y filtros
│   ├── SessionDetailsModal.tsx    # Modal con detalles de una sesión
│   └── index.ts
├── hooks/
│   ├── useNightSessions.ts        # Hook principal para gestión de sesiones
│   └── index.ts
├── services/
│   ├── nightSessionsService.ts    # Servicio de API para Supabase
│   └── index.ts
├── README.md
└── index.ts
```

## Base de Datos

El sistema utiliza las siguientes tablas en Supabase:

### `night_sessions`
- `id`: UUID (PK)
- `club_id`: UUID (FK a clubs)
- `session_date`: DATE
- `status`: ENUM ('open', 'closed')
- `started_at`: TIMESTAMP
- `closed_at`: TIMESTAMP (nullable)
- `started_by`: UUID (FK a auth.users)
- `closed_by`: UUID (FK a auth.users)

### `night_session_products`
- `id`: UUID (PK)
- `session_id`: UUID (FK a night_sessions)
- `product_id`: UUID (FK a products)
- `club_id`: UUID (FK a clubs)
- `opening_stock`: INTEGER
- `closing_stock`: INTEGER (nullable)
- `total_sold`: INTEGER (calculado: opening_stock - closing_stock)

## Funciones SQL

### `fn_start_night_session(p_session_date)`
Inicia una nueva sesión capturando el stock actual de todos los productos activos.

**Validaciones:**
- Solo admins pueden iniciar
- No puede haber otra sesión para la misma fecha
- Captura solo productos con status 'active'

### `fn_close_night_session(p_session_id)`
Cierra una sesión capturando el stock final y calculando ventas.

**Validaciones:**
- Solo admins pueden cerrar
- La sesión debe estar abierta
- La sesión debe pertenecer al club del admin

### `fn_get_night_session_summary(p_session_id)`
Obtiene el resumen de una sesión con todos sus productos.

## Uso

### En el Dashboard
La página está integrada en el dashboard con el ID `'night-sessions'` y aparece en el menú principal como "Inicio/Cierre".

### Flujo de Usuario

1. **Iniciar Noche**
   ```
   Usuario: Click en "Iniciar Noche"
   Sistema: Captura stock actual de productos activos
   Estado: Sesión en estado 'open'
   ```

2. **Durante la Noche**
   ```
   Las ventas se realizan normalmente
   El stock se actualiza en tiempo real
   ```

3. **Cerrar Noche**
   ```
   Usuario: Click en "Cerrar Noche"
   Sistema: Captura stock final
   Cálculo: total_sold = opening_stock - closing_stock
   Estado: Sesión en estado 'closed'
   ```

### Ejemplo de Código

```typescript
import { useNightSessions } from '@/features/night-sessions';

function MyComponent() {
  const {
    sessions,
    currentOpenSession,
    loading,
    startSession,
    closeSession,
    getSessionById,
  } = useNightSessions({
    start_date: '2025-10-01',
    end_date: '2025-10-31',
    status: 'closed',
  });

  // Iniciar una nueva sesión
  const handleStart = async () => {
    const sessionId = await startSession();
    console.log('Sesión iniciada:', sessionId);
  };

  // Cerrar la sesión actual
  const handleClose = async () => {
    if (currentOpenSession) {
      await closeSession(currentOpenSession.id);
    }
  };

  return (
    <div>
      <button onClick={handleStart}>Iniciar Noche</button>
      <button onClick={handleClose} disabled={!currentOpenSession}>
        Cerrar Noche
      </button>
    </div>
  );
}
```

## Seguridad (RLS)

- ✅ Solo administradores pueden crear, editar y ver sesiones
- ✅ Cada club solo ve sus propias sesiones
- ✅ Validación de pertenencia al club en todas las operaciones
- ✅ Una sola sesión por día por club
- ✅ No se puede cerrar una sesión ya cerrada

## Realtime

Las tablas están configuradas para actualizaciones en tiempo real:
- Cambios en `night_sessions` se reflejan inmediatamente
- Cambios en `night_session_products` se reflejan inmediatamente

## Características

- ✅ Captura automática de stock de productos activos
- ✅ Cálculo automático de ventas
- ✅ Filtrado por rango de fechas
- ✅ Filtrado por estado (abiertas/cerradas)
- ✅ Modal con detalles completos de cada sesión
- ✅ Productos con 0 ventas se muestran correctamente
- ✅ Interfaz intuitiva con shadcn/ui
- ✅ Notificaciones con sonner
- ✅ Skeleton loading states
- ✅ Responsive design

## Dependencias

- React 19
- TypeScript
- Supabase Client
- shadcn/ui components
- date-fns (formateo de fechas)
- lucide-react (iconos)
- sonner (notificaciones)

## Próximas Mejoras

- [ ] Exportar sesiones a CSV/Excel
- [ ] Comparativa entre sesiones
- [ ] Gráficos de tendencias
- [ ] Alertas de productos con alta diferencia
- [ ] Notas por sesión
- [ ] Integración con reportes
