# Documentación: Creación de Administradores y Empleados con Service Role

## Introducción

En OnTicket, la creación de usuarios administrativos y empleados requiere permisos especiales que solo pueden ser ejecutados con la **Service Role Key** de Supabase. Esto garantiza la seguridad del sistema multi-tenant y evita registros no autorizados.

## Configuración de Service Role

### 1. Obtener la Service Role Key

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Navega a **Settings** → **API**
3. Copia la **service_role key** (⚠️ **NUNCA** la compartas públicamente)

### 2. Configurar Variables de Entorno

Agrega la service role key a tu archivo `.env`:

```env
VITE_SUPABASE_URL=tu_proyecto_url
VITE_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

⚠️ **Importante**: La Service Role Key debe mantenerse **SOLO en el backend** y nunca enviarse al frontend.

## Arquitectura del Sistema

### Multi-tenancy con RLS (Row Level Security)

```
┌─────────────────────────────────────────────────────────────┐
│                        SUPABASE AUTH                        │
├─────────────────────────────────────────────────────────────┤
│  auth.users (usuarios del sistema)                         │
│  ├── Admin User 1 (admin@club1.com)                        │
│  ├── Admin User 2 (admin@club2.com)                        │
│  ├── Employee User 1 (bartender@club1.com)                 │
│  └── Employee User 2 (security@club2.com)                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    PUBLIC SCHEMA                            │
├─────────────────────────────────────────────────────────────┤
│  clubs (1:1 con admins)                                    │
│  ├── Club 1                                                │
│  └── Club 2                                                │
│                                                             │
│  admins (1:1 con clubs)                                    │
│  ├── Admin User 1 → Club 1                                 │
│  └── Admin User 2 → Club 2                                 │
│                                                             │
│  employees (N:1 con clubs)                                 │
│  ├── Employee User 1 → Club 1                              │
│  └── Employee User 2 → Club 2                              │
└─────────────────────────────────────────────────────────────┘
```

## Proceso de Creación de Administradores

### Flujo Completo

1. **Crear usuario en Supabase Auth** (Service Role)
2. **Crear club** en `public.clubs`
3. **Crear cuentas iniciales** en `public.accounts`
4. **Vincular admin al club** en `public.admins`

### Código de Implementación

#### Backend Service (Node.js/Express)

```typescript
import { createClient } from '@supabase/supabase-js';

// Cliente con Service Role Key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role key
);

interface CreateAdminData {
  email: string;
  password: string;
  clubName: string;
  adminFullName: string;
  adminPhone?: string;
}

