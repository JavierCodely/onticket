-- ===========================================================
-- SISTEMA DE INICIO Y CIERRE DE NOCHE
-- ===========================================================
-- Este sistema permite registrar el stock de inicio y cierre de cada noche
-- para calcular automáticamente las ventas totales por producto.
--
-- NOTA: Este script requiere que las categorías de productos estén actualizadas.
-- Ejecutar primero: 07-products-stock/004-update-product-categories.sql

-- 01) Tipos enumerados para sesiones de noche
DO $$
BEGIN
  -- Estado de la sesión de noche
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'night_session_status') THEN
    CREATE TYPE night_session_status AS ENUM (
      'open',      -- Noche iniciada (stock de inicio registrado)
      'closed'     -- Noche cerrada (stock de cierre registrado)
    );
  END IF;
END$$;

-- 02) Tabla principal de sesiones de noche
CREATE TABLE IF NOT EXISTS public.night_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Información de la sesión
  session_date          date NOT NULL,                           -- Fecha de la noche
  status                night_session_status NOT NULL DEFAULT 'open',

  -- Timestamps
  started_at            timestamptz NOT NULL DEFAULT now(),      -- Cuando se inició la noche
  closed_at             timestamptz,                             -- Cuando se cerró la noche

  -- Auditoría
  started_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT night_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT night_sessions_club_date_unique UNIQUE (club_id, session_date),
  CONSTRAINT night_sessions_closed_after_started CHECK (closed_at IS NULL OR closed_at >= started_at)
);

-- 02.1) Índices para optimización
CREATE INDEX IF NOT EXISTS idx_night_sessions_club_id ON public.night_sessions (club_id);
CREATE INDEX IF NOT EXISTS idx_night_sessions_session_date ON public.night_sessions (session_date);
CREATE INDEX IF NOT EXISTS idx_night_sessions_status ON public.night_sessions (status);
CREATE INDEX IF NOT EXISTS idx_night_sessions_club_date ON public.night_sessions (club_id, session_date);
CREATE INDEX IF NOT EXISTS idx_night_sessions_club_status ON public.night_sessions (club_id, status);

-- 02.2) Comentarios en la tabla
COMMENT ON TABLE public.night_sessions IS 'Sesiones de inicio y cierre de noche para control de stock';
COMMENT ON COLUMN public.night_sessions.session_date IS 'Fecha de la sesión (solo una por día por club)';
COMMENT ON COLUMN public.night_sessions.status IS 'Estado de la sesión: open (abierta) o closed (cerrada)';
COMMENT ON COLUMN public.night_sessions.started_at IS 'Timestamp de cuando se inició la sesión';
COMMENT ON COLUMN public.night_sessions.closed_at IS 'Timestamp de cuando se cerró la sesión (NULL si está abierta)';

-- 02.3) Trigger de updated_at
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_night_sessions_updated_at ON public.night_sessions;
CREATE TRIGGER trg_night_sessions_updated_at
  BEFORE UPDATE ON public.night_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- 03) Tabla de detalles de stock por producto en cada sesión
CREATE TABLE IF NOT EXISTS public.night_session_products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            uuid NOT NULL REFERENCES public.night_sessions(id) ON DELETE CASCADE,
  product_id            uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  club_id               uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Stock de inicio
  opening_stock         integer NOT NULL DEFAULT 0,              -- Stock al inicio de la noche

  -- Stock de cierre
  closing_stock         integer,                                 -- Stock al final de la noche

  -- Ventas calculadas (generado automáticamente)
  total_sold            integer GENERATED ALWAYS AS (
    CASE
      WHEN closing_stock IS NOT NULL THEN opening_stock - closing_stock
      ELSE 0
    END
  ) STORED,

  -- Metadatos
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT night_session_products_pkey PRIMARY KEY (id),
  CONSTRAINT night_session_products_session_product_unique UNIQUE (session_id, product_id),
  CONSTRAINT night_session_products_opening_stock_check CHECK (opening_stock >= 0),
  CONSTRAINT night_session_products_closing_stock_check CHECK (closing_stock IS NULL OR closing_stock >= 0),
  CONSTRAINT night_session_products_stock_logic_check CHECK (closing_stock IS NULL OR closing_stock <= opening_stock)
);

-- 03.1) Índices para optimización
CREATE INDEX IF NOT EXISTS idx_night_session_products_session_id ON public.night_session_products (session_id);
CREATE INDEX IF NOT EXISTS idx_night_session_products_product_id ON public.night_session_products (product_id);
CREATE INDEX IF NOT EXISTS idx_night_session_products_club_id ON public.night_session_products (club_id);
CREATE INDEX IF NOT EXISTS idx_night_session_products_session_product ON public.night_session_products (session_id, product_id);

