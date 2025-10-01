# Core Schema - Esquema Principal

Este directorio contiene la definición del esquema principal de OnTicket, incluyendo las tablas fundamentales y sus relaciones.

## 📋 Contenido

### `001-main-schema.sql`
Script principal que crea:

#### 🏢 Tablas Principales
- **clubs**: Clubes nocturnos con información comercial y fiscal
- **accounts**: Cuentas financieras por club (efectivo, billetera, banco)
- **account_transactions**: Movimientos financieros de las cuentas
- **admins**: Administradores vinculados a auth.users (1:1 con clubs)

#### 🔧 Elementos Técnicos
- **Extensiones**: `pgcrypto` para UUIDs
- **Tipos ENUM**: Estados de club, admin, cuentas y registros
- **Funciones**: `set_updated_at()` para timestamps automáticos
- **Triggers**: Actualización automática de `updated_at`
- **Índices**: Optimización para consultas frecuentes
- **Vista**: `accounts_with_balance` con saldos calculados

#### 🔒 Seguridad Inicial
- **RLS habilitado** en todas las tablas
- **Políticas service_role**: Acceso completo para backend
- **Políticas de lectura**: Filtrado por club del usuario
- **Políticas de escritura**: Permisos mínimos para operación

## 🗂️ Estructura de Datos

### Relaciones Principales
```
clubs (1) ←→ (1) admins ←→ (1) auth.users
clubs (1) ←→ (N) accounts
accounts (1) ←→ (N) account_transactions
```

### Tipos de Cuenta Soportados
- `cash`: Efectivo en caja
- `wallet`: Billetera virtual (Mercado Pago, etc.)
- `bank`: Cuenta bancaria
- `other`: Otros tipos de cuentas

### Estados del Sistema
- **Club**: `active`, `inactive`, `suspended`
- **Admin**: `active`, `inactive`
- **Registro**: `open`, `closed` (para futuras funcionalidades de caja)

## 🚀 Funciones Helper

### `fn_current_admin_club_id()`
Devuelve el club_id del admin autenticado activo.

### `fn_account_belongs_to_my_club(p_account_id)`
Verifica si una cuenta pertenece al club del admin autenticado.

## 💡 Casos de Uso

### Flujo de Creación (Backend)
1. Crear usuario en Supabase Auth
2. `INSERT` en `clubs` (con service_role)
3. `INSERT` en `accounts` para cuentas base
4. `INSERT` en `admins` vinculando user_id y club_id

### Operación Diaria (Frontend)
- Admin lee datos de su club
- Admin gestiona cuentas y movimientos
- Sistema calcula saldos automáticamente

## ⚠️ Consideraciones Importantes

- **Multi-tenancy**: Cada admin ve solo datos de su club
- **Saldos reales**: Calculados desde `initial_balance + SUM(transactions)`
- **Seguridad**: Service role para creación, usuario autenticado para operación
- **Auditoria**: Timestamps automáticos en todas las operaciones