async function createAdminAndClub(data: CreateAdminData) {
  try {
    // 1. Crear usuario en auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // Confirmar email automáticamente
    });

    if (authError) throw authError;
    if (!authUser.user) throw new Error('No se pudo crear el usuario');

    // 2. Crear club
    const { data: club, error: clubError } = await supabaseAdmin
      .from('clubs')
      .insert({
        name: data.clubName,
        status: 'active'
      })
      .select()
      .single();

    if (clubError) throw clubError;

    // 3. Crear cuentas iniciales para el club
    const { error: accountsError } = await supabaseAdmin
      .from('accounts')
      .insert([
        {
          club_id: club.id,
          type: 'cash',
          name: 'Caja en Efectivo',
          currency: 'ARS',
          initial_balance: 0,
          is_primary: true
        },
        {
          club_id: club.id,
          type: 'wallet',
          name: 'Billetera Virtual',
          currency: 'ARS',
          initial_balance: 0,
          is_primary: false
        }
      ]);

    if (accountsError) throw accountsError;

    // 4. Crear registro de admin
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('admins')
      .insert({
        user_id: authUser.user.id,
        club_id: club.id,
        full_name: data.adminFullName,
        phone: data.adminPhone,
        status: 'active'
      })
      .select()
      .single();

    if (adminError) throw adminError;

    return {
      user: authUser.user,
      club,
      admin
    };

  } catch (error) {
    console.error('Error creating admin and club:', error);
    throw error;
  }
}
```

#### API Endpoint (Express)

```typescript
app.post('/api/admin/create-club-admin', async (req, res) => {
  try {
    // Verificar que la request viene de un usuario autorizado
    // (implementar tu lógica de autorización aquí)

    const { email, password, clubName, adminFullName, adminPhone } = req.body;

    const result = await createAdminAndClub({
      email,
      password,
      clubName,
      adminFullName,
      adminPhone
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
```

## Proceso de Creación de Empleados

### Implementación para Empleados

```typescript
interface CreateEmployeeData {
  email: string;
  password: string;
  clubId: string;        // ID del club al que pertenecerá
  fullName: string;
  phone?: string;
  category: 'bartender' | 'security' | 'dj' | 'waiter' | 'cashier' | 'cleaner' | 'host' | 'manager' | 'technician' | 'promoter' | 'other';
  hourlyRate?: number;
  hireDate?: string;
  employeeNumber?: string;
  notes?: string;
}

async function createEmployee(data: CreateEmployeeData) {
  try {
    // 1. Crear usuario en auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });

    if (authError) throw authError;
    if (!authUser.user) throw new Error('No se pudo crear el usuario');

    // 2. Crear registro de empleado
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('employees')
      .insert({
        user_id: authUser.user.id,
        club_id: data.clubId,
        full_name: data.fullName,
        phone: data.phone,
        category: data.category,
        hourly_rate: data.hourlyRate,
        hire_date: data.hireDate,
        employee_number: data.employeeNumber,
        notes: data.notes,
        status: 'active'
      })
      .select(`
        *,
        club:clubs(*)
      `)
      .single();

    if (employeeError) throw employeeError;

    return {
      user: authUser.user,
      employee
    };

  } catch (error) {
    console.error('Error creating employee:', error);
    throw error;
  }
}
```

## Frontend: Hook para Admins

### Hook para que Admins Gestionen Empleados

```typescript
// src/features/employees/hooks/useAdminEmployeeManagement.ts
import { useState } from 'react';

export const useAdminEmployeeManagement = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEmployee = async (employeeData: CreateEmployeeData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/create-employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}` // Token del admin
        },
        body: JSON.stringify(employeeData)
      });

      if (!response.ok) {
        throw new Error('Error al crear empleado');
      }

      const result = await response.json();
      return result.data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    createEmployee,
    loading,
    error
  };
};
```

## Políticas RLS Existentes

### Seguridad Multi-tenant

El sistema ya tiene implementadas las políticas RLS que garantizan:

1. **Service Role** puede hacer cualquier operación
2. **Admins** solo pueden ver y gestionar datos de su club
3. **Empleados** solo pueden ver su propio registro y datos limitados

### Políticas Clave

```sql
-- Admins pueden gestionar empleados de su club
CREATE POLICY employees_select_my_club_admin
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (club_id = fn_current_admin_club_id());

-- Service role puede todo
CREATE POLICY employees_all_service_role
  ON public.employees
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'service_role');
```

## Consideraciones de Seguridad

### ⚠️ Importantes

1. **Service Role Key**: NUNCA enviar al frontend
2. **Autorización**: Verificar permisos antes de crear usuarios
3. **Validación**: Validar todos los datos de entrada
4. **Logs**: Registrar todas las operaciones de creación de usuarios
5. **Cleanup**: Si falla la creación, limpiar registros parciales

### Ejemplo de Cleanup

```typescript
async function createAdminAndClub(data: CreateAdminData) {
  let authUserId: string | null = null;
  let clubId: string | null = null;

  try {
    // Crear usuario...
    authUserId = authUser.user.id;

    // Crear club...
    clubId = club.id;

    // Crear cuentas...
    // Crear admin...

  } catch (error) {
    // Cleanup en caso de error
    if (clubId) {
      await supabaseAdmin.from('clubs').delete().eq('id', clubId);
    }
    if (authUserId) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
    }
    throw error;
  }
}
```

## Testing

### Casos de Prueba

1. ✅ Crear admin y club exitosamente
2. ✅ Crear empleado exitosamente
3. ❌ Intentar crear con email duplicado
4. ❌ Intentar crear sin permisos
5. ❌ Verificar cleanup en caso de error

## Monitoreo

Implementar logs para:
- Creación de usuarios
- Asignación de roles
- Fallos en el proceso
- Intentos no autorizados

```typescript
console.log(`[ADMIN_CREATION] Club: ${clubName}, Admin: ${adminFullName}, User ID: ${authUser.user.id}`);
```