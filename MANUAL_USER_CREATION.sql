-- ============================================================================
-- MANUAL USER CREATION AND ASSIGNMENT GUIDE FOR ONTICKET
-- ============================================================================
--
-- Este archivo contiene el código SQL comentado para crear manualmente usuarios
-- en Supabase Auth y asignarles clubs y roles en el sistema OnTicket.
--
-- IMPORTANTE: Este código debe ejecutarse desde el SQL Editor de Supabase
-- usando la Service Role Key (no desde la aplicación)
-- ============================================================================

-- ============================================================================
-- PASO 1: CREAR USUARIO EN SUPABASE AUTH
-- ============================================================================

-- OPCIÓN A: Crear usuario desde Supabase Dashboard
-- 1. Ve a Authentication → Users en el dashboard de Supabase
-- 2. Haz clic en "Invite user"
-- 3. Ingresa el email del usuario
-- 4. El usuario recibirá un email de invitación
-- 5. Copia el UUID del usuario creado para usarlo en los siguientes pasos

-- OPCIÓN B: Crear usuario mediante SQL (usando Service Role)
-- NOTA: Esto requiere el service_role key y debe ejecutarse con cuidado
/*
-- Esta función crea un usuario directamente en auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at
) VALUES (
  '00000000-0000-0000-0000-000000000000', -- instance_id (usar el de tu proyecto)
  gen_random_uuid(),                      -- id (se generará automáticamente)
  'authenticated',                        -- aud
  'authenticated',                        -- role
  'usuario@email.com',                    -- email del usuario
  crypt('password_temporal', gen_salt('bf')), -- contraseña encriptada (cambiar)
  NOW(),                                  -- email_confirmed_at
  NOW(),                                  -- invited_at
  '',                                     -- confirmation_token
  NOW(),                                  -- confirmation_sent_at
  '',                                     -- recovery_token
  null,                                   -- recovery_sent_at
  '',                                     -- email_change_token_new
  '',                                     -- email_change
  null,                                   -- email_change_sent_at
  null,                                   -- last_sign_in_at
  '{"provider": "email", "providers": ["email"]}', -- raw_app_meta_data
  '{}',                                   -- raw_user_meta_data
  false,                                  -- is_super_admin
  NOW(),                                  -- created_at
  NOW(),                                  -- updated_at
  null,                                   -- phone
  null,                                   -- phone_confirmed_at
  '',                                     -- phone_change
  '',                                     -- phone_change_token
  null,                                   -- phone_change_sent_at
  '',                                     -- email_change_token_current
  0,                                      -- email_change_confirm_status
  null,                                   -- banned_until
  '',                                     -- reauthentication_token
  null                                    -- reauthentication_sent_at
);
*/

-- RECOMENDACIÓN: Usar la OPCIÓN A desde el Dashboard es más seguro y fácil

-- ============================================================================
-- PASO 2: CREAR CLUB (si es necesario)
-- ============================================================================

-- Si el club no existe, crearlo primero
-- Copia el UUID generado para usarlo en el siguiente paso

INSERT INTO public.clubs (
  id,                    -- UUID del club (se generará automáticamente si no se especifica)
  name,                  -- Nombre comercial del club
  legal_name,            -- Razón social (opcional)
  tax_id,                -- CUIT o identificador fiscal (opcional)
  email,                 -- Email de contacto del club
  phone,                 -- Teléfono del club
  street,                -- Dirección: calle y número
  city,                  -- Ciudad
  province,              -- Provincia
  country,               -- País (por defecto Argentina)
  postal_code,           -- Código postal
  timezone,              -- Zona horaria (por defecto America/Argentina/Tucuman)
  status,                -- Estado del club: 'active', 'inactive', 'suspended'
  notes                  -- Observaciones adicionales (opcional)
) VALUES (
  gen_random_uuid(),     -- Se genera automáticamente, o puedes especificar uno
  'Club Nocturno Ejemplo', -- Cambiar por el nombre real del club
  'Club Nocturno Ejemplo SRL', -- Razón social
  '20-12345678-9',       -- CUIT (ejemplo)
  'contacto@clubejemplo.com', -- Email del club
  '+54 381 123-4567',    -- Teléfono
  'Av. Ejemplo 123',     -- Dirección
  'San Miguel de Tucumán', -- Ciudad
  'Tucumán',             -- Provincia
  'Argentina',           -- País
  '4000',                -- Código postal
  'America/Argentina/Tucuman', -- Zona horaria
  'active',              -- Estado activo
  'Club creado manualmente desde SQL' -- Notas
);

