SET search_path TO vertex, extensions;

-- Bug: calculate_order_totals sobrescrevia orders.impostos com a soma de
-- order_items.imposto_unitario (sempre 0, pois o formulário guarda o tax no PEDIDO, não por
-- item). Como o trigger dispara ao inserir os itens logo após salvar o pedido, o tax digitado
-- (ex: 6.5% na Flórida) era zerado toda vez. Além disso o total somava o imposto, mas a regra
-- do negócio é: o TAX é informativo (recolhido ao governo) e NÃO entra no total do pedido.
--
-- Correção: a função passa a PRESERVAR orders.impostos (valor manual) e calcula
-- total = subtotal + frete - descontos (sem imposto).
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
  -- Subtotal from order items
  SELECT COALESCE(SUM(quantidade * preco_unitario), 0)
  INTO v_subtotal
  FROM order_items
  WHERE order_id = p_order_id;

  -- Preserve the manually-entered tax on the order (do NOT derive it from items,
  -- which carry imposto_unitario = 0). Also read frete/descontos from the order.
  SELECT COALESCE(impostos, 0), COALESCE(frete_total, 0), COALESCE(descontos, 0)
  INTO v_impostos, v_frete, v_descontos
  FROM orders
  WHERE id = p_order_id;

  -- Tax is informational and never part of the total.
  v_total := v_subtotal + v_frete - v_descontos;

  UPDATE orders
  SET
    total = v_total,
    updated_at = now()
  WHERE id = p_order_id;
END;
$function$;
