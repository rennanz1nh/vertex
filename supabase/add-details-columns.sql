-- Adds a Google Drive details link (internal) and flexible extra info sections
-- (Ad description, How to Use, custom) to products.
-- details: jsonb array of { "label": string, "value": string }

alter table public.products add column if not exists drive_link text;
alter table public.products add column if not exists details jsonb not null default '[]'::jsonb;

-- Rebuild the public store view. `details` is exposed (for the product page);
-- drive_link stays internal (admin only) and is intentionally NOT included.
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
  store_category
from public.products
where store_visible = true;

grant select on public.store_products to anon;