-- Para obtener el UUID del club recién creado:
-- SELECT id, name FROM public.clubs WHERE name = 'Club Nocturno Ejemplo';

-- ============================================================================
-- PASO 3: CREAR CUENTAS FINANCIERAS BÁSICAS PARA EL CLUB
-- ============================================================================

-- Crear cuenta de efectivo (cash)
INSERT INTO public.accounts (
  club_id,               -- UUID del club creado en el paso anterior
  type,                  -- Tipo de cuenta: 'cash', 'wallet', 'bank', 'other'
  name,                  -- Nombre descriptivo de la cuenta
  currency,              -- Moneda (por defecto ARS)
  initial_balance,       -- Saldo inicial
  is_primary            -- Si es la cuenta principal
) VALUES (
  'CLUB_UUID_AQUI',      -- Reemplazar con el UUID del club
  'cash',                -- Cuenta de efectivo
  'Caja Principal',      -- Nombre de la cuenta
  'ARS',                 -- Pesos argentinos
  0.00,                  -- Saldo inicial en cero
  true                   -- Marcar como cuenta principal
);

-- Crear cuenta de billetera virtual (wallet)
INSERT INTO public.accounts (
  club_id,
  type,
  name,
  currency,
  initial_balance,
  is_primary
) VALUES (
  'CLUB_UUID_AQUI',      -- Reemplazar con el UUID del club
  'wallet',              -- Billetera virtual
  'Billetera Digital',   -- Nombre de la cuenta
  'ARS',                 -- Pesos argentinos
  0.00,                  -- Saldo inicial en cero
  false                  -- No es la cuenta principal
);

-- Crear cuenta bancaria (opcional)
INSERT INTO public.accounts (
  club_id,
  type,
  name,
  currency,
  initial_balance,
  is_primary
) VALUES (
  'CLUB_UUID_AQUI',      -- Reemplazar con el UUID del club
  'bank',                -- Cuenta bancaria
  'Cuenta Banco Nación', -- Nombre de la cuenta
  'ARS',                 -- Pesos argentinos
  0.00,                  -- Saldo inicial en cero
  false                  -- No es la cuenta principal
);

-- ============================================================================
-- PASO 4A: ASIGNAR ROL DE ADMIN
-- ============================================================================

-- Crear un administrador para el club
-- IMPORTANTE: Cada club puede tener solo UN administrador (relación 1:1)

INSERT INTO public.admins (
  user_id,               -- UUID del usuario creado en Supabase Auth
  club_id,               -- UUID del club
  full_name,             -- Nombre completo del admin
  phone,                 -- Teléfono del admin (opcional)
  status                 -- Estado: 'active' o 'inactive'
) VALUES (
  'USER_UUID_AQUI',      -- Reemplazar con el UUID del usuario de auth.users
  'CLUB_UUID_AQUI',      -- Reemplazar con el UUID del club
  'Juan Carlos Pérez',   -- Nombre completo del administrador
  '+54 381 987-6543',    -- Teléfono del administrador
  'active'               -- Estado activo para que pueda acceder
);

-- ============================================================================
-- PASO 4B: ASIGNAR ROL DE EMPLEADO (ALTERNATIVA AL ADMIN)
-- ============================================================================

-- Si en lugar de admin quieres crear un empleado, usa este INSERT
-- NOTA: Un usuario NO puede ser admin y empleado al mismo tiempo

/*
INSERT INTO public.employees (
  user_id,               -- UUID del usuario creado en Supabase Auth
  club_id,               -- UUID del club
  employee_number,       -- Número de empleado (opcional)
  full_name,             -- Nombre completo del empleado
  phone,                 -- Teléfono del empleado (opcional)
  category,              -- Categoría del empleado
  hourly_rate,           -- Tarifa por hora (opcional)
  hire_date,             -- Fecha de contratación
  status,                -- Estado: 'active' o 'inactive'
  notes                  -- Observaciones (opcional)
) VALUES (
  'USER_UUID_AQUI',      -- Reemplazar con el UUID del usuario de auth.users
  'CLUB_UUID_AQUI',      -- Reemplazar con el UUID del club
  'EMP001',              -- Número de empleado
  'María González',      -- Nombre completo del empleado
  '+54 381 555-1234',    -- Teléfono del empleado
  'bartender',           -- Categorías disponibles: 'bartender', 'security', 'dj',
                         -- 'waiter', 'cashier', 'cleaner', 'host', 'manager',
                         -- 'technician', 'promoter', 'other'
  2500.00,               -- Tarifa por hora en ARS
  CURRENT_DATE,          -- Fecha de contratación (hoy)
  'active',              -- Estado activo para que pueda acceder
  'Empleado creado manualmente desde SQL' -- Observaciones
);
*/

