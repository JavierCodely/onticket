# Employees - Gestión de Empleados

Este directorio contiene el esquema y políticas para la gestión de empleados del club.

## 📋 Contenido

### `001-employees-schema.sql`
Script que implementa el sistema completo de empleados:

#### 👥 Tabla employees
Empleados vinculados a `auth.users` con información laboral completa.

**Campos principales:**
- `user_id`: Vinculación con Supabase Auth (PK)
- `club_id`: Club al que pertenece (FK)
- `employee_number`: Número de empleado único por club
- `full_name`: Nombre completo (requerido)
- `category`: Categoría/rol del empleado
- `hourly_rate`: Tarifa por hora (opcional)
- `hire_date`: Fecha de contratación
- `status`: Estado activo/inactivo

#### 🎭 Categorías de Empleados
```sql
employee_category ENUM:
- 'bartender'    # Bartender/Barman
- 'security'     # Seguridad/Patovica
- 'dj'           # DJ/Disc Jockey
- 'waiter'       # Mozo/Mesero
- 'cashier'      # Cajero
- 'cleaner'      # Personal de limpieza
- 'host'         # Host/Anfitrión
- 'manager'      # Gerente/Supervisor
- 'technician'   # Técnico (sonido, luces)
- 'promoter'     # Promotor/Relaciones públicas
- 'other'        # Otros roles
```

#### 🔧 Funciones Helper

##### `fn_current_employee_club_id()`
Devuelve el club_id del empleado autenticado activo.

##### `fn_is_active_employee()`
Verifica si el usuario autenticado es un empleado activo.

##### `fn_user_role()`
Determina el rol del usuario: `'admin'`, `'employee'` o `'none'`.

#### 📊 Vista employees_with_club
Combina información de empleados con datos del club para consultas optimizadas.

## 🔒 Políticas de Seguridad (RLS)

### Para Service Role
- **Acceso completo**: Puede crear, leer, actualizar y eliminar empleados

### Para Admins
- **Lectura**: Empleados de su club únicamente
- **Actualización**: Empleados de su club únicamente
- **Creación/Eliminación**: Solo service role

### Para Empleados
- **Lectura**: Su propio registro únicamente
- **Actualización**: Campos limitados de su perfil
- **Restricción**: Solo empleados activos pueden acceder

## 🚀 Flujo de Trabajo

### Creación de Empleados (Backend/Dashboard)
1. **Supabase Dashboard** → Authentication → Users → Invite user
2. **Obtener user_id** del usuario creado
3. **Insertar en employees** con service_role:
   ```sql
   INSERT INTO employees (user_id, club_id, full_name, category, status)
   VALUES (user_uuid, club_uuid, 'Nombre Empleado', 'bartender', 'active');
   ```

### Gestión desde la App
- **Admins**: Ver, editar y activar/desactivar empleados de su club
- **Empleados**: Ver y editar campos limitados de su perfil
- **Restricción**: No se puede crear/eliminar desde la app

## 💼 Casos de Uso Típicos

### Admin Dashboard
```sql
-- Ver todos los empleados del club
SELECT * FROM employees WHERE club_id = fn_current_admin_club_id();

-- Cambiar status de empleado
UPDATE employees
SET status = 'inactive'
WHERE user_id = 'employee_uuid'
AND club_id = fn_current_admin_club_id();
```

### Employee Profile
```sql
-- Ver mi información
SELECT * FROM employees WHERE user_id = auth.uid();

-- Actualizar mi teléfono
UPDATE employees
SET phone = '+54123456789'
WHERE user_id = auth.uid();
```

## ⚠️ Consideraciones Importantes

### Seguridad
- **Solo empleados activos** pueden acceder al sistema
- **Multi-tenancy**: Cada club ve solo sus empleados
- **Roles separados**: Admin y employee son mutuamente excluyentes

### Limitaciones de la App
- **No registro público**: Usuarios creados por invitación
- **No eliminación**: Empleados se desactivan, no se eliminan
- **Cambio de club**: Solo possible via service role (backend)

### Auditoria
- **Timestamps automáticos**: `created_at` y `updated_at`
- **Números únicos**: `employee_number` único por club
- **Índices optimizados**: Para consultas por club, categoría y status