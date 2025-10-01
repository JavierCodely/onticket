# 💰 Sistema de Pagos - OnTicket

Este módulo implementa el sistema de gestión de pagos para personal y gastos operativos en OnTicket.

## 📋 Funcionalidades

### Tipos de Pagos Soportados
- **Pagos a Personal**: Empleados, DJs, gerentes
- **Gastos de Servicios**: Agua, luz, internet, etc.
- **Pagos a Proveedores**: Insumos, mantenimiento
- **Otros Gastos**: Categoría flexible para otros conceptos

### Métodos de Pago
- **Efectivo** (`cash`)
- **Transferencia** (`transfer`)
- **Cheque** (`check`)
- **Otros** (`other`)

### Características Principales
- ✅ **Totales por Método**: Separación de efectivo vs transferencias
- ✅ **Filtros de Fecha**: Consultas por períodos específicos
- ✅ **Integración con Cuentas**: Vinculación automática con sistema de cuentas
- ✅ **Auditoría Completa**: Registro de quién, cuándo y qué
- ✅ **Períodos de Pago**: Soporte para salarios mensuales y servicios
- ✅ **Multi-tenant**: Aislamiento por club con RLS

## 🗄️ Estructura de la Base de Datos

### Tabla Principal: `payments`
```sql
-- Campos principales
id, club_id, payment_number, payment_date
payment_type, category, recipient_name, amount
payment_method, description, period_start, period_end
```

### Vista: `payments_with_details`
Incluye información enriquecida con datos de empleados, cuentas y creadores.

## 🚀 Funciones Disponibles

### `fn_create_payment(...)`
Crea un nuevo pago con validaciones completas:
```sql
SELECT fn_create_payment(
  'employee_payment',     -- Tipo de pago
  'Salario Diciembre',    -- Categoría
  'employee',             -- Tipo de destinatario
  'uuid-empleado',        -- ID del empleado
  'Juan Pérez',           -- Nombre
  50000.00,               -- Monto
  'transfer',             -- Método de pago
  'Pago salario...',      -- Descripción
  'Notas adicionales',    -- Notas
  'TRF-001',              -- Referencia
  '2024-12-01'::date,     -- Período inicio
  '2024-12-31'::date,     -- Período fin
  'uuid-cuenta'           -- Cuenta asociada
);
```

### `fn_get_payments_stats(start_date, end_date)`
Obtiene estadísticas detalladas por período:
```sql
SELECT fn_get_payments_stats('2024-12-01', '2024-12-31');
```

Retorna:
- Total de pagos y montos
- Totales por efectivo/transferencia
- Agrupación por tipo y categoría
- Estadísticas por método de pago

## 📊 Consultas Típicas

### Pagos del Día
```sql
SELECT * FROM payments_with_details
WHERE DATE(payment_date) = CURRENT_DATE
ORDER BY payment_date DESC;
```

### Totales por Método (Mes Actual)
```sql
SELECT
  payment_method,
  COUNT(*) as cantidad,
  SUM(amount) as total
FROM payments
WHERE club_id = fn_current_admin_club_id()
  AND DATE(payment_date) >= date_trunc('month', CURRENT_DATE)
GROUP BY payment_method;
```

### Gastos por Categoría
```sql
SELECT
  COALESCE(category, 'Sin categoría') as categoria,
  SUM(amount) as total
FROM payments
WHERE club_id = fn_current_admin_club_id()
  AND DATE(payment_date) BETWEEN '2024-12-01' AND '2024-12-31'
GROUP BY category
ORDER BY total DESC;
```

## 🔒 Seguridad

- **RLS Habilitado**: Aislamiento por club
- **Solo Admins**: Únicamente administradores pueden gestionar pagos
- **Validaciones**: Verificación de pertenencia de empleados y cuentas
- **Auditoría**: Registro completo de cambios

## 📋 Ejemplos de Uso

### 1. Pago de Salario a Empleado
```sql
SELECT fn_create_payment(
  'employee_payment',
  'Salario Diciembre',
  'employee',
  (SELECT user_id FROM employees WHERE full_name = 'Juan Pérez'),
  'Juan Pérez',
  50000.00,
  'transfer',
  'Pago salario diciembre 2024',
  'Transferencia bancaria',
  'TRF-20241217-001',
  '2024-12-01'::date,
  '2024-12-31'::date,
  (SELECT id FROM accounts WHERE name = 'Cuenta Banco' AND type = 'bank')
);
```

### 2. Pago a DJ
```sql
SELECT fn_create_payment(
  'dj_payment',
  'Show Sábado',
  'dj',
  NULL,  -- Puede ser externo
  'DJ Martinez',
  25000.00,
  'cash',
  'Pago show sábado 14/12',
  'Pago en efectivo',
  NULL,
  '2024-12-14'::date,
  '2024-12-14'::date,
  (SELECT id FROM accounts WHERE name = 'Caja Principal' AND type = 'cash')
);
```

### 3. Pago de Servicios
```sql
SELECT fn_create_payment(
  'utility_payment',
  'Electricidad',
  'utility',
  NULL,
  'EDET',
  15000.00,
  'transfer',
  'Factura electricidad diciembre',
  'Pago servicio eléctrico',
  'EDET-20241217',
  '2024-12-01'::date,
  '2024-12-31'::date,
  (SELECT id FROM accounts WHERE name = 'Cuenta Banco' AND type = 'bank')
);
```

## 🔧 Instalación

Ejecutar el archivo SQL en este orden:
1. `001-payments-schema.sql` - Crear tablas, funciones y políticas

## 📈 Dashboard de Pagos

El sistema está diseñado para mostrar:

### Totales Principales
- **Total General**: Suma de todos los pagos
- **Total Efectivo**: Pagos en cash
- **Total Transferencias**: Pagos por transfer

### Filtros Disponibles
- Por fecha (desde/hasta)
- Por tipo de pago
- Por método de pago
- Por categoría

### Reportes
- Gastos mensuales vs ingresos
- Pagos por empleado
- Gastos por categoría
- Evolución temporal