-- 03.2) Comentarios en la tabla
COMMENT ON TABLE public.night_session_products IS 'Detalles de stock por producto en cada sesión de noche';
COMMENT ON COLUMN public.night_session_products.opening_stock IS 'Stock al iniciar la noche';
COMMENT ON COLUMN public.night_session_products.closing_stock IS 'Stock al cerrar la noche (NULL si sesión abierta)';
COMMENT ON COLUMN public.night_session_products.total_sold IS 'Unidades vendidas calculadas (opening_stock - closing_stock)';

-- 03.3) Trigger de updated_at
DROP TRIGGER IF EXISTS trg_night_session_products_updated_at ON public.night_session_products;
CREATE TRIGGER trg_night_session_products_updated_at
  BEFORE UPDATE ON public.night_session_products
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- 04) Vista combinada de sesiones con productos
CREATE OR REPLACE VIEW public.night_sessions_with_products AS
SELECT
  ns.id as session_id,
  ns.club_id,
  ns.session_date,
  ns.status,
  ns.started_at,
  ns.closed_at,
  ns.started_by,
  ns.closed_by,
  nsp.id as product_entry_id,
  nsp.product_id,
  p.name as product_name,
  p.category as product_category,
  p.unit as product_unit,
  p.sku as product_sku,
  nsp.opening_stock,
  nsp.closing_stock,
  nsp.total_sold
FROM public.night_sessions ns
LEFT JOIN public.night_session_products nsp ON nsp.session_id = ns.id
LEFT JOIN public.products p ON p.id = nsp.product_id
ORDER BY ns.session_date DESC, p.category ASC, p.name ASC;

-- 04.1) RLS en la vista
ALTER VIEW public.night_sessions_with_products SET (security_invoker = on);

COMMENT ON VIEW public.night_sessions_with_products IS 'Vista combinada de sesiones con sus productos para facilitar consultas';

-- 05) Función para iniciar noche (capturar stock actual)
CREATE OR REPLACE FUNCTION public.fn_start_night_session(
  p_session_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_session_id uuid;
  v_existing_session uuid;
BEGIN
  -- Obtener club del admin
  v_club_id := fn_current_admin_club_id();

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden iniciar sesiones de noche';
  END IF;

  -- Verificar si ya existe una sesión para esta fecha
  SELECT id INTO v_existing_session
  FROM public.night_sessions
  WHERE club_id = v_club_id
    AND session_date = p_session_date;

  IF v_existing_session IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe una sesión para la fecha %', p_session_date;
  END IF;

  -- Crear la sesión
  INSERT INTO public.night_sessions (
    club_id,
    session_date,
    status,
    started_by
  ) VALUES (
    v_club_id,
    p_session_date,
    'open',
    auth.uid()
  ) RETURNING id INTO v_session_id;

  -- Capturar stock actual de todos los productos activos
  INSERT INTO public.night_session_products (
    session_id,
    product_id,
    club_id,
    opening_stock
  )
  SELECT
    v_session_id,
    p.id,
    v_club_id,
    COALESCE(ps.current_stock, 0)
  FROM public.products p
  LEFT JOIN public.product_stock ps ON ps.product_id = p.id
  WHERE p.club_id = v_club_id
    AND p.status = 'active'
  ORDER BY p.category, p.name;

  RETURN v_session_id;
END;
$$;

COMMENT ON FUNCTION public.fn_start_night_session IS 'Inicia una sesión de noche capturando el stock actual de todos los productos activos';

-- 06) Función para cerrar noche (capturar stock de cierre)
CREATE OR REPLACE FUNCTION public.fn_close_night_session(
  p_session_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_session_status night_session_status;
  v_products_updated integer;
BEGIN
  -- Obtener club del admin
  v_club_id := fn_current_admin_club_id();

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden cerrar sesiones de noche';
  END IF;

  -- Verificar que la sesión existe y pertenece al club
  SELECT status INTO v_session_status
  FROM public.night_sessions
  WHERE id = p_session_id
    AND club_id = v_club_id;

  IF v_session_status IS NULL THEN
    RAISE EXCEPTION 'Sesión no encontrada o no pertenece a su club';
  END IF;

  IF v_session_status = 'closed' THEN
    RAISE EXCEPTION 'La sesión ya está cerrada';
  END IF;

  -- Actualizar stock de cierre para todos los productos
  UPDATE public.night_session_products nsp
  SET closing_stock = COALESCE(ps.current_stock, 0)
  FROM public.product_stock ps
  WHERE nsp.session_id = p_session_id
    AND nsp.product_id = ps.product_id;

  GET DIAGNOSTICS v_products_updated = ROW_COUNT;

  -- Marcar productos sin stock como cerrados con 0
  UPDATE public.night_session_products nsp
  SET closing_stock = 0
  WHERE nsp.session_id = p_session_id
    AND nsp.closing_stock IS NULL;

  -- Marcar la sesión como cerrada
  UPDATE public.night_sessions
  SET
    status = 'closed',
    closed_at = now(),
    closed_by = auth.uid()
  WHERE id = p_session_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.fn_close_night_session IS 'Cierra una sesión de noche capturando el stock final y calculando ventas automáticamente';

-- 07) Función para obtener resumen de una sesión
CREATE OR REPLACE FUNCTION public.fn_get_night_session_summary(
  p_session_id uuid
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_category product_category,
  product_sku text,
  opening_stock integer,
  closing_stock integer,
  total_sold integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  -- Obtener club del admin
  v_club_id := fn_current_admin_club_id();

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN QUERY
  SELECT
    nsp.product_id,
    p.name,
    p.category,
    p.sku,
    nsp.opening_stock,
    nsp.closing_stock,
    nsp.total_sold
  FROM public.night_session_products nsp
  JOIN public.products p ON p.id = nsp.product_id
  WHERE nsp.session_id = p_session_id
    AND nsp.club_id = v_club_id
  ORDER BY p.category, p.name;
END;
$$;

COMMENT ON FUNCTION public.fn_get_night_session_summary IS 'Obtiene el resumen detallado de una sesión con todos sus productos';

-- 08) Función para obtener sesión por categoría de producto
CREATE OR REPLACE FUNCTION public.fn_get_night_session_by_category(
  p_session_id uuid,
  p_category product_category
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_category product_category,
  product_sku text,
  opening_stock integer,
  closing_stock integer,
  total_sold integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  -- Obtener club del admin
  v_club_id := fn_current_admin_club_id();

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN QUERY
  SELECT
    nsp.product_id,
    p.name,
    p.category,
    p.sku,
    nsp.opening_stock,
    nsp.closing_stock,
    nsp.total_sold
  FROM public.night_session_products nsp
  JOIN public.products p ON p.id = nsp.product_id
  WHERE nsp.session_id = p_session_id
    AND nsp.club_id = v_club_id
    AND p.category = p_category
  ORDER BY p.name;
END;
$$;

COMMENT ON FUNCTION public.fn_get_night_session_by_category IS 'Obtiene los productos de una sesión filtrados por categoría';

-- 09) Habilitar RLS
ALTER TABLE public.night_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.night_session_products ENABLE ROW LEVEL SECURITY;