-- ============================================================================
-- PASO 5: VERIFICAR LA CREACIÓN
-- ============================================================================

-- Verificar que el usuario se creó correctamente en auth.users
SELECT
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'usuario@email.com'; -- Reemplazar con el email usado

-- Verificar que el club se creó correctamente
SELECT
  id,
  name,
  status,
  created_at
FROM public.clubs
WHERE name = 'Club Nocturno Ejemplo'; -- Reemplazar con el nombre usado

-- Verificar que las cuentas se crearon correctamente
SELECT
  id,
  club_id,
  type,
  name,
  current_balance
FROM public.accounts_with_balance
WHERE club_id = 'CLUB_UUID_AQUI'; -- Reemplazar con el UUID del club

-- Verificar que el admin se asignó correctamente
SELECT
  a.user_id,
  a.club_id,
  a.full_name,
  a.status,
  c.name as club_name,
  u.email
FROM public.admins a
JOIN public.clubs c ON c.id = a.club_id
JOIN auth.users u ON u.id = a.user_id
WHERE a.user_id = 'USER_UUID_AQUI'; -- Reemplazar con el UUID del usuario

-- Si creaste un empleado en su lugar:
/*
SELECT
  e.user_id,
  e.club_id,
  e.full_name,
  e.category,
  e.status,
  c.name as club_name,
  u.email
FROM public.employees e
JOIN public.clubs c ON c.id = e.club_id
JOIN auth.users u ON u.id = e.user_id
WHERE e.user_id = 'USER_UUID_AQUI'; -- Reemplazar con el UUID del usuario
*/

-- ============================================================================
-- PASO 6: CONFIGURAR TRANSACCIÓN INICIAL (OPCIONAL)
-- ============================================================================

-- Si quieres crear una transacción inicial para la caja (por ejemplo, apertura)
/*
INSERT INTO public.account_transactions (
  account_id,            -- UUID de la cuenta (normalmente la de efectivo)
  occurred_at,           -- Fecha y hora del movimiento
  amount,                -- Monto (positivo para ingreso, negativo para egreso)
  description,           -- Descripción del movimiento
  ref_type,              -- Tipo de referencia
  created_by             -- UUID del usuario que crea el movimiento
) VALUES (
  'ACCOUNT_UUID_AQUI',   -- UUID de la cuenta de efectivo creada
  NOW(),                 -- Fecha y hora actual
  10000.00,              -- Monto inicial (ejemplo: $10,000)
  'Apertura inicial de caja', -- Descripción
  'apertura',            -- Tipo de referencia
  'USER_UUID_AQUI'       -- UUID del admin que abre la caja
);
*/

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

/*
1. SEGURIDAD:
   - Este código debe ejecutarse solo desde el SQL Editor de Supabase
   - Usar la Service Role Key para bypasear las políticas RLS
   - Nunca exponer estas operaciones en la aplicación frontend

2. ROLES Y PERMISOS:
   - ADMIN: Puede gestionar todo su club (empleados, cuentas, transacciones)
   - EMPLEADO: Puede ver datos del club y crear transacciones (ventas)
   - Un usuario solo puede ser ADMIN o EMPLEADO, no ambos

3. VALIDACIONES:
   - Cada club puede tener solo UN admin (constraint UNIQUE en club_id)
   - Los empleados pueden ser múltiples por club
   - Users inactivos (status = 'inactive') no pueden acceder al sistema

4. PROCESO RECOMENDADO:
   1. Crear usuario desde Supabase Dashboard (Authentication → Users → Invite)
   2. Crear club con este SQL (si no existe)
   3. Crear cuentas básicas del club
   4. Asignar rol (admin o empleado) al usuario
   5. Verificar que todo se creó correctamente

5. MULTI-TENANCY:
   - Las políticas RLS aseguran que cada club solo vea sus propios datos
   - Los admins no pueden ver datos de otros clubs
   - Los empleados solo ven datos de su propio club

6. TROUBLESHOOTING:
   - Si el usuario no puede acceder: verificar status = 'active'
   - Si no ve datos: verificar que club_id esté correctamente asignado
   - Si hay errores de permisos: verificar que las policies RLS estén bien configuradas
*/