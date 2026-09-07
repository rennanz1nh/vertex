-- Allow a product to belong to multiple store collections.
-- store_categories: jsonb array of category slugs (e.g. ["women-skin","clearance"]).
-- The legacy single store_category column is kept for backward compatibility.

alter table public.products
  add column if not exists store_categories jsonb not null default '[]'::jsonb;

-- migrate existing single-category assignments into the array
update public.products
set store_categories = to_jsonb(array[store_category])
where store_category is not null
  and btrim(store_category) <> ''
  and (store_categories is null or store_categories = '[]'::jsonb);

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
  store_categories
from public.products
where store_visible = true;

grant select on public.store_products to anon;
