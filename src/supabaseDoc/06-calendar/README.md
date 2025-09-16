# Calendar - Sistema de Calendario y Tareas

Este directorio contiene el sistema completo de calendario para OnTicket, permitiendo a los clubes gestionar tareas, eventos y verificaciones de DJ.

## 📋 Contenido

### `001-calendar-schema.sql`
Script completo que implementa:
- **Tabla calendar_events**: Eventos y tareas del calendario
- **Tipos ENUM**: Prioridades, tipos de eventos y estados
- **Funciones RPC**: Operaciones especializadas
- **Políticas RLS**: Seguridad multi-tenant
- **Vistas optimizadas**: Consultas con información extendida

## 🗓️ Estructura de Datos

### Tabla: calendar_events

#### Campos Principales
```sql
id              uuid PRIMARY KEY
club_id         uuid NOT NULL           -- Club propietario
title           text NOT NULL           -- Título del evento
description     text                    -- Descripción detallada
event_type      calendar_event_type     -- Tipo de evento
event_date      date NOT NULL           -- Fecha del evento
priority        task_priority           -- Prioridad (color)
status          task_status             -- Estado de la tarea
is_completed    boolean                 -- Checkbox completado
```

#### Configuración de Tiempo
```sql
start_time      time                    -- Hora de inicio
end_time        time                    -- Hora de fin
all_day         boolean DEFAULT true    -- Evento de todo el día
is_recurring    boolean DEFAULT false   -- Evento recurrente
recurrence_pattern text                 -- Patrón de recurrencia
```

#### Asignación y DJ
```sql
assigned_to     uuid                    -- Empleado asignado
needs_dj        boolean DEFAULT false   -- Requiere DJ
dj_assigned     boolean DEFAULT false   -- DJ confirmado
dj_user_id      uuid                    -- DJ asignado
```

## 🎨 Tipos y Configuraciones

### Prioridades (task_priority)
| Valor | Color | Significado | UI Color |
|-------|-------|-------------|----------|
| `high` | Rojo | Importante | `bg-red-500` |
| `medium` | Azul | Medio importante | `bg-blue-500` |
| `low` | Amarillo | No tan importante | `bg-yellow-500` |

### Tipos de Eventos (calendar_event_type)
```sql
'task'        -- Tarea general
'dj_missing'  -- Sábado sin DJ asignado
'event'       -- Evento del club
'maintenance' -- Mantenimiento
'meeting'     -- Reunión
'other'       -- Otros tipos
```

### Estados (task_status)
```sql
'pending'     -- Pendiente
'in_progress' -- En progreso
'completed'   -- Completada
'cancelled'   -- Cancelada
```

## 🔧 Funciones RPC

### `create_calendar_event()`
Crea un nuevo evento con validación de permisos.

**Parámetros:**
```sql
p_title          text                    -- Título (requerido)
p_event_date     date                    -- Fecha (requerido)
p_description    text DEFAULT NULL       -- Descripción
p_event_type     calendar_event_type     -- Tipo
p_priority       task_priority           -- Prioridad
p_start_time     time DEFAULT NULL       -- Hora inicio
p_end_time       time DEFAULT NULL       -- Hora fin
p_all_day        boolean DEFAULT true    -- Todo el día
p_assigned_to    uuid DEFAULT NULL       -- Asignado a
p_needs_dj       boolean DEFAULT false   -- Requiere DJ
```

**Ejemplo de uso:**
```sql
SELECT create_calendar_event(
  'Revisar sistema de sonido',
  '2024-03-15',
  'Verificar que todos los equipos funcionen',
  'maintenance',
  'high'
);
```

### `fn_complete_task(p_event_id)`
Marca una tarea como completada.

```sql
SELECT fn_complete_task('event-uuid');
```

### `fn_get_calendar_events(p_year, p_month)`
Obtiene todos los eventos de un mes específico.

```sql
-- Eventos de marzo 2024
SELECT * FROM fn_get_calendar_events(2024, 3);
```

### `fn_create_saturday_dj_check()`
Crea automáticamente verificaciones de DJ para todos los sábados de un período.

```sql
SELECT fn_create_saturday_dj_check(
  'club-uuid',
  '2024-03-01',  -- Fecha inicio
  '2024-03-31'   -- Fecha fin
);
```

## 🔒 Seguridad y RLS

### Políticas Implementadas

#### Para Administradores
- **SELECT**: Eventos de su club
- **INSERT**: Crear eventos para su club
- **UPDATE**: Modificar eventos de su club
- **DELETE**: Eliminar eventos de su club

