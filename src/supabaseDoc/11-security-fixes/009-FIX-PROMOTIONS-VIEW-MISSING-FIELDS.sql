-- ===========================================================
-- 🔧 FIX: CAMPOS FALTANTES EN VISTA promotions_with_details
-- ===========================================================
-- PROBLEMA: La vista recreada no incluye discount_amount y original_price
-- SOLUCIÓN: Recrear vista con todos los campos necesarios para el frontend

-- ========================================
-- RECREAR VISTA promotions_with_details COMPLETA
-- ========================================

-- Eliminar vista existente
DROP VIEW IF EXISTS public.promotions_with_details CASCADE;

-- Crear vista completa con TODOS los campos necesarios
CREATE OR REPLACE VIEW public.promotions_with_details AS
SELECT
  pr.*,

  -- Información del producto principal (para promociones individuales)
  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.name FROM public.products p WHERE p.id = pr.product_id)
    ELSE NULL
  END as product_name,

  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.sku FROM public.products p WHERE p.id = pr.product_id)
    ELSE NULL
  END as product_sku,

  -- ✅ CAMPO ORIGINAL_PRICE (necesario para el frontend)
  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.sale_price FROM public.products p WHERE p.id = pr.product_id)
    ELSE NULL
  END as original_price,

  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.category FROM public.products p WHERE p.id = pr.product_id)
    ELSE NULL
  END as product_category,

  CASE
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.status FROM public.products p WHERE p.id = pr.product_id)
    ELSE 'active'
  END as product_status,

  -- Información específica para combos
  CASE
    WHEN pr.promotion_type = 'combo' THEN
      (SELECT jsonb_agg(
        jsonb_build_object(
          'product_id', pi.product_id,
          'product_name', COALESCE(prod.name, 'Producto ' || pi.product_id),
          'product_sku', prod.sku,
          'quantity', pi.quantity,
          'unit_price', COALESCE(prod.sale_price, 0),
          'total_price', COALESCE(prod.sale_price, 0) * pi.quantity,
          'display_order', pi.display_order
        ) ORDER BY pi.display_order
      )
      FROM public.promotion_items pi
      LEFT JOIN public.products prod ON prod.id = pi.product_id
      WHERE pi.promotion_id = pr.id)
    ELSE NULL
  END as combo_items,

  -- Precio total original del combo
  CASE
    WHEN pr.promotion_type = 'combo' THEN
      (SELECT COALESCE(SUM(COALESCE(prod.sale_price, 0) * pi.quantity), 0)
      FROM public.promotion_items pi
      LEFT JOIN public.products prod ON prod.id = pi.product_id
      WHERE pi.promotion_id = pr.id)
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
    THEN (SELECT p.sale_price FROM public.products p WHERE p.id = pr.product_id)
    ELSE 0
  END as combo_original_price,

  -- Cálculo del precio final
  CASE pr.promotion_type
    WHEN 'combo' THEN pr.discount_value  -- Para combos, discount_value es el precio final
    WHEN 'fixed_price' THEN pr.discount_value
    WHEN 'fixed_amount' THEN
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
        THEN GREATEST(0, (SELECT p.sale_price FROM public.products p WHERE p.id = pr.product_id) - pr.discount_value)
        ELSE 0
      END
    WHEN 'percentage' THEN
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
        THEN (
          SELECT
            CASE
              WHEN pr.max_discount_amount IS NOT NULL THEN
                p.sale_price - LEAST(pr.max_discount_amount, p.sale_price * pr.discount_value / 100)
              ELSE
                p.sale_price * (1 - pr.discount_value / 100)
            END
          FROM public.products p WHERE p.id = pr.product_id
        )
        ELSE 0
      END
  END as final_price,

  -- Display del descuento
  CASE
    WHEN pr.promotion_type = 'combo' THEN 'Combo: $' || pr.discount_value
    WHEN pr.promotion_type = 'percentage' THEN pr.discount_value || '%'
    WHEN pr.promotion_type = 'fixed_amount' THEN '$' || pr.discount_value
    WHEN pr.promotion_type = 'fixed_price' THEN 'Precio: $' || pr.discount_value
  END as discount_display,

  -- ✅ CAMPO DISCOUNT_AMOUNT (necesario para el frontend)
  CASE pr.promotion_type
    WHEN 'combo' THEN
      (SELECT COALESCE(SUM(COALESCE(prod.sale_price, 0) * pi.quantity), 0) - pr.discount_value
      FROM public.promotion_items pi
      LEFT JOIN public.products prod ON prod.id = pi.product_id
      WHERE pi.promotion_id = pr.id)
    WHEN 'fixed_price' THEN
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
        THEN (SELECT p.sale_price - pr.discount_value FROM public.products p WHERE p.id = pr.product_id)
        ELSE 0
      END
    WHEN 'fixed_amount' THEN pr.discount_value
    WHEN 'percentage' THEN
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
        THEN (
          SELECT
            CASE
              WHEN pr.max_discount_amount IS NOT NULL THEN
                LEAST(pr.max_discount_amount, p.sale_price * pr.discount_value / 100)
              ELSE
                p.sale_price * pr.discount_value / 100
            END
          FROM public.products p WHERE p.id = pr.product_id
        )
        ELSE 0
      END
    ELSE 0
  END as discount_amount,

  -- Porcentaje de descuento
  CASE pr.promotion_type
    WHEN 'combo' THEN
      ROUND(
        (SELECT
          CASE
            WHEN COALESCE(SUM(COALESCE(prod.sale_price, 0) * pi.quantity), 0) > 0
            THEN ((COALESCE(SUM(COALESCE(prod.sale_price, 0) * pi.quantity), 0) - pr.discount_value) /
                  COALESCE(SUM(COALESCE(prod.sale_price, 0) * pi.quantity), 1) * 100)
            ELSE 0
          END
        FROM public.promotion_items pi
        LEFT JOIN public.products prod ON prod.id = pi.product_id
        WHERE pi.promotion_id = pr.id), 2
      )
    WHEN 'percentage' THEN pr.discount_value
    ELSE
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
        THEN (
          SELECT
            CASE
              WHEN p.sale_price > 0 THEN
                ROUND(((p.sale_price -
                  CASE pr.promotion_type
                    WHEN 'fixed_price' THEN pr.discount_value
                    WHEN 'fixed_amount' THEN GREATEST(0, p.sale_price - pr.discount_value)
                    ELSE p.sale_price
                  END
                ) / p.sale_price * 100), 2)
              ELSE 0
            END
          FROM public.products p WHERE p.id = pr.product_id
        )
        ELSE 0
      END
  END as discount_percentage,

  -- Validaciones de disponibilidad
  CASE
    WHEN pr.status = 'inactive' THEN false
    WHEN pr.start_date IS NOT NULL AND pr.start_date > NOW() THEN false
    WHEN pr.end_date IS NOT NULL AND pr.end_date < NOW() THEN false
    WHEN pr.max_uses IS NOT NULL AND pr.current_uses >= pr.max_uses THEN false
    WHEN pr.promotion_type = 'combo' THEN
      -- Para combos, verificar que todos los productos estén disponibles
      (SELECT COUNT(*) = 0
       FROM public.promotion_items pi
       LEFT JOIN public.products prod ON prod.id = pi.product_id
       WHERE pi.promotion_id = pr.id
         AND (prod.id IS NULL OR (EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public') AND prod.status != 'active')))
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public')
      AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = pr.product_id AND p.status != 'active')
    THEN false
    ELSE true
  END as is_available,

  -- Stock disponible (mínimo stock para combos)
  CASE
    WHEN pr.promotion_type = 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_stock' AND table_schema = 'public') THEN
      (SELECT MIN(FLOOR(COALESCE(ps.available_stock, 0) / GREATEST(pi.quantity, 1)))
       FROM public.promotion_items pi
       LEFT JOIN public.product_stock ps ON ps.product_id = pi.product_id
       WHERE pi.promotion_id = pr.id)
    WHEN pr.promotion_type != 'combo' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_stock' AND table_schema = 'public') THEN
      (SELECT COALESCE(ps.available_stock, 0) FROM public.product_stock ps WHERE ps.product_id = pr.product_id)
    ELSE 0
  END as available_stock

FROM public.promotions pr

-- ✅ FILTRO CRÍTICO: Solo mostrar promociones del club del usuario actual
WHERE pr.club_id = (
  -- Primero intentar como admin
  COALESCE(
    (SELECT a.club_id FROM public.admins a WHERE a.user_id = auth.uid() AND a.status = 'active' LIMIT 1),
    -- Si no es admin, intentar como empleado
    (SELECT e.club_id FROM public.employees e WHERE e.user_id = auth.uid() AND e.status = 'active' LIMIT 1)
  )
);

-- ========================================
-- FUNCIÓN DE VERIFICACIÓN
-- ========================================

CREATE OR REPLACE FUNCTION public.fn_verify_promotions_fields()
RETURNS TABLE (
  test_name text,
  result text,
  sample_promotion jsonb,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sample jsonb;
  v_has_discount_amount boolean := false;
  v_has_original_price boolean := false;
  v_count integer;
BEGIN
  -- Obtener muestra de una promoción
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'promotion_type', promotion_type,
    'discount_amount', discount_amount,
    'original_price', original_price,
    'final_price', final_price,
    'discount_display', discount_display
  ) INTO v_sample
  FROM public.promotions_with_details
  LIMIT 1;

  -- Verificar si los campos existen
  v_has_discount_amount := v_sample ? 'discount_amount';
  v_has_original_price := v_sample ? 'original_price';

  SELECT COUNT(*) INTO v_count FROM public.promotions_with_details;

  RETURN QUERY SELECT
    'promotions_fields_test'::text,
    CASE WHEN v_has_discount_amount AND v_has_original_price THEN '✅ PASS' ELSE '❌ FAIL' END::text,
    v_sample,
    ('Promociones visibles: ' || v_count ||
     ', discount_amount: ' || v_has_discount_amount ||
     ', original_price: ' || v_has_original_price)::text;

END;
$$;

-- ========================================
-- INSTRUCCIONES
-- ========================================

/*
🔧 FIX DE CAMPOS FALTANTES APLICADO

CAMPOS AGREGADOS:
✅ discount_amount - Monto del ahorro en pesos
✅ original_price - Precio original del producto
✅ discount_percentage - Porcentaje de descuento
✅ Todos los campos adicionales para combos y validaciones

PARA VERIFICAR:
SELECT * FROM fn_verify_promotions_fields();

AHORA EL FRONTEND DEBERÍA FUNCIONAR CORRECTAMENTE
Los errores de .toFixed() en PromotionsPage.tsx deberían desaparecer.

Si sigue habiendo errores, verificar que:
1. Los valores no sean NULL en lugar de números
2. El frontend maneje correctamente los valores NULL/undefined
*/