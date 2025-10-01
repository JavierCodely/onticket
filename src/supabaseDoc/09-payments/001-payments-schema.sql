-- ===========================================================
-- SISTEMA DE PAGOS - PERSONAL Y GASTOS
-- ===========================================================
-- Sistema para registrar pagos al personal (empleados, DJs, etc.)
-- y gastos operativos (agua, luz, etc.) con totales por método de pago

-- ========================================
-- PASO 1: CREAR TIPOS ENUM
-- ========================================

-- Tipos de pago/gasto
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type') THEN
    CREATE TYPE payment_type AS ENUM (
      'employee_payment',    -- Pago a empleado
      'dj_payment',         -- Pago a DJ
      'utility_payment',    -- Servicios (agua, luz, etc.)
      'supply_payment',     -- Insumos/productos
      'maintenance_payment', -- Mantenimiento
      'other_payment'       -- Otros gastos
    );
  END IF;

  -- Métodos de pago (reutilizamos payment_method si existe, sino creamos uno similar)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
    CREATE TYPE payment_method_type AS ENUM (
      'cash',         -- Efectivo
      'transfer',     -- Transferencia bancaria
      'check',        -- Cheque
      'other'         -- Otro método
    );
  END IF;

  -- Estado del pago
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM (
      'pending',      -- Pendiente
      'completed',    -- Completado
      'cancelled'     -- Cancelado
    );
  END IF;
END$$;

-- ========================================
-- PASO 2: CREAR TABLA PRINCIPAL DE PAGOS
-- ========================================

CREATE TABLE IF NOT EXISTS public.payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Información básica del pago
  payment_number        text NOT NULL,                               -- Número único de pago (opcional)
  payment_date          timestamptz NOT NULL DEFAULT NOW(),         -- Fecha y hora del pago

  -- Tipo y categoría del pago
  payment_type          payment_type NOT NULL,                      -- Tipo de pago
  category              text,                                       -- Categoría específica (ej: "Agua", "Luz", "Salario")

  -- Información del destinatario
  recipient_type        text,                                       -- 'employee', 'dj', 'supplier', 'utility', 'other'
  recipient_id          uuid,                                       -- ID del empleado/DJ si aplica (auth.users.id)
  recipient_name        text NOT NULL,                              -- Nombre del destinatario
  recipient_details     jsonb,                                      -- Detalles adicionales del destinatario

  -- Información financiera
  amount                numeric(12,2) NOT NULL CHECK (amount > 0), -- Monto del pago
  currency              char(3) NOT NULL DEFAULT 'ARS',             -- Moneda
  payment_method        payment_method_type NOT NULL,              -- Método de pago

  -- Detalles del pago
  description           text,                                       -- Descripción del pago
  notes                 text,                                       -- Notas adicionales
  reference_number      text,                                       -- Número de referencia (transferencia, cheque, etc.)

  -- Período de pago (para salarios, servicios mensuales, etc.)
  period_start          date,                                       -- Inicio del período
  period_end            date,                                       -- Fin del período

  -- Estado y auditoría
  status                payment_status NOT NULL DEFAULT 'completed', -- Estado del pago

  -- Vinculación a cuentas (opcional)
  account_id            uuid REFERENCES public.accounts(id),        -- Cuenta desde la que se paga

  -- Auditoría completa
  created_by            uuid NOT NULL REFERENCES auth.users(id),    -- Quién creó el pago
  updated_by            uuid REFERENCES auth.users(id),             -- Quién actualizó el pago
  created_at            timestamptz NOT NULL DEFAULT NOW(),         -- Cuándo se creó
  updated_at            timestamptz NOT NULL DEFAULT NOW(),         -- Cuándo se actualizó

  -- Constraints
  UNIQUE (club_id, payment_number),                                -- Número único por club (si se usa)
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)  -- Período válido
);

-- ========================================
-- PASO 3: CREAR ÍNDICES OPTIMIZADOS
-- ========================================

