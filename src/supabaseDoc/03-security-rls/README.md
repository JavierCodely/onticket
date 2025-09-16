# Security & RLS - Seguridad y Row Level Security

Este directorio contiene todas las políticas de seguridad y configuraciones de Row Level Security (RLS) para el sistema multi-tenant.

## 📋 Contenido

### `001-additional-policies.sql`
Políticas adicionales de escritura para el sistema base.

### `002-admin-crud-permissions.sql`
Permisos CRUD completos para administradores en su club.

### `003-multi-user-security.sql`
Actualización de seguridad para soporte multi-usuario (admins + empleados).

## 🔒 Arquitectura de Seguridad

### Principios Fundamentales
1. **Multi-tenancy**: Aislamiento total entre clubes
2. **Least Privilege**: Mínimos permisos necesarios
3. **Defense in Depth**: Múltiples capas de seguridad
4. **Audit Trail**: Registro de todas las operaciones

### Roles del Sistema
```
service_role     # Backend/Dashboard - Acceso completo
├── admin        # CRUD en su club
└── employee     # Lectura + transacciones limitadas
```

## 🛡️ Políticas por Tabla

### 🏢 Clubs
| Rol | SELECT | INSERT | UPDATE | DELETE |
|-----|--------|---------|---------|---------|
| **service_role** | ✅ Todo | ✅ Todo | ✅ Todo | ✅ Todo |
| **admin** | ✅ Su club | ❌ | ✅ Su club | ❌ |
| **employee** | ✅ Su club | ❌ | ❌ | ❌ |

### 👥 Employees
| Rol | SELECT | INSERT | UPDATE | DELETE |
|-----|--------|---------|---------|---------|
| **service_role** | ✅ Todo | ✅ Todo | ✅ Todo | ✅ Todo |
| **admin** | ✅ Su club | ❌ | ✅ Su club | ❌ |
| **employee** | ✅ Su registro | ❌ | ✅ Campos limitados | ❌ |

### 💰 Accounts
| Rol | SELECT | INSERT | UPDATE | DELETE |
|-----|--------|---------|---------|---------|
| **service_role** | ✅ Todo | ✅ Todo | ✅ Todo | ✅ Todo |
| **admin** | ✅ Su club | ✅ Su club | ✅ Su club | ✅ Su club |
| **employee** | ✅ Su club | ❌ | ❌ | ❌ |

### 💸 Account Transactions
| Rol | SELECT | INSERT | UPDATE | DELETE |
|-----|--------|---------|---------|---------|
| **service_role** | ✅ Todo | ✅ Todo | ✅ Todo | ✅ Todo |
| **admin** | ✅ Su club | ✅ Su club | ✅ Su club | ✅ Su club |
| **employee** | ✅ Su club | ✅ Su club | ❌ | ❌ |

### 👤 Admins
| Rol | SELECT | INSERT | UPDATE | DELETE |
|-----|--------|---------|---------|---------|
| **service_role** | ✅ Todo | ✅ Todo | ✅ Todo | ✅ Todo |
| **admin** | ✅ Su registro | ❌ | ✅ Su registro* | ❌ |
| **employee** | ❌ | ❌ | ❌ | ❌ |

\* *Sin cambiar club_id*

## 🔧 Funciones de Seguridad

### Core Functions
```sql
fn_current_admin_club_id()      # Club del admin autenticado
fn_current_employee_club_id()   # Club del empleado autenticado
fn_current_user_club_id()       # Club del usuario (admin o empleado)
```

### Validation Functions
```sql
fn_can_access_club(p_club_id)           # Verificar acceso a club
fn_account_belongs_to_my_club(p_id)     # Verificar propiedad de cuenta
fn_is_active_employee()                 # Verificar empleado activo
fn_user_role()                          # Determinar rol del usuario
```

## 🚨 Políticas de Naming

### Convención de Nombres
```
{table}_{action}_{scope}
employees_select_my_club     # Empleados pueden ver su club
accounts_update_admin_only   # Solo admin puede actualizar
```

### Scopes Disponibles
- `service_role`: Solo service role
- `my_club`: Datos del club del usuario
- `self`: Registro propio del usuario
- `admin_only`: Solo administradores

## 📊 Monitoreo y Auditoría

### Security Invoker Views
Todas las vistas usan `security_invoker = on` para heredar permisos del usuario.

### Logging Function
```sql
fn_log_user_access()  # Para auditoría futura (placeholder)
```

## ⚠️ Consideraciones Críticas

### Usuarios Inactivos
- **Admins inactivos**: No pueden acceder a ningún dato
- **Empleados inactivos**: Completamente bloqueados
- **Verificación automática**: En cada función helper

### Cambios de Club
- **Prohibido**: Usuarios no pueden cambiarse de club
- **Backend only**: Solo service role puede reasignar

### Service Role Usage
```sql
-- ✅ Correcto: Operaciones administrativas
INSERT INTO clubs (...) VALUES (...);  -- Con service key

-- ❌ Incorrecto: Operaciones de usuario
UPDATE employees SET status = 'inactive';  -- Sin service key
```

## 🔍 Testing y Debugging

### Verificar Políticas
```sql
-- Verificar permisos de usuario actual
SELECT fn_user_role();
SELECT fn_current_user_club_id();

-- Probar acceso a tabla
SELECT * FROM employees LIMIT 1;
```

### Common Issues
1. **Usuario no autenticado**: `auth.uid()` devuelve NULL
2. **Usuario inactivo**: Funciones helper devuelven NULL
3. **Club incorrecto**: RLS bloquea el acceso

### Emergency Access
Solo desde Supabase Dashboard con service role para recuperación de emergencia.