-- 10) Políticas RLS para night_sessions

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS night_sessions_all_service_role ON public.night_sessions;
DROP POLICY IF EXISTS night_sessions_admin_select ON public.night_sessions;
DROP POLICY IF EXISTS night_sessions_admin_insert ON public.night_sessions;
DROP POLICY IF EXISTS night_sessions_admin_update ON public.night_sessions;
DROP POLICY IF EXISTS night_sessions_admin_delete ON public.night_sessions;

-- 10.1) Service role puede todo
CREATE POLICY night_sessions_all_service_role
  ON public.night_sessions
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role'::text) = 'service_role'::text )
  WITH CHECK ( (auth.jwt() ->> 'role'::text) = 'service_role'::text );

-- 10.2) Admins pueden gestionar sesiones de su club
CREATE POLICY night_sessions_admin_select
  ON public.night_sessions
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

CREATE POLICY night_sessions_admin_insert
  ON public.night_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY night_sessions_admin_update
  ON public.night_sessions
  FOR UPDATE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() )
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY night_sessions_admin_delete
  ON public.night_sessions
  FOR DELETE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

-- 11) Políticas RLS para night_session_products

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS night_session_products_all_service_role ON public.night_session_products;
DROP POLICY IF EXISTS night_session_products_admin_select ON public.night_session_products;
DROP POLICY IF EXISTS night_session_products_admin_insert ON public.night_session_products;
DROP POLICY IF EXISTS night_session_products_admin_update ON public.night_session_products;

-- 11.1) Service role puede todo
CREATE POLICY night_session_products_all_service_role
  ON public.night_session_products
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role'::text) = 'service_role'::text )
  WITH CHECK ( (auth.jwt() ->> 'role'::text) = 'service_role'::text );

-- 11.2) Admins pueden ver y gestionar productos de sesiones de su club
CREATE POLICY night_session_products_admin_select
  ON public.night_session_products
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

CREATE POLICY night_session_products_admin_insert
  ON public.night_session_products
  FOR INSERT
  TO authenticated
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY night_session_products_admin_update
  ON public.night_session_products
  FOR UPDATE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() )
  WITH CHECK ( club_id = fn_current_admin_club_id() );

