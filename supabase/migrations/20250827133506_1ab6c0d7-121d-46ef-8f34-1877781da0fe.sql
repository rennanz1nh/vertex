-- Fix search path for functions
ALTER FUNCTION public.get_current_user_role() SET search_path = public;

-- Create computed columns functions for products
CREATE OR REPLACE FUNCTION public.calculate_margin_salao(p_custo DECIMAL, p_frete DECIMAL, p_imposto DECIMAL, p_preco DECIMAL)
RETURNS DECIMAL
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN p_preco > 0 THEN 
      ROUND(((p_preco - p_custo - p_frete - p_imposto) / p_preco * 100), 2)
    ELSE 0 
  END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_margin_revendedor(p_custo DECIMAL, p_frete DECIMAL, p_imposto DECIMAL, p_preco DECIMAL)
RETURNS DECIMAL
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN p_preco > 0 THEN 
      ROUND(((p_preco - p_custo - p_frete - p_imposto) / p_preco * 100), 2)
    ELSE 0 
  END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_margin_online(p_custo DECIMAL, p_frete DECIMAL, p_imposto DECIMAL, p_preco DECIMAL)
RETURNS DECIMAL
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN p_preco > 0 THEN 
      ROUND(((p_preco - p_custo - p_frete - p_imposto) / p_preco * 100), 2)
    ELSE 0 
  END;
$$;

-- Create function to calculate validity status
CREATE OR REPLACE FUNCTION public.calculate_validity_status(p_data_validade DATE)
RETURNS validity_status
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN p_data_validade IS NULL THEN 'Válido'::validity_status
    WHEN p_data_validade < CURRENT_DATE THEN 'Vencido'::validity_status
    WHEN p_data_validade <= CURRENT_DATE + INTERVAL '60 days' THEN 'Vencendo em 60 dias'::validity_status
    ELSE 'Válido'::validity_status
  END;
$$;

-- Function to automatically calculate order totals
CREATE OR REPLACE FUNCTION public.calculate_order_totals(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal DECIMAL(10,2);
  v_impostos DECIMAL(10,2);
  v_frete DECIMAL(10,2);
  v_descontos DECIMAL(10,2);
  v_total DECIMAL(10,2);
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
  
  -- Update order
  UPDATE orders
  SET 
    subtotal = v_subtotal,
    impostos = v_impostos,
    total = v_total,
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;

-- Function to update stock when order status changes
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status changed to 'Pago' or 'Enviado', decrease stock
  IF (OLD.status NOT IN ('Pago', 'Enviado') AND NEW.status IN ('Pago', 'Enviado')) THEN
    UPDATE products 
    SET estoque_atual = estoque_atual - oi.quantidade,
        updated_at = now()
    FROM order_items oi
    WHERE products.id = oi.product_id AND oi.order_id = NEW.id;
  
  -- If status changed from 'Pago'/'Enviado' to something else, increase stock back
  ELSIF (OLD.status IN ('Pago', 'Enviado') AND NEW.status NOT IN ('Pago', 'Enviado')) THEN
    UPDATE products 
    SET estoque_atual = estoque_atual + oi.quantidade,
        updated_at = now()
    FROM order_items oi
    WHERE products.id = oi.product_id AND oi.order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for order status changes
CREATE TRIGGER order_status_change_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_status_change();

-- Create trigger to update order totals when items change
CREATE OR REPLACE FUNCTION public.trigger_order_totals_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.calculate_order_totals(OLD.order_id);
    RETURN OLD;
  ELSE
    PERFORM public.calculate_order_totals(NEW.order_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER order_items_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_order_totals_update();