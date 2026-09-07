-- "Fita" (ribbon banner) shown over the product image in the store, e.g.
-- "Best Seller's" or "Progressive (Brazilian)". ribbon_color is a palette key
-- (see RIBBON_COLOR_OPTIONS in src/lib/ribbon.ts), not a raw hex value.

alter table public.products
  add column if not exists ribbon_text text,
  add column if not exists ribbon_color text;

drop view if exists public.store_products;
create view public.store_products as
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
  gallery_urls,
  details,
  store_visible,
  store_category,
  store_categories,
  ribbon_text,
  ribbon_color
from public.products
where store_visible = true;

grant select on public.store_products to anon;
