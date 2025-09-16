# Functions & RPC - Funciones y Procedimientos Remotos

Este directorio contiene funciones RPC (Remote Procedure Call) para debugging, operaciones especiales y procedimientos almacenados del sistema.

## 📋 Contenido

### `001-debugging-functions.sql`
Funciones especializadas para debugging, actualización de empleados y operaciones con logging detallado.

## 🔧 Funciones Principales

### 1. `update_employee_status(p_user_id, p_updates)`
Función principal para actualizar empleados con validación completa y logging.

#### Parámetros
- `p_user_id` (uuid): ID del empleado a actualizar
- `p_updates` (jsonb): Campos a actualizar en formato JSON

#### Campos Actualizables
```json
{
  "status": "active|inactive",
  "full_name": "Nuevo Nombre",
  "phone": "+54123456789",
  "category": "bartender|security|dj|...",
  "hourly_rate": 1500.00,
  "hire_date": "2024-01-15",
  "employee_number": "EMP001",
  "notes": "Observaciones"
}
```

#### Ejemplo de Uso
```sql
SELECT update_employee_status(
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  '{"status": "inactive", "notes": "Licencia médica"}'::jsonb
);
```

#### Respuesta
```json
{
  "success": true,
  "data": { /* empleado actualizado */ },
  "debug": {
    "current_user_id": "uuid-del-admin",
    "admin_club_id": "uuid-del-club",
    "employee_club_id": "uuid-del-club",
    "updates_applied": { /* campos actualizados */ }
  }
}
```

### 2. `toggle_employee_status(p_user_id)`
Función simplificada para alternar el estado activo/inactivo de un empleado.

#### Ejemplo
```sql
-- Cambia de active a inactive (o viceversa)
SELECT toggle_employee_status('f47ac10b-58cc-4372-a567-0e02b2c3d479');
```

### 3. `get_employees_with_debug()`
Obtiene todos los empleados del club con información de debug y permisos.

#### Respuesta
```json
[
  {
    "employee": { /* datos del empleado */ },
    "club": { /* datos del club */ },
    "can_edit": true
  }
]
```

### 4. `test_employee_update(p_user_id, p_new_status)`
Función de testing que bypassa RLS para pruebas directas (solo debugging).

⚠️ **Solo para testing en desarrollo**

## 🛠️ Funciones de Diagnóstico

### `fn_debug_employee_permissions(p_user_id)`
Función para diagnosticar permisos y relaciones entre admin y empleado.

#### Ejemplo
```sql
SELECT fn_debug_employee_permissions('employee-uuid');
```

#### Respuesta
```json
{
  "current_user_id": "admin-uuid",
  "is_admin": true,
  "admin_club_id": "club-uuid",
  "target_employee_club_id": "club-uuid",
  "can_update": true
}
```

### `fn_current_admin_club_id_temp()`
Función temporal para compatibilidad durante migraciones.

## 📱 Uso desde la Aplicación

### React/TypeScript Integration
```typescript
import { supabase } from '@/lib/supabase';

// Actualizar empleado
const updateEmployee = async (userId: string, updates: Partial<Employee>) => {
  const { data, error } = await supabase.rpc('update_employee_status', {
    p_user_id: userId,
    p_updates: updates
  });

  if (error) throw error;
  return data;
};

// Toggle status
const toggleEmployeeStatus = async (userId: string) => {
  const { data, error } = await supabase.rpc('toggle_employee_status', {
    p_user_id: userId
  });

  return data;
};
```

### Error Handling
```typescript
try {
  const result = await updateEmployee(employeeId, { status: 'inactive' });

  if (result.success) {
    console.log('Empleado actualizado:', result.data);
  } else {
    console.error('Error:', result.error);
  }
} catch (error) {
  console.error('Error de conexión:', error);
}
```

## 🔍 Debugging y Testing

### Desde SQL Editor (Supabase)

#### 1. Verificar permisos
```sql
SELECT fn_debug_employee_permissions('employee-uuid');
```

#### 2. Actualizar con logging
```sql
SELECT update_employee_status(
  'employee-uuid',
  '{"status": "inactive"}'::jsonb
);
```

#### 3. Test directo (bypass RLS)
```sql
SELECT test_employee_update('employee-uuid', 'active');
```

#### 4. Ver empleados con permisos
```sql
SELECT get_employees_with_debug();
```

### Common Error Responses
```json
// Usuario no autenticado
{"success": false, "error": "Usuario no autenticado"}

// No es admin
{"success": false, "error": "Usuario no es admin activo"}

// Empleado no encontrado
{"success": false, "error": "Empleado no encontrado"}

// Different club
{"success": false, "error": "No puede actualizar empleado de otro club"}
```

## ⚡ Características Técnicas

### Security Definer
Todas las funciones RPC usan `SECURITY DEFINER` para:
- Ejecutarse con permisos elevados
- Acceder a tablas con RLS
- Realizar validaciones complejas

### Error Handling
- **Try-catch blocks**: Captura de errores SQL
- **Validación previa**: Verificación de permisos y datos
- **Logging estructurado**: Respuestas JSON consistentes

### Performance
- **Single transaction**: Todas las operaciones en una transacción
- **Minimal queries**: Consultas optimizadas
- **Indexed lookups**: Uso de índices para búsquedas

## 📚 Referencias

### Supabase RPC Documentation
- [Calling PostgreSQL Functions](https://supabase.com/docs/guides/database/functions)
- [Database Functions](https://supabase.com/docs/reference/javascript/rpc)

### PostgreSQL Function Syntax
- [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [PL/pgSQL](https://www.postgresql.org/docs/current/plpgsql.html)