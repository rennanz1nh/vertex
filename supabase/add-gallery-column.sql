-- Adds a multi-image gallery to products and exposes it in the store view.
-- image_url stays the primary/cover image; gallery_urls holds extra photos.

alter table public.products
  add column if not exists gallery_urls jsonb not null default '[]'::jsonb;

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
  store_visible,
  store_category
from public.products
where store_visible = true;

grant select on public.store_products to anon;
