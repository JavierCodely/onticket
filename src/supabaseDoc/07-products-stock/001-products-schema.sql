-- ===========================================================
-- PRODUCTOS Y STOCK DEL CLUB
-- ===========================================================

-- 01) Tipos enumerados para productos
DO $$
BEGIN
  -- Categorías de productos
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_category') THEN
    CREATE TYPE product_category AS ENUM (
      'bebidas_alcoholicas',    -- Bebidas alcohólicas
      'bebidas_sin_alcohol',    -- Bebidas sin alcohol
      'comida',                 -- Comidas/snacks
      'cigarrillos',           -- Cigarrillos/tabaco
      'merchandising',         -- Productos del club
      'otros'                  -- Otros productos
    );
  END IF;

  -- Estado del producto
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN
    CREATE TYPE product_status AS ENUM ('active', 'inactive', 'discontinued');
  END IF;

  -- Unidades de medida
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_unit') THEN
    CREATE TYPE product_unit AS ENUM (
      'unit',      -- Unidad
      'bottle',    -- Botella
      'can',       -- Lata
      'glass',     -- Copa/vaso
      'shot',      -- Trago/shot
      'pack',      -- Paquete
      'kg',        -- Kilogramo
      'liter'      -- Litro
    );
  END IF;
END$$;

-- 02) Tabla principal de productos
CREATE TABLE IF NOT EXISTS public.products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Información básica del producto
  name                  text NOT NULL,                               -- Nombre del producto
  description           text,                                        -- Descripción detallada
  category              product_category NOT NULL,                   -- Categoría del producto
  brand                 text,                                        -- Marca (opcional)
  sku                   text,                                        -- Código de producto único por club
  barcode               text,                                        -- Código de barras (opcional)

  -- Precios y costos
  cost_price            numeric(10,2) NOT NULL DEFAULT 0,            -- Precio de costo
  sale_price            numeric(10,2) NOT NULL DEFAULT 0,            -- Precio de venta
  profit_margin         numeric(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN cost_price > 0 THEN ((sale_price - cost_price) / cost_price * 100)
      ELSE 0
    END
  ) STORED,                                                          -- Margen de ganancia % (calculado)

  -- Configuración de stock
  unit                  product_unit NOT NULL DEFAULT 'unit',       -- Unidad de medida
  min_stock             integer NOT NULL DEFAULT 0,                 -- Stock mínimo para alertas
  max_stock             integer,                                     -- Stock máximo (opcional)

  -- Estado y metadatos
  status                product_status NOT NULL DEFAULT 'active',   -- Estado del producto
  is_featured           boolean NOT NULL DEFAULT false,             -- Producto destacado
  image_url             text,                                        -- URL de imagen del producto
  notes                 text,                                        -- Notas internas

  -- Auditoría
  created_by            uuid REFERENCES auth.users(id),              -- Quién creó el producto
  updated_by            uuid REFERENCES auth.users(id),              -- Quién actualizó
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE (club_id, sku),                                             -- SKU único por club
  CHECK (cost_price >= 0),                                           -- Precio de costo no negativo
  CHECK (sale_price >= 0),                                           -- Precio de venta no negativo
  CHECK (min_stock >= 0),                                            -- Stock mínimo no negativo
  CHECK (max_stock IS NULL OR max_stock >= min_stock)                -- Stock máximo >= mínimo
);

-- 02.1) Índices para optimización
CREATE INDEX IF NOT EXISTS products_club_idx ON public.products (club_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category);
CREATE INDEX IF NOT EXISTS products_status_idx ON public.products (status);
CREATE INDEX IF NOT EXISTS products_sku_idx ON public.products (sku);
CREATE INDEX IF NOT EXISTS products_name_idx ON public.products (name);
CREATE INDEX IF NOT EXISTS products_featured_idx ON public.products (is_featured);

-- Índice compuesto para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS products_club_status_idx ON public.products (club_id, status);

-- 02.2) Trigger de updated_at
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 03) Tabla de stock actual
CREATE TABLE IF NOT EXISTS public.product_stock (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  club_id               uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  -- Stock actual
  current_stock         integer NOT NULL DEFAULT 0,                 -- Stock actual
  reserved_stock        integer NOT NULL DEFAULT 0,                 -- Stock reservado
  available_stock       integer GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,

  -- Metadatos de stock
  last_restock_date     timestamptz,                                -- Última reposición
  last_restock_quantity integer,                                    -- Cantidad de última reposición
  last_sale_date        timestamptz,                                -- Última venta

  -- Auditoría
  updated_by            uuid REFERENCES auth.users(id),              -- Quién actualizó el stock
  updated_at            timestamptz NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE (product_id),                                               -- Un registro por producto
  CHECK (current_stock >= 0),                                       -- Stock no negativo
  CHECK (reserved_stock >= 0),                                      -- Stock reservado no negativo
  CHECK (reserved_stock <= current_stock)                           -- Reservado <= actual
);

