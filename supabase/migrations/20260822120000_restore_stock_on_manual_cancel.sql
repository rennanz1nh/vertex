-- Cancelling an order manually (the "Cancelar Pedido" button) currently leaves stock
-- untouched: the save path deletes and reinserts order_items with the same quantities,
-- which nets to zero against the order_items_stock_change_trigger (see
-- 20260731153000_stock_deduction_on_order_item_change.sql). A cancelled sale should give
-- its units back to inventory. This is deliberately scoped to *manual* cancellation only —
-- a Stripe-refund cancellation (src/app/api/stripe/webhook/route.ts) does not call this
-- function, since a refund doesn't necessarily mean the goods came back.

alter table public.orders
  add column if not exists estoque_devolvido boolean not null default false;

-- Restores stock for every line on the order and marks it so, guarded against being run
-- twice for the same order (double-restoring would overstate inventory).
create or replace function public.restore_stock_for_cancelled_order(p_order_id uuid)
returns void
language plpgsql as $$
declare
  v_already_restored boolean;
begin
  select estoque_devolvido into v_already_restored
  from orders
  where id = p_order_id
  for update;

  if v_already_restored is not true then
    update products p
    set "Quantidade no Estoque" = (parse_estoque(p."Quantidade no Estoque") + oi.total_qty)::text
    from (
      select product_id, sum(quantidade) as total_qty
      from order_items
      where order_id = p_order_id and product_id is not null
      group by product_id
    ) oi
    where p.id = oi.product_id;

    update orders set estoque_devolvido = true where id = p_order_id;
  end if;
end;
$$;
