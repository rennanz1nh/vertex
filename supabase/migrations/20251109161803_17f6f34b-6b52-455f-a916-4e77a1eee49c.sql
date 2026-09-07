SET search_path TO vertex, extensions;

-- Fix calculate_order_totals function to remove non-existent subtotal column
CREATE OR REPLACE FUNCTION vertex.calculate_order_totals(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'vertex'
AS $function$
DECLARE
  v_impostos DECIMAL(10,2);
  v_frete DECIMAL(10,2);
  v_descontos DECIMAL(10,2);
  v_total DECIMAL(10,2);
  v_subtotal DECIMAL(10,2);
BEGIN
  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(quantidade * preco_unitario), 0)
  INTO v_subtotal
  FROM order_items
  WHERE order_id = p_order_id;
  
  -- Calculate impostos from order items
  SELECT COALESCE(SUM(quantidade * imposto_unitario), 0)
  INTO v_impostos
  FROM order_items
  WHERE order_id = p_order_id;
  
  -- Get frete and descontos from order
  SELECT COALESCE(frete_total, 0), COALESCE(descontos, 0)
  INTO v_frete, v_descontos
  FROM orders
  WHERE id = p_order_id;
  
  -- Calculate total
  v_total := v_subtotal + v_impostos + v_frete - v_descontos;
  
  -- Update order (removed subtotal column reference)
  UPDATE orders
  SET 
    impostos = v_impostos,
    total = v_total,
    updated_at = now()
  WHERE id = p_order_id;
END;
$function$;