-- 03.1) Índices para stock
CREATE INDEX IF NOT EXISTS product_stock_product_idx ON public.product_stock (product_id);
CREATE INDEX IF NOT EXISTS product_stock_club_idx ON public.product_stock (club_id);
CREATE INDEX IF NOT EXISTS product_stock_available_idx ON public.product_stock (available_stock);

-- 03.2) Trigger de updated_at para stock
DROP TRIGGER IF EXISTS trg_product_stock_updated_at ON public.product_stock;
CREATE TRIGGER trg_product_stock_updated_at
BEFORE UPDATE ON public.product_stock
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 04) Vista combinada de productos con stock
CREATE OR REPLACE VIEW public.products_with_stock AS
SELECT
  p.*,
  COALESCE(ps.current_stock, 0) as current_stock,
  COALESCE(ps.reserved_stock, 0) as reserved_stock,
  COALESCE(ps.available_stock, 0) as available_stock,
  CASE
    WHEN COALESCE(ps.available_stock, 0) <= p.min_stock THEN true
    ELSE false
  END as is_low_stock,
  ps.last_restock_date,
  ps.last_sale_date
FROM public.products p
LEFT JOIN public.product_stock ps ON ps.product_id = p.id;

-- 04.1) RLS en la vista
ALTER VIEW public.products_with_stock SET (security_invoker = on);

-- 05) Función para actualizar stock (para ventas)
CREATE OR REPLACE FUNCTION public.fn_update_product_stock(
  p_product_id uuid,
  p_quantity_sold integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_current_stock integer;
BEGIN
  -- Verificar que el producto pertenece al club del usuario
  SELECT p.club_id INTO v_club_id
  FROM public.products p
  WHERE p.id = p_product_id;

  IF v_club_id != fn_current_admin_club_id() AND v_club_id != fn_current_employee_club_id() THEN
    RETURN false;
  END IF;

  -- Obtener stock actual
  SELECT current_stock INTO v_current_stock
  FROM public.product_stock
  WHERE product_id = p_product_id;

  -- Verificar que hay suficiente stock
  IF v_current_stock IS NULL OR v_current_stock < p_quantity_sold THEN
    RAISE EXCEPTION 'Stock insuficiente para el producto';
  END IF;

  -- Actualizar stock
  UPDATE public.product_stock
  SET
    current_stock = current_stock - p_quantity_sold,
    last_sale_date = NOW(),
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE product_id = p_product_id;

  -- Si no existe registro de stock, crear uno
  IF NOT FOUND THEN
    INSERT INTO public.product_stock (product_id, club_id, current_stock, updated_by)
    SELECT p_product_id, v_club_id, 0 - p_quantity_sold, auth.uid();
  END IF;

  RETURN true;
END;
$$;

-- 06) Función para verificar si el usuario puede ver productos
CREATE OR REPLACE FUNCTION public.fn_can_view_products()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admins pueden ver productos
  SELECT fn_current_admin_club_id() IS NOT NULL

  UNION

  -- Empleados bartender y cashier pueden ver productos
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND e.status = 'active'
      AND e.category IN ('bartender', 'cashier')
  );
$$;

-- 07) Función para verificar si el usuario puede editar stock
CREATE OR REPLACE FUNCTION public.fn_can_edit_stock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Solo empleados bartender y cashier pueden editar stock
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND e.status = 'active'
      AND e.category IN ('bartender', 'cashier')
  );
$$;

-- 08) Habilitar RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;

-- 09) Políticas RLS para productos

-- 09.1) Service role puede todo
CREATE POLICY products_all_service_role
  ON public.products
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- 09.2) Admins pueden gestionar productos de su club
CREATE POLICY products_admin_select
  ON public.products
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

CREATE POLICY products_admin_insert
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY products_admin_update
  ON public.products
  FOR UPDATE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() )
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY products_admin_delete
  ON public.products
  FOR DELETE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

-- 09.3) Empleados bartender y cashier pueden ver productos
CREATE POLICY products_employee_select
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_employee_club_id()
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
        AND e.category IN ('bartender', 'cashier')
    )
  );

-- 10) Políticas RLS para stock

