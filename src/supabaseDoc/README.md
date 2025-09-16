# OnTicket Database Documentation

Esta documentación describe la estructura y organización de la base de datos de OnTicket, un sistema de gestión para clubes nocturnos con arquitectura multi-tenant.

## 📁 Estructura de Directorios

### [01-core-schema/](./01-core-schema/)
Contiene el esquema principal de la base de datos con las tablas fundamentales del sistema.

### [02-employees/](./02-employees/)
Esquema y políticas relacionadas con la gestión de empleados.

### [03-security-rls/](./03-security-rls/)
Políticas de Row Level Security (RLS) y configuraciones de seguridad multi-tenant.

### [04-functions-rpc/](./04-functions-rpc/)
Funciones RPC para debugging, operaciones especiales y procedimientos almacenados.

### [05-patches-fixes/](./05-patches-fixes/)
Parches y correcciones aplicadas al sistema para resolver problemas específicos.

## 🗄️ Arquitectura de la Base de Datos

### Modelo Multi-Tenant
- **1 Club ↔ 1 Admin**: Cada administrador gestiona exactamente un club
- **RLS habilitado**: Aislamiento de datos a nivel de base de datos
- **Security Definer**: Funciones con permisos elevados para operaciones específicas

### Tablas Principales
- **clubs**: Información de los clubes nocturnos
- **admins**: Administradores vinculados a auth.users
- **employees**: Empleados del club con diferentes categorías
- **accounts**: Cuentas financieras (efectivo, billetera, banco)
- **account_transactions**: Movimientos financieros

### Roles y Permisos
- **service_role**: Acceso completo (operaciones de backend)
- **admin**: CRUD en su club, empleados y cuentas
- **employee**: Lectura de su club, creación de transacciones, edición limitada de perfil

## 🚀 Orden de Ejecución

Para configurar la base de datos desde cero, ejecutar los archivos en este orden:

1. `01-core-schema/001-main-schema.sql`
2. `02-employees/001-employees-schema.sql`
3. `03-security-rls/001-additional-policies.sql`
4. `03-security-rls/002-admin-crud-permissions.sql`
5. `03-security-rls/003-multi-user-security.sql`
6. `04-functions-rpc/001-debugging-functions.sql`
7. `05-patches-fixes/001-employee-update-fix.sql`

## 🔧 Variables de Entorno Requeridas

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📋 Notas de Implementación

- **Creación de usuarios**: Se realiza manualmente desde Supabase Dashboard
- **No registro público**: Los usuarios se crean por invitación
- **Auditoria**: Todas las tablas tienen `created_at` y `updated_at`
- **Monedas**: Soporte para múltiples monedas (por defecto ARS)
- **Zona horaria**: Configurada por club (por defecto America/Argentina/Tucuman)