-- Índices principales
CREATE INDEX IF NOT EXISTS payments_club_idx ON public.payments (club_id);
CREATE INDEX IF NOT EXISTS payments_date_idx ON public.payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS payments_type_idx ON public.payments (payment_type);
CREATE INDEX IF NOT EXISTS payments_method_idx ON public.payments (payment_method);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status);
CREATE INDEX IF NOT EXISTS payments_recipient_idx ON public.payments (recipient_id);
CREATE INDEX IF NOT EXISTS payments_account_idx ON public.payments (account_id);

-- Índices compuestos para consultas frecuentes
CREATE INDEX IF NOT EXISTS payments_club_date_idx ON public.payments (club_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS payments_club_type_idx ON public.payments (club_id, payment_type);
CREATE INDEX IF NOT EXISTS payments_club_method_idx ON public.payments (club_id, payment_method);
CREATE INDEX IF NOT EXISTS payments_period_idx ON public.payments (period_start, period_end);

-- ========================================
-- PASO 4: CREAR TRIGGERS
-- ========================================

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ========================================
-- PASO 5: CREAR FUNCIONES DE NEGOCIO
-- ========================================

-- 5.1) Función para generar número de pago automático (opcional)
CREATE OR REPLACE FUNCTION public.fn_generate_payment_number(p_club_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_prefix text;
  v_sequence integer;
  v_payment_number text;
BEGIN
  -- Formato: PAY-YYYYMMDD-NNNN (ej: PAY-20241217-0001)
  v_date_prefix := 'PAY-' || to_char(NOW(), 'YYYYMMDD');

  -- Obtener siguiente número secuencial para el día
  SELECT COALESCE(MAX(
    CASE
      WHEN payment_number LIKE v_date_prefix || '-%'
      THEN (split_part(payment_number, '-', 3))::integer
      ELSE 0
    END
  ), 0) + 1
  INTO v_sequence
  FROM public.payments
  WHERE club_id = p_club_id
    AND DATE(payment_date) = CURRENT_DATE;

  v_payment_number := v_date_prefix || '-' || lpad(v_sequence::text, 4, '0');

  RETURN v_payment_number;
END;
$$;

-- 5.2) Función para crear pago
CREATE OR REPLACE FUNCTION public.fn_create_payment(
  p_payment_type payment_type,
  p_recipient_name text,
  p_amount numeric,
  p_payment_method payment_method_type,
  p_category text DEFAULT NULL,
  p_recipient_type text DEFAULT NULL,
  p_recipient_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_reference_number text DEFAULT NULL,
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL,
  p_account_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_club_id uuid;
  v_payment_number text;
BEGIN
  -- Verificar que el usuario actual es admin
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden crear pagos';
  END IF;

  -- Validar datos básicos
  IF p_recipient_name IS NULL OR trim(p_recipient_name) = '' THEN
    RAISE EXCEPTION 'El nombre del destinatario es requerido';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero';
  END IF;

  -- Verificar que la cuenta pertenece al club (si se especifica)
  IF p_account_id IS NOT NULL THEN
    IF NOT fn_account_belongs_to_my_club(p_account_id) THEN
      RAISE EXCEPTION 'La cuenta especificada no pertenece a este club';
    END IF;
  END IF;

  -- Verificar que el empleado/DJ pertenece al club (si se especifica)
  IF p_recipient_id IS NOT NULL THEN
    IF p_recipient_type = 'employee' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.user_id = p_recipient_id AND e.club_id = v_club_id
      ) THEN
        RAISE EXCEPTION 'El empleado especificado no pertenece a este club';
      END IF;
    ELSIF p_recipient_type = 'admin' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.admins a
        WHERE a.user_id = p_recipient_id AND a.club_id = v_club_id
      ) THEN
        RAISE EXCEPTION 'El administrador especificado no pertenece a este club';
      END IF;
    END IF;
  END IF;

  -- Generar número de pago (opcional)
  v_payment_number := fn_generate_payment_number(v_club_id);

  -- Crear el pago
  INSERT INTO public.payments (
    club_id,
    payment_number,
    payment_type,
    category,
    recipient_type,
    recipient_id,
    recipient_name,
    amount,
    payment_method,
    description,
    notes,
    reference_number,
    period_start,
    period_end,
    account_id,
    created_by,
    updated_by
  ) VALUES (
    v_club_id,
    v_payment_number,
    p_payment_type,
    p_category,
    p_recipient_type,
    p_recipient_id,
    p_recipient_name,
    p_amount,
    p_payment_method,
    p_description,
    p_notes,
    p_reference_number,
    p_period_start,
    p_period_end,
    p_account_id,
    auth.uid(),
    auth.uid()
  ) RETURNING id INTO v_payment_id;

  -- Crear transacción en la cuenta si se especifica
  IF p_account_id IS NOT NULL THEN
    INSERT INTO public.account_transactions (
      account_id,
      amount,
      description,
      ref_type,
      ref_id,
      created_by
    ) VALUES (
      p_account_id,
      -p_amount,  -- Negativo porque es un egreso
      'Pago: ' || p_recipient_name || COALESCE(' - ' || p_description, ''),
      'payment',
      v_payment_id,
      auth.uid()
    );
  END IF;

  RAISE NOTICE 'Pago creado: % - $%', v_payment_number, p_amount;

  RETURN v_payment_id;