-- 10.1) Service role puede todo
CREATE POLICY product_stock_all_service_role
  ON public.product_stock
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ( (auth.jwt() ->> 'role') = 'service_role' )
  WITH CHECK ( (auth.jwt() ->> 'role') = 'service_role' );

-- 10.2) Admins pueden ver y gestionar stock de su club
CREATE POLICY product_stock_admin_select
  ON public.product_stock
  FOR SELECT
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() );

CREATE POLICY product_stock_admin_insert
  ON public.product_stock
  FOR INSERT
  TO authenticated
  WITH CHECK ( club_id = fn_current_admin_club_id() );

CREATE POLICY product_stock_admin_update
  ON public.product_stock
  FOR UPDATE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() )
  WITH CHECK ( club_id = fn_current_admin_club_id() );

-- 10.3) Empleados bartender y cashier pueden ver stock
CREATE POLICY product_stock_employee_select
  ON public.product_stock
  FOR SELECT
  TO authenticated
  USING (
    club_id = fn_current_employee_club_id()
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
        AND e.category IN ('bartender', 'cashier')
    )
  );

-- 10.4) Empleados bartender y cashier pueden actualizar stock (solo para ventas)
CREATE POLICY product_stock_employee_update
  ON public.product_stock
  FOR UPDATE
  TO authenticated
  USING (
    club_id = fn_current_employee_club_id()
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
        AND e.category IN ('bartender', 'cashier')
    )
  )
  WITH CHECK (
    club_id = fn_current_employee_club_id()
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.status = 'active'
        AND e.category IN ('bartender', 'cashier')
    )
  );

-- 11) RPC para crear producto con stock inicial
CREATE OR REPLACE FUNCTION public.create_product_with_stock(
  p_name text,
  p_category product_category,
  p_cost_price numeric,
  p_sale_price numeric,
  p_initial_stock integer DEFAULT 0,
  p_description text DEFAULT NULL,
  p_brand text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_unit product_unit DEFAULT 'unit',
  p_min_stock integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_club_id uuid;
BEGIN
  -- Obtener club del admin
  v_club_id := fn_current_admin_club_id();

  -- Verificar que es admin
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Solo admins pueden crear productos';
  END IF;

  -- Crear el producto
  INSERT INTO public.products (
    club_id,
    name,
    category,
    cost_price,
    sale_price,
    description,
    brand,
    sku,
    unit,
    min_stock,
    created_by
  ) VALUES (
    v_club_id,
    p_name,
    p_category,
    p_cost_price,
    p_sale_price,
    p_description,
    p_brand,
    p_sku,
    p_unit,
    p_min_stock,
    auth.uid()
  ) RETURNING id INTO v_product_id;

  -- Crear registro de stock inicial
  IF p_initial_stock > 0 THEN
    INSERT INTO public.product_stock (
      product_id,
      club_id,
      current_stock,
      last_restock_date,
      last_restock_quantity,
      updated_by
    ) VALUES (
      v_product_id,
      v_club_id,
      p_initial_stock,
      NOW(),
      p_initial_stock,
      auth.uid()
    );
  END IF;

  RETURN v_product_id;
END;
$$;

-- 12) Comentarios sobre el uso
/*
EJEMPLOS DE USO:

-- Crear producto con stock inicial
SELECT create_product_with_stock(
  'Cerveza Corona',
  'bebidas_alcoholicas',
  2.50,
  8.00,
  50,
  'Cerveza importada 355ml',
  'Corona',
  'CER-COR-355',
  'bottle',
  10
);

-- Actualizar stock por venta
SELECT fn_update_product_stock('product-uuid', 2);

-- Ver productos con stock
SELECT * FROM products_with_stock WHERE club_id = fn_current_admin_club_id();

CATEGORÍAS DE PRODUCTOS:
- bebidas_alcoholicas: Cervezas, vinos, licores, etc.
- bebidas_sin_alcohol: Gaseosas, agua, jugos, etc.
- comida: Snacks, comidas, etc.
- cigarrillos: Cigarrillos y productos de tabaco
- merchandising: Productos del club (remeras, gorros, etc.)
- otros: Otros productos

UNIDADES DE MEDIDA:
- unit: Unidad individual
- bottle: Botella
- can: Lata
- glass: Copa/vaso (para tragos)
- shot: Shot/trago corto
- pack: Paquete (cajetilla, pack de latas, etc.)
- kg: Kilogramo
- liter: Litro

PERMISOS:
- ADMINS: CRUD completo en productos y stock de su club
- BARTENDER/CASHIER: Ver productos y precios, actualizar stock en ventas
- OTROS EMPLEADOS: Sin acceso a productos
*/