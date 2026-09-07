-- Execute este SQL no Supabase Dashboard > SQL Editor
-- Cria uma view pública apenas com as colunas seguras para a loja
-- (NÃO expõe custos, margens nem preços de revendedor)

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
  image_url
from public.products
where "Valor de venda (Online)" is not null;

-- Permite leitura anônima somente na view
grant select on public.store_products to anon;