#### Para Empleados
- **SELECT**: Ver eventos de su club
- **UPDATE**: Solo tareas asignadas a ellos

#### Para Service Role
- **ALL**: Acceso completo para operaciones de backend

### Vista Extendida
```sql
calendar_events_with_assignee
-- Incluye información del empleado asignado y DJ
```

## 🎯 Casos de Uso

### 1. Calendario Mensual
```typescript
const { events, loading } = useCalendar();

// Mostrar eventos del mes actual
events.forEach(event => {
  console.log(`${event.event_date}: ${event.title}`);
});
```

### 2. Crear Tarea con Prioridad
```typescript
await createEvent({
  title: 'Limpiar baños',
  event_date: '2024-03-15',
  priority: 'high',
  assigned_to: 'employee-uuid'
});
```

### 3. Verificación de DJ para Sábados
```typescript
// Crear verificaciones para todo el mes
await createSaturdayDJChecks('2024-03-01', '2024-03-31');
```

### 4. Marcar Tarea Completada
```typescript
await completeTask('task-uuid');
```

## 💻 Componentes React

### CalendarView
Componente principal del calendario con vista mensual.

**Características:**
- Grid de calendario responsivo
- Navegación entre meses
- Vista de eventos por día
- Modal para crear/editar eventos
- Indicadores de prioridad por colores

### CalendarDay
Componente para cada día del calendario.

**Características:**
- Muestra hasta 3 eventos por día
- Checkbox para completar tareas
- Indicadores especiales (DJ faltante)
- Click para ver detalles

### EventModal
Modal para crear y editar eventos.

**Características:**
- Formulario completo con validación
- Configuración de horarios
- Asignación de empleados
- Opciones especiales (DJ, recurrencia)

## 🎨 Configuración de UI

### Colores por Prioridad
```typescript
const PRIORITY_CONFIG = {
  high: {
    color: 'bg-red-500',      // Fondo del badge
    bgLight: 'bg-red-50',     // Fondo suave
    borderColor: 'border-red-200'
  },
  medium: {
    color: 'bg-blue-500',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  low: {
    color: 'bg-yellow-500',
    bgLight: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  }
};
```

### Iconos por Tipo
```typescript
const EVENT_TYPE_CONFIG = {
  task: { icon: 'CheckSquare', color: 'text-gray-600' },
  dj_missing: { icon: 'Music', color: 'text-red-600' },
  event: { icon: 'Calendar', color: 'text-purple-600' },
  maintenance: { icon: 'Wrench', color: 'text-orange-600' },
  meeting: { icon: 'Users', color: 'text-blue-600' },
  other: { icon: 'MoreHorizontal', color: 'text-gray-600' }
};
```

## 📱 Integración con Dashboard

### Navegación
El calendario se integra como una pestaña más en el dashboard:

```typescript
// menuItems.ts
{
  id: 'calendar',
  title: 'Calendario',
  icon: Calendar,
  description: 'Tareas y eventos del club'
}
```

### Hook de Estado
```typescript
const {
  events,
  loading,
  createEvent,
  updateEvent,
  completeTask,
  deleteEvent
} = useCalendar();
```

## 🔄 Flujo de Trabajo

### Setup Inicial
1. **Ejecutar SQL**: `001-calendar-schema.sql`
2. **Verificar permisos**: Solo admins pueden crear eventos
3. **Crear verificaciones de DJ**: Para sábados del mes

### Operación Diaria
1. **Ver calendario**: Administrador revisa tareas del día
2. **Crear tareas**: Asignar a empleados específicos
3. **Completar tareas**: Empleados marcan como hechas
4. **Verificar DJ**: Confirmar para eventos de sábado

### Mantenimiento
- **Eventos recurrentes**: Crear manualmente por ahora
- **Limpieza**: Archivar eventos antiguos (futuro)
- **Reportes**: Estadísticas de productividad (futuro)

## ⚠️ Consideraciones

### Performance
- **Índices optimizados** para consultas por club y fecha
- **Vista materializada** para consultas complejas (futuro)
- **Paginación** para períodos largos (futuro)

### Limitaciones Actuales
- **Sin notificaciones** push (futuro)
- **Sin sincronización** con calendarios externos
- **Recurrencia manual** (mejora futura)

### Escalabilidad
- **Particionado por fecha** para grandes volúmenes
- **Cache en cliente** para navegación rápida
- **Background jobs** para tareas automáticas