-- 12) Habilitar Realtime para actualizaciones en tiempo real
DO $$
BEGIN
  -- Intentar agregar tablas a realtime (puede fallar si ya están agregadas)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.night_sessions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.night_session_products;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 13) Conceder permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.night_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.night_session_products TO authenticated;
GRANT SELECT ON public.night_sessions_with_products TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_start_night_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_close_night_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_night_session_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_night_session_by_category TO authenticated;

-- 14) Comentarios finales y ejemplos de uso
COMMENT ON SCHEMA public IS 'Schema público con tablas del sistema OnTicket';

/*
===========================================================
EJEMPLOS DE USO
===========================================================

-- 1) Iniciar noche (captura stock actual de hoy)
SELECT fn_start_night_session();

-- 2) Iniciar noche para una fecha específica
SELECT fn_start_night_session('2025-10-15');

-- 3) Cerrar noche (captura stock final y calcula ventas)
SELECT fn_close_night_session('session-uuid-here');

-- 4) Obtener resumen completo de una sesión
SELECT * FROM fn_get_night_session_summary('session-uuid-here');

-- 5) Obtener productos de una sesión filtrados por categoría
SELECT * FROM fn_get_night_session_by_category('session-uuid-here', 'cervezas');
SELECT * FROM fn_get_night_session_by_category('session-uuid-here', 'vinos');
SELECT * FROM fn_get_night_session_by_category('session-uuid-here', 'vodka');

-- 6) Ver todas las sesiones con productos
SELECT * FROM night_sessions_with_products WHERE club_id = fn_current_admin_club_id();

-- 7) Ver sesiones abiertas
SELECT * FROM night_sessions
WHERE club_id = fn_current_admin_club_id()
  AND status = 'open';

-- 8) Ver sesiones cerradas por rango de fechas
SELECT * FROM night_sessions
WHERE club_id = fn_current_admin_club_id()
  AND status = 'closed'
  AND session_date BETWEEN '2025-10-01' AND '2025-10-31'
ORDER BY session_date DESC;

-- 9) Ver productos de una sesión filtrados por categoría (usando vista)
SELECT * FROM night_sessions_with_products
WHERE session_id = 'session-uuid-here'
  AND product_category = 'cervezas';

-- 10) Estadísticas de ventas por categoría en una sesión
SELECT
  product_category,
  COUNT(*) as total_productos,
  SUM(total_sold) as total_vendido,
  AVG(total_sold) as promedio_vendido
FROM night_sessions_with_products
WHERE session_id = 'session-uuid-here'
  AND total_sold > 0
GROUP BY product_category
ORDER BY total_vendido DESC;

===========================================================
CATEGORÍAS DE PRODUCTOS DISPONIBLES
===========================================================

Bebidas Alcohólicas Específicas:
- 'vinos'       → Vinos (tinto, blanco, rosado, espumante)
- 'cervezas'    → Cervezas (nacionales e importadas)
- 'cocteles'    → Cocteles preparados (mojito, caipirinha, etc.)
- 'vodka'       → Vodka y derivados

Categorías Generales:
- 'bebidas_alcoholicas'    → Otras bebidas (whisky, ron, gin, etc.)
- 'bebidas_sin_alcohol'    → Gaseosas, agua, jugos
- 'comida'                 → Comidas y snacks
- 'cigarrillos'           → Cigarrillos y tabaco
- 'merchandising'         → Productos del club
- 'otros'                 → Otros productos

===========================================================
FLUJO DE USO
===========================================================

1. Admin inicia noche
   → Sistema captura stock actual de todos los productos activos
   → Sesión queda en estado 'open'

2. Durante la noche
   → Se realizan ventas normalmente
   → El stock se actualiza en tiempo real

3. Admin cierra noche
   → Sistema captura stock final de todos los productos
   → Calcula automáticamente: total_sold = opening_stock - closing_stock
   → Sesión queda en estado 'closed'

4. Consulta y análisis
   → Ver sesiones históricas
   → Filtrar por fechas
   → Filtrar por categoría de producto
   → Generar reportes

===========================================================
PERMISOS Y SEGURIDAD
===========================================================

✅ Solo administradores pueden:
   - Iniciar sesiones de noche
   - Cerrar sesiones de noche
   - Ver sesiones y productos de su club

✅ RLS (Row Level Security):
   - Cada club solo ve sus propias sesiones
   - Validación automática de pertenencia

✅ Validaciones:
   - Una sola sesión por día por club
   - No se puede cerrar una sesión ya cerrada
   - Stock de cierre no puede exceder stock de inicio
   - Solo productos activos se capturan

✅ Realtime:
   - Cambios se reflejan instantáneamente
   - Múltiples usuarios pueden ver actualizaciones en vivo

*/
