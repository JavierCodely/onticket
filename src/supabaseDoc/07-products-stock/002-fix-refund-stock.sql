-- ===========================================================
-- FIX: Corrección para manejo de reembolsos en stock
-- ===========================================================
-- La función fn_update_product_stock no maneja correctamente los valores negativos (reembolsos)

-- Crear función corregida que maneja tanto ventas como reembolsos
CREATE OR REPLACE FUNCTION public.fn_update_product_stock(
  p_product_id uuid,
  p_quantity_sold integer  -- Positivo para ventas, negativo para reembolsos
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_current_stock integer;
  v_is_refund boolean;
BEGIN
  -- Verificar que el producto pertenece al club del usuario
  SELECT p.club_id INTO v_club_id
  FROM public.products p
  WHERE p.id = p_product_id;

  IF v_club_id != fn_current_admin_club_id() AND v_club_id != fn_current_employee_club_id() THEN
    RETURN false;
  END IF;

  -- Determinar si es un reembolso (cantidad negativa)
  v_is_refund := p_quantity_sold < 0;

  -- Obtener stock actual
  SELECT current_stock INTO v_current_stock
  FROM public.product_stock
  WHERE product_id = p_product_id;

  -- Solo verificar stock suficiente para VENTAS (no para reembolsos)
  IF NOT v_is_refund THEN
    IF v_current_stock IS NULL OR v_current_stock < p_quantity_sold THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto. Stock actual: %, cantidad solicitada: %',
        COALESCE(v_current_stock, 0), p_quantity_sold;
    END IF;
  END IF;

  -- Actualizar stock
  UPDATE public.product_stock
  SET
    current_stock = current_stock - p_quantity_sold,  -- Para reembolsos será: stock + cantidad (porque quantity es negativo)
    last_sale_date = CASE WHEN NOT v_is_refund THEN NOW() ELSE last_sale_date END,  -- Solo actualizar fecha en ventas
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE product_id = p_product_id;

  -- Si no existe registro de stock, crear uno
  IF NOT FOUND THEN
    INSERT INTO public.product_stock (product_id, club_id, current_stock, updated_by)
    VALUES (p_product_id, v_club_id, 0 - p_quantity_sold, auth.uid());
  END IF;

  -- Log para debugging
  IF v_is_refund THEN
    RAISE NOTICE 'REEMBOLSO: Producto % - Stock restaurado: % unidades. Stock actual: %',
      p_product_id, ABS(p_quantity_sold), v_current_stock - p_quantity_sold;
  ELSE
    RAISE NOTICE 'VENTA: Producto % - Stock reducido: % unidades. Stock actual: %',
      p_product_id, p_quantity_sold, v_current_stock - p_quantity_sold;
  END IF;

  RETURN true;
END;
$$;

-- Comentario de uso
/*
COMO FUNCIONA AHORA:

1. VENTAS (p_quantity_sold > 0):
   - Valida stock suficiente
   - Resta del stock: current_stock - p_quantity_sold
   - Actualiza last_sale_date

2. REEMBOLSOS (p_quantity_sold < 0):
   - NO valida stock (permite cualquier valor)
   - Suma al stock: current_stock - (-2) = current_stock + 2
   - NO actualiza last_sale_date

EJEMPLO:
- Stock actual: 10
- Venta de 2: fn_update_product_stock(product_id, 2) → Stock final: 8
- Reembolso de 2: fn_update_product_stock(product_id, -2) → Stock final: 10
*/