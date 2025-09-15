# Manual de Creación de Empleados

## 🔐 Proceso Seguro para Crear Empleados

La creación de empleados se realiza **únicamente desde Supabase Dashboard** para mantener la seguridad y control del sistema.

### 📋 Pasos para Crear un Empleado

#### **1. Crear Usuario en Authentication**

1. Ve a tu **Supabase Dashboard**
2. Navega a **Authentication** → **Users**
3. Click en **"Invite user"** o **"Add user"**
4. Completa:
   - **Email**: email del empleado
   - **Password**: contraseña temporal (opcional)
   - **Email confirm**: ✅ marcado
5. Click **"Send invitation"** o **"Create user"**
6. **Copia el UUID del usuario** que aparece en la lista

#### **2. Obtener el Club ID**

1. Ve a **Table Editor** → **clubs**
2. Busca tu club y **copia el ID** (UUID)

#### **3. Insertar en la Tabla Employees**

1. Ve a **Table Editor** → **employees**
2. Click **"Insert"** → **"Insert row"**
3. Completa los campos:

```sql
-- Campos obligatorios:
user_id:     [UUID del usuario creado en paso 1]
club_id:     [UUID del club del paso 2]
full_name:   "Nombre Completo del Empleado"
category:    [Seleccionar: bartender, security, dj, waiter, cashier, cleaner, host, manager, technician, promoter, other]
status:      "active"

-- Campos opcionales:
phone:           "+54 9 11 1234-5678"
employee_number: "EMP001"
hourly_rate:     1500.00
hire_date:       "2025-01-15"
notes:           "Información adicional"
```

4. Click **"Save"**

### 🎯 Ejemplo Completo

```sql
INSERT INTO public.employees (
  user_id,
  club_id,
  full_name,
  phone,
  category,
  hourly_rate,
  hire_date,
  employee_number,
  notes,
  status
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  -- UUID del usuario de auth.users
  'f1e2d3c4-b5a6-9078-dcba-fe0987654321',  -- UUID del club
  'Juan Carlos Pérez',
  '+54 9 11 2345-6789',
  'bartender',
  2000.00,
  '2025-01-15',
  'EMP001',
  'Bartender con 5 años de experiencia',
  'active'
);
```

### ✅ Verificación

Después de crear el empleado:

1. Ve a la app → **Dashboard** → **Empleados**
2. Click **"Actualizar"** para refrescar la lista
3. Verifica que aparece el nuevo empleado
4. Prueba editarlo para confirmar que funciona

### 🔍 Categorías Disponibles

| Categoría | Descripción |
|-----------|-------------|
| `bartender` | Bartender/Barman |
| `security` | Seguridad/Patovica |
| `dj` | DJ/Disc Jockey |
| `waiter` | Mozo/Mesero |
| `cashier` | Cajero |
| `cleaner` | Personal de limpieza |
| `host` | Host/Anfitrión |
| `manager` | Gerente/Supervisor |
| `technician` | Técnico (sonido, luces, etc.) |
| `promoter` | Promotor/Relaciones públicas |
| `other` | Otros roles |

### 🚨 Consideraciones Importantes

1. **Seguridad**: Solo usuarios con acceso al Dashboard pueden crear empleados
2. **Multi-tenancy**: Cada empleado pertenece a UN solo club
3. **Estado**: Solo empleados con `status = 'active'` pueden iniciar sesión
4. **Email único**: No puede haber dos usuarios con el mismo email
5. **Club válido**: El `club_id` debe existir en la tabla `clubs`

### 🔧 Gestión Posterior

Una vez creado el empleado:

- ✅ **Los ADMINS pueden** (desde la app):
  - Ver todos los empleados de su club
  - Editar información personal y laboral
  - Activar/desactivar empleados
  - Cambiar categorías y datos

- ✅ **Los EMPLEADOS pueden** (desde la app):
  - Ver su propio perfil
  - Editar campos limitados (nombre, teléfono, notas)

- ❌ **NADIE puede** (desde la app):
  - Crear nuevos empleados
  - Eliminar empleados
  - Cambiar de club a un empleado

### 🆘 Solución de Problemas

**Error: "duplicate key value violates unique constraint"**
- El email ya existe en auth.users
- Usar un email diferente

**Error: "insert or update on table violates foreign key constraint"**
- El `club_id` no existe
- Verificar que el UUID del club sea correcto

**Error: "new row violates row-level security policy"**
- Estás usando un usuario sin permisos
- Usar Service Role Key o crear desde Dashboard

**El empleado no aparece en la app**
- Verificar que `status = 'active'`
- Verificar que `club_id` es correcto
- Click "Actualizar" en la app