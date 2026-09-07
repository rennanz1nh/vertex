-- Optional promotional/discount price. When set and lower than "Valor de venda (Online)",
-- the storefront shows the regular price struck through next to this price highlighted,
-- and it becomes the price actually charged (see src/lib/pricing.ts getEffectivePrice,
-- used both by the storefront display and server-side by /api/stripe/checkout).
alter table public.products
  add column if not exists sale_price text;

drop view if exists public.store_products;
create view public.store_products as
select
  id,
  "Produto Nome",
  "Informacoes dos produtos / descricao",
  "Valor de venda (Online)",
  sale_price,
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
