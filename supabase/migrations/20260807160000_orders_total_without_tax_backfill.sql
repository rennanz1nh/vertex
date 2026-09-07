-- One-shot backfill: align old orders with the new rule that `total` excludes tax (tax is
-- informational only now — see src/lib/order-calc.ts). Previously the app and the eBay sync
-- stored total = produtos + frete − desconto + impostos; the tax portion is removed here so
-- old orders don't all trip the new "total doesn't reconcile with its parts" review flag.
-- Profit is unaffected (tax never entered the profit calc). Only rows whose stored total
-- still visibly includes the tax are touched, so a genuinely mismatched order is left alone.
with parts as (
  select o.id, o.total, o.impostos, o.frete_total, o.descontos,
    coalesce((select sum(oi.quantidade * oi.preco_unitario) from order_items oi where oi.order_id = o.id), 0) as produtos
  from orders o
)
update orders o
set total = round((o.total - p.impostos)::numeric, 2)
from parts p
where o.id = p.id
  and p.impostos > 0
  and abs((p.total - (p.produtos + p.frete_total - p.descontos)) - p.impostos) < 0.02;
