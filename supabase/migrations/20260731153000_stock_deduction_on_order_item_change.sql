-- The old rule deducted stock when an order's STATUS transitioned into 'Pago'/'Enviado'.
-- That trigger referenced `estoque_atual`, a column that no longer exists (products was
-- rebuilt with "Quantidade no Estoque" as text) — it has been silently broken since that
-- rebuild, throwing whenever a status actually transitioned into those states via UPDATE.
drop trigger if exists order_status_change_trigger on orders;
drop function if exists handle_order_status_change();

-- New rule: stock is deducted the moment a sale's product becomes known — immediately if
-- resolved on arrival (synced from a marketplace with a matching SKU, or entered by hand),
-- or later, the moment a human links a product to a line that arrived unresolved. Reversed
-- symmetrically when a line is removed, and adjusted by the exact delta when its quantity or
-- linked product changes (covers the delete-all-then-reinsert pattern the app's manual order
-- save already uses — it nets out correctly across the two statements).
--
-- "Quantidade no Estoque" is free-text (spreadsheet import artifact — seen holding "Teste",
-- blanks, etc.), so parse_estoque() strips anything non-numeric before doing arithmetic.
create or replace function public.parse_estoque(val text) returns numeric
language sql immutable as $$
  select coalesce(nullif(regexp_replace(coalesce(val, ''), '[^0-9]', '', 'g'), ''), '0')::numeric
$$;

-- products has no updated_at column (unlike orders), so the trigger only touches the stock
-- column itself.
create or replace function public.handle_order_item_stock_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.product_id is not null then
      update products set "Quantidade no Estoque" = (parse_estoque("Quantidade no Estoque") - new.quantidade)::text
      where id = new.product_id;
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    if old.product_id is not null then
      update products set "Quantidade no Estoque" = (parse_estoque("Quantidade no Estoque") + old.quantidade)::text
      where id = old.product_id;
    end if;
    return old;

  elsif tg_op = 'UPDATE' then
    if old.product_id is not null then
      update products set "Quantidade no Estoque" = (parse_estoque("Quantidade no Estoque") + old.quantidade)::text
      where id = old.product_id;
    end if;
    if new.product_id is not null then
      update products set "Quantidade no Estoque" = (parse_estoque("Quantidade no Estoque") - new.quantidade)::text
      where id = new.product_id;
    end if;
    return new;
  end if;
  return null;
end;
$$;

create trigger order_items_stock_change_trigger
after insert or update or delete on order_items
for each row execute function public.handle_order_item_stock_change();