END;
$$;

-- 5.3) Función para obtener estadísticas de pagos
CREATE OR REPLACE FUNCTION public.fn_get_payments_stats(
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_stats jsonb;
  v_by_type jsonb;
  v_by_method jsonb;
  v_by_category jsonb;
BEGIN
  v_club_id := fn_current_admin_club_id();
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden ver estadísticas de pagos';
  END IF;

  -- Obtener estadísticas básicas
  SELECT jsonb_build_object(
    'total_payments', COUNT(*),
    'total_amount', COALESCE(SUM(amount), 0),
    'total_cash', COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0),
    'total_transfer', COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN amount ELSE 0 END), 0),
    'total_other', COALESCE(SUM(CASE WHEN payment_method IN ('check', 'other') THEN amount ELSE 0 END), 0)
  ) INTO v_stats
  FROM public.payments p
  WHERE p.club_id = v_club_id
    AND p.status = 'completed'
    AND DATE(p.payment_date) BETWEEN p_start_date AND p_end_date;

  -- Obtener estadísticas por tipo
  SELECT COALESCE(jsonb_object_agg(payment_type, type_stats), '{}'::jsonb) INTO v_by_type
  FROM (
    SELECT
      payment_type,
      jsonb_build_object(
        'count', COUNT(*),
        'amount', SUM(amount)
      ) as type_stats
    FROM public.payments p
    WHERE p.club_id = v_club_id
      AND p.status = 'completed'
      AND DATE(p.payment_date) BETWEEN p_start_date AND p_end_date
    GROUP BY payment_type
  ) t;

  -- Obtener estadísticas por método
  SELECT COALESCE(jsonb_object_agg(payment_method, method_stats), '{}'::jsonb) INTO v_by_method
  FROM (
    SELECT
      payment_method,
      jsonb_build_object(
        'count', COUNT(*),
        'amount', SUM(amount)
      ) as method_stats
    FROM public.payments p
    WHERE p.club_id = v_club_id
      AND p.status = 'completed'
      AND DATE(p.payment_date) BETWEEN p_start_date AND p_end_date
    GROUP BY payment_method
  ) m;

  -- Obtener estadísticas por categoría
  SELECT COALESCE(jsonb_object_agg(COALESCE(category, 'Sin categoría'), category_stats), '{}'::jsonb) INTO v_by_category
  FROM (
    SELECT
      COALESCE(category, 'Sin categoría') as category,
      jsonb_build_object(
        'count', COUNT(*),
        'amount', SUM(amount)
      ) as category_stats
    FROM public.payments p
    WHERE p.club_id = v_club_id
      AND p.status = 'completed'
      AND DATE(p.payment_date) BETWEEN p_start_date AND p_end_date
    GROUP BY COALESCE(category, 'Sin categoría')
  ) c;

  -- Combinar todas las estadísticas
  v_stats := v_stats || jsonb_build_object(
    'by_type', v_by_type,
    'by_method', v_by_method,
    'by_category', v_by_category
  );

  RETURN v_stats;
END;
$$;

-- ========================================
-- PASO 6: CREAR VISTA CON DETALLES
-- ========================================

