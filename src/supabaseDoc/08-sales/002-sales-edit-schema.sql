-- ===========================================================
-- SALES EDITING SYSTEM FOR ADMINS
-- ===========================================================
-- This file adds UPDATE and DELETE permissions for sales and sale_items
-- to allow admins to edit and manage sales in their club

-- 01) Add UPDATE policies for sales table

-- 01.1) Admins can update sales in their club
DROP POLICY IF EXISTS sales_admin_update ON public.sales;
CREATE POLICY sales_admin_update
  ON public.sales
  FOR UPDATE
  TO authenticated
  USING ( club_id = fn_current_admin_club_id() )
  WITH CHECK ( club_id = fn_current_admin_club_id() );

-- 01.2) Employees with proper permissions can update their own sales
DROP POLICY IF EXISTS sales_employee_update ON public.sales;
CREATE POLICY sales_employee_update
  ON public.sales
  FOR UPDATE
  TO authenticated
  USING (
    club_id = fn_current_employee_club_id()
    AND employee_id = auth.uid()
    AND status IN ('pending', 'completed')  -- Only allow editing non-cancelled/refunded sales
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
    AND employee_id = auth.uid()
  );

-- 02) Add DELETE policies for sales table (only admins)

-- 02.1) Admins can delete sales in their club
DROP POLICY IF EXISTS sales_admin_delete ON public.sales;
CREATE POLICY sales_admin_delete
  ON public.sales
  FOR DELETE
  TO authenticated
  USING (
    club_id = fn_current_admin_club_id()
    AND status IN ('pending', 'cancelled')  -- Only allow deleting pending or cancelled sales
  );

-- 03) Add UPDATE policies for sale_items table

-- 03.1) Admins can update sale items in their club
DROP POLICY IF EXISTS sale_items_admin_update ON public.sale_items;
CREATE POLICY sale_items_admin_update
  ON public.sale_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
    )
  );

-- 03.2) Employees can update items from their own sales
DROP POLICY IF EXISTS sale_items_employee_update ON public.sale_items;
CREATE POLICY sale_items_employee_update
  ON public.sale_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_employee_club_id()
        AND s.employee_id = auth.uid()
        AND s.status IN ('pending', 'completed')
        AND EXISTS (
          SELECT 1
          FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.status = 'active'
            AND e.category IN ('bartender', 'cashier')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_employee_club_id()
        AND s.employee_id = auth.uid()
    )
  );

-- 04) Add DELETE policies for sale_items table

-- 04.1) Admins can delete sale items in their club
DROP POLICY IF EXISTS sale_items_admin_delete ON public.sale_items;
CREATE POLICY sale_items_admin_delete
  ON public.sale_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_admin_club_id()
    )
  );

-- 04.2) Employees can delete items from their own pending/completed sales
DROP POLICY IF EXISTS sale_items_employee_delete ON public.sale_items;
CREATE POLICY sale_items_employee_delete
  ON public.sale_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.club_id = fn_current_employee_club_id()
        AND s.employee_id = auth.uid()
        AND s.status IN ('pending', 'completed')
        AND EXISTS (
          SELECT 1
          FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.status = 'active'
            AND e.category IN ('bartender', 'cashier')
        )
    )
  );

