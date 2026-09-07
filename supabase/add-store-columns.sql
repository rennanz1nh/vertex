-- Adds store-control columns to products and rebuilds the public store view.
-- store_visible: whether the product appears in the online store
-- store_category: which store collection it belongs to (women, men, clearance, ...)

alter table public.products add column if not exists store_visible boolean not null default false;
alter table public.products add column if not exists store_category text;

-- Seed: products that already have a usable online price become visible,
-- so the current store catalog is preserved.
update public.products
set store_visible = true
where store_visible = false
  and "Valor de venda (Online)" is not null
  and btrim("Valor de venda (Online)") <> ''
  and "Valor de venda (Online)" not ilike '%N/A%';

-- Public store view (anon-readable). Only safe columns + store flags.
create or replace view public.store_products as
select
  id,
  "Produto Nome",
  "Informacoes dos produtos / descricao",
  "Valor de venda (Online)",
  "Quantidade no Estoque",
  "Marca",
  "Linha do produto",
  "SKU",
  "Volume",
  image_url,
  store_visible,
  store_category
from public.products
where store_visible = true;

grant select on public.store_products to anon;