CREATE OR REPLACE VIEW public.payments_with_details AS
SELECT
  p.*,

  -- Información del empleado/admin destinatario
  CASE
    WHEN p.recipient_type = 'employee' AND e.user_id IS NOT NULL THEN
      jsonb_build_object(
        'type', 'employee',
        'full_name', e.full_name,
        'category', e.category,
        'employee_number', e.employee_number
      )
    WHEN p.recipient_type = 'admin' AND a.user_id IS NOT NULL THEN
      jsonb_build_object(
        'type', 'admin',
        'full_name', a.full_name
      )
    ELSE
      jsonb_build_object(
        'type', p.recipient_type,
        'name', p.recipient_name
      )
  END as recipient_info,

  -- Información de la cuenta
  CASE
    WHEN acc.id IS NOT NULL THEN
      jsonb_build_object(
        'id', acc.id,
        'name', acc.name,
        'type', acc.type
      )
    ELSE NULL
  END as account_info,

  -- Información del creador
  jsonb_build_object(
    'created_by_name', COALESCE(creator_admin.full_name, creator_emp.full_name, 'Usuario desconocido')
  ) as creator_info

FROM public.payments p
LEFT JOIN public.employees e ON e.user_id = p.recipient_id AND p.recipient_type = 'employee'
LEFT JOIN public.admins a ON a.user_id = p.recipient_id AND p.recipient_type = 'admin'
LEFT JOIN public.accounts acc ON acc.id = p.account_id
LEFT JOIN public.admins creator_admin ON creator_admin.user_id = p.created_by
LEFT JOIN public.employees creator_emp ON creator_emp.user_id = p.created_by;

-- ========================================
-- PASO 7: CONFIGURAR SEGURIDAD RLS
-- ========================================

-- Habilitar RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 7.1) Política para service_role
CREATE POLICY payments_all_service_role
  ON public.payments
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- 7.2) Políticas para admins (pueden ver y gestionar pagos de su club)
CREATE POLICY payments_admin_select
  ON public.payments
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

CREATE POLICY payments_admin_insert
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY payments_admin_update
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() )
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY payments_admin_delete
  ON public.payments
  FOR DELETE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

-- 7.3) RLS en la vista
ALTER VIEW public.payments_with_details SET (security_invoker = on);

-- ========================================
-- COMENTARIOS DE USO
-- ========================================

/*
EJEMPLOS DE USO:

1. PAGO A EMPLEADO:
SELECT fn_create_payment(
  'employee_payment',
  'Salario Diciembre',
  'employee',
  'uuid-del-empleado'::uuid,
  'Juan Pérez',
  50000.00,
  'transfer',
  'Pago salario diciembre 2024',
  'Transferencia CBU: 1234567890',
  'TRF-20241217-001',
  '2024-12-01'::date,
  '2024-12-31'::date,
  'uuid-cuenta-banco'::uuid
);

2. PAGO A DJ:
SELECT fn_create_payment(
  'dj_payment',
  'Show Sábado',
  'dj',
  'uuid-del-dj'::uuid,
  'DJ Martinez',
  25000.00,
  'cash',
  'Pago show sábado 14/12',
  'Efectivo',
  NULL,
  '2024-12-14'::date,
  '2024-12-14'::date,
  'uuid-cuenta-efectivo'::uuid
);

3. PAGO DE SERVICIOS:
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
  'TRF-20241217-002',
  '2024-12-01'::date,
  '2024-12-31'::date,
  'uuid-cuenta-banco'::uuid
);

4. VER PAGOS CON FILTRO DE FECHA:
SELECT * FROM payments_with_details
WHERE DATE(payment_date) BETWEEN '2024-12-01' AND '2024-12-31'
ORDER BY payment_date DESC;

5. ESTADÍSTICAS DEL MES:
SELECT fn_get_payments_stats('2024-12-01'::date, '2024-12-31'::date);

CARACTERÍSTICAS:
✅ Pagos a empleados, DJs y proveedores
✅ Gastos de servicios (agua, luz, etc.)
✅ Totales por método de pago (efectivo/transferencia)
✅ Filtros por fecha y categoría
✅ Integración con sistema de cuentas existente
✅ Auditoría completa
✅ Numeración automática
✅ Períodos de pago
✅ Seguridad RLS por club
✅ Solo admins pueden gestionar pagos
*/