-- 05) Function to update sale
CREATE OR REPLACE FUNCTION public.fn_update_sale(
  p_sale_id uuid,
  p_employee_name text DEFAULT NULL,
  p_payment_method payment_method DEFAULT NULL,
  p_payment_details jsonb DEFAULT NULL,
  p_discount_amount numeric DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_status sale_status DEFAULT NULL,
  p_refund_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_record RECORD;
  v_club_id uuid;
  v_is_admin boolean := false;
  v_can_edit boolean := false;
  v_new_total numeric;
BEGIN
  -- Check if current user is admin
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  -- Get sale information
  SELECT * INTO v_sale_record
  FROM public.sales
  WHERE id = p_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Permission checks
  IF v_is_admin THEN
    -- Admin can edit sales in their club
    SELECT a.club_id INTO v_club_id
    FROM public.admins a
    WHERE a.user_id = auth.uid() AND a.status = 'active';

    v_can_edit := (v_club_id = v_sale_record.club_id);
  ELSE
    -- Employee can only edit their own sales
    SELECT e.club_id INTO v_club_id
    FROM public.employees e
    WHERE e.user_id = auth.uid() AND e.status = 'active'
      AND e.category IN ('bartender', 'cashier');

    v_can_edit := (v_club_id = v_sale_record.club_id
                   AND auth.uid() = v_sale_record.employee_id
                   AND v_sale_record.status IN ('pending', 'completed'));
  END IF;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'No tienes permisos para editar esta venta';
  END IF;

  -- Calculate new total if discount changed
  IF p_discount_amount IS NOT NULL THEN
    v_new_total := v_sale_record.subtotal - p_discount_amount + v_sale_record.tax_amount;
  END IF;

  -- Update sale
  UPDATE public.sales
  SET
    employee_name = COALESCE(p_employee_name, employee_name),
    payment_method = COALESCE(p_payment_method, payment_method),
    payment_details = COALESCE(p_payment_details, payment_details),
    discount_amount = COALESCE(p_discount_amount, discount_amount),
    total_amount = COALESCE(v_new_total, total_amount),
    notes = COALESCE(p_notes, notes),
    status = COALESCE(p_status, status),
    refund_reason = COALESCE(p_refund_reason, refund_reason),
    updated_at = NOW()
  WHERE id = p_sale_id;

  RETURN TRUE;
END;
$$;

-- 06) Function to add item to existing sale
CREATE OR REPLACE FUNCTION public.fn_add_sale_item(
  p_sale_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_unit_price numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_record RECORD;
  v_product_record RECORD;
  v_club_id uuid;
  v_is_admin boolean := false;
  v_can_edit boolean := false;
  v_item_id uuid;
  v_line_total numeric;
  v_new_subtotal numeric;
  v_new_total numeric;
BEGIN
  -- Check if current user is admin
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  -- Get sale information
  SELECT * INTO v_sale_record
  FROM public.sales
  WHERE id = p_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Get product information
  SELECT * INTO v_product_record
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  -- Permission checks (same as update sale)
  IF v_is_admin THEN
    SELECT a.club_id INTO v_club_id
    FROM public.admins a
    WHERE a.user_id = auth.uid() AND a.status = 'active';

    v_can_edit := (v_club_id = v_sale_record.club_id);
  ELSE
    SELECT e.club_id INTO v_club_id
    FROM public.employees e
    WHERE e.user_id = auth.uid() AND e.status = 'active'
      AND e.category IN ('bartender', 'cashier');

    v_can_edit := (v_club_id = v_sale_record.club_id
                   AND auth.uid() = v_sale_record.employee_id
                   AND v_sale_record.status IN ('pending', 'completed'));
  END IF;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'No tienes permisos para editar esta venta';
  END IF;

  -- Calculate line total
  v_line_total := p_unit_price * p_quantity;

  -- Add sale item
  INSERT INTO public.sale_items (
    sale_id,
    product_id,
    product_name,
    product_sku,
    unit_price,
    quantity,
    line_total
  ) VALUES (
    p_sale_id,
    p_product_id,
    v_product_record.name,
    v_product_record.sku,
    p_unit_price,
    p_quantity,
    v_line_total
  ) RETURNING id INTO v_item_id;

  -- Update sale totals
  v_new_subtotal := v_sale_record.subtotal + v_line_total;
  v_new_total := v_new_subtotal - v_sale_record.discount_amount + v_sale_record.tax_amount;

  UPDATE public.sales
  SET
    subtotal = v_new_subtotal,
    total_amount = v_new_total,
    updated_at = NOW()
  WHERE id = p_sale_id;

  -- Update product stock
  PERFORM fn_update_product_stock(p_product_id, p_quantity);

  RETURN v_item_id;
END;
$$;

-- 07) Function to update sale item
CREATE OR REPLACE FUNCTION public.fn_update_sale_item(
  p_item_id uuid,
  p_quantity integer DEFAULT NULL,
  p_unit_price numeric DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_record RECORD;
  v_sale_record RECORD;
  v_club_id uuid;
  v_is_admin boolean := false;
  v_can_edit boolean := false;
  v_old_line_total numeric;
  v_new_line_total numeric;
  v_quantity_diff integer;
  v_new_subtotal numeric;
  v_new_total numeric;
BEGIN
  -- Check if current user is admin
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  -- Get item and sale information
  SELECT si.*, s.* INTO v_item_record
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE si.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de venta no encontrado';
  END IF;

  -- Permission checks
  IF v_is_admin THEN
    SELECT a.club_id INTO v_club_id
    FROM public.admins a
    WHERE a.user_id = auth.uid() AND a.status = 'active';

    v_can_edit := (v_club_id = v_item_record.club_id);
  ELSE
    SELECT e.club_id INTO v_club_id
    FROM public.employees e
    WHERE e.user_id = auth.uid() AND e.status = 'active'
      AND e.category IN ('bartender', 'cashier');

    v_can_edit := (v_club_id = v_item_record.club_id
                   AND auth.uid() = v_item_record.employee_id
                   AND v_item_record.status IN ('pending', 'completed'));
  END IF;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'No tienes permisos para editar este item';
  END IF;

  -- Store old values
  v_old_line_total := v_item_record.line_total;

  -- Calculate new values
  v_new_line_total := COALESCE(p_unit_price, v_item_record.unit_price) * COALESCE(p_quantity, v_item_record.quantity);
  v_quantity_diff := COALESCE(p_quantity, v_item_record.quantity) - v_item_record.quantity;

  -- Update sale item
  UPDATE public.sale_items
  SET
    quantity = COALESCE(p_quantity, quantity),
    unit_price = COALESCE(p_unit_price, unit_price),
    line_total = v_new_line_total
  WHERE id = p_item_id;

  -- Update sale totals
  v_new_subtotal := v_item_record.subtotal - v_old_line_total + v_new_line_total;
  v_new_total := v_new_subtotal - v_item_record.discount_amount + v_item_record.tax_amount;

  UPDATE public.sales
  SET
    subtotal = v_new_subtotal,
    total_amount = v_new_total,
    updated_at = NOW()
  WHERE id = v_item_record.sale_id;

  -- Update product stock if quantity changed
  IF v_quantity_diff != 0 THEN
    PERFORM fn_update_product_stock(v_item_record.product_id, v_quantity_diff);
  END IF;

  RETURN TRUE;
END;
$$;

-- 08) Function to remove sale item
CREATE OR REPLACE FUNCTION public.fn_remove_sale_item(
  p_item_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_record RECORD;
  v_sale_record RECORD;
  v_club_id uuid;
  v_is_admin boolean := false;
  v_can_edit boolean := false;
  v_new_subtotal numeric;
  v_new_total numeric;
BEGIN
  -- Check if current user is admin
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  -- Get item and sale information
  SELECT si.*, s.* INTO v_item_record
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE si.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de venta no encontrado';
  END IF;

  -- Permission checks
  IF v_is_admin THEN
    SELECT a.club_id INTO v_club_id
    FROM public.admins a
    WHERE a.user_id = auth.uid() AND a.status = 'active';

    v_can_edit := (v_club_id = v_item_record.club_id);
  ELSE
    SELECT e.club_id INTO v_club_id
    FROM public.employees e
    WHERE e.user_id = auth.uid() AND e.status = 'active'
      AND e.category IN ('bartender', 'cashier');

    v_can_edit := (v_club_id = v_item_record.club_id
                   AND auth.uid() = v_item_record.employee_id
                   AND v_item_record.status IN ('pending', 'completed'));
  END IF;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'No tienes permisos para eliminar este item';
  END IF;

  -- Check if this is the last item in the sale
  IF (SELECT COUNT(*) FROM public.sale_items WHERE sale_id = v_item_record.sale_id) = 1 THEN
    RAISE EXCEPTION 'No se puede eliminar el último item de la venta. Considera cancelar la venta completa.';
  END IF;

  -- Remove sale item
  DELETE FROM public.sale_items WHERE id = p_item_id;

  -- Update sale totals
  v_new_subtotal := v_item_record.subtotal - v_item_record.line_total;
  v_new_total := v_new_subtotal - v_item_record.discount_amount + v_item_record.tax_amount;

  UPDATE public.sales
  SET
    subtotal = v_new_subtotal,
    total_amount = v_new_total,
    updated_at = NOW()
  WHERE id = v_item_record.sale_id;

  -- Restore product stock
  PERFORM fn_update_product_stock(v_item_record.product_id, -v_item_record.quantity);

  RETURN TRUE;
END;
$$;

-- 09) Function to cancel/refund sale
CREATE OR REPLACE FUNCTION public.fn_cancel_refund_sale(
  p_sale_id uuid,
  p_action sale_status, -- 'cancelled' or 'refunded'
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_record RECORD;
  v_club_id uuid;
  v_is_admin boolean := false;
  v_can_edit boolean := false;
  v_item RECORD;
BEGIN
  -- Check if current user is admin
  SELECT fn_current_admin_club_id() IS NOT NULL INTO v_is_admin;

  -- Validate action
  IF p_action NOT IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Acción inválida. Use "cancelled" o "refunded"';
  END IF;

  -- Get sale information
  SELECT * INTO v_sale_record
  FROM public.sales
  WHERE id = p_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  -- Permission checks
  IF v_is_admin THEN
    SELECT a.club_id INTO v_club_id
    FROM public.admins a
    WHERE a.user_id = auth.uid() AND a.status = 'active';

    v_can_edit := (v_club_id = v_sale_record.club_id);
  ELSE
    -- Only admins can cancel/refund sales
    v_can_edit := false;
  END IF;

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'Solo los administradores pueden cancelar o reembolsar ventas';
  END IF;

  -- Can't cancel/refund already cancelled/refunded sales
  IF v_sale_record.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'No se puede cancelar/reembolsar una venta que ya está cancelada o reembolsada';
  END IF;

  -- Update sale status
  UPDATE public.sales
  SET
    status = p_action,
    refund_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_sale_id;

  -- Restore stock for all items
  FOR v_item IN
    SELECT product_id, quantity
    FROM public.sale_items
    WHERE sale_id = p_sale_id
  LOOP
    PERFORM fn_update_product_stock(v_item.product_id, -v_item.quantity);
  END LOOP;

  RETURN TRUE;
END;
$$;

-- 10) Comments
/*
NUEVAS FUNCIONES PARA EDICIÓN DE VENTAS:

FUNCIONES PRINCIPALES:
- fn_update_sale(): Actualizar datos básicos de una venta
- fn_add_sale_item(): Agregar nuevo item a venta existente
- fn_update_sale_item(): Modificar item existente (cantidad, precio)
- fn_remove_sale_item(): Eliminar item de venta
- fn_cancel_refund_sale(): Cancelar o reembolsar venta completa

PERMISOS:
- ADMINS: Pueden editar cualquier venta de su club
- EMPLEADOS: Solo pueden editar sus propias ventas en estado 'pending' o 'completed'

RESTRICCIONES:
- No se pueden eliminar todos los items de una venta (mínimo 1)
- Solo admins pueden cancelar/reembolsar ventas
- Las ventas canceladas/reembolsadas no se pueden editar
- Los cambios en stock se manejan automáticamente

USO:
-- Actualizar venta
SELECT fn_update_sale(
  'sale-uuid',
  'Nuevo Empleado',
  'credit',
  NULL,
  5.00,
  'Venta actualizada'
);

-- Agregar item
SELECT fn_add_sale_item('sale-uuid', 'product-uuid', 2, 10.50);

-- Actualizar item
SELECT fn_update_sale_item('item-uuid', 3, 12.00);

-- Eliminar item
SELECT fn_remove_sale_item('item-uuid');

-- Cancelar venta
SELECT fn_cancel_refund_sale('sale-uuid', 'cancelled', 'Error en el pedido');
*/