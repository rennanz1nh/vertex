-- Batch 1: clients whose old single-field address blob (stuffed into endereco_cidade)
-- can be reliably split into real street/city/state/zip.
UPDATE public.clients SET endereco_rua = '3053 Bloomsbury Dr', endereco_cidade = 'Kissimmee', endereco_estado = 'FL', endereco_cep = '34747-1616', endereco_pais = 'US' WHERE id = '39ca9692-9a6c-4a55-a36e-852a68392f36';
UPDATE public.clients SET endereco_cidade = 'Redlands', endereco_estado = 'CA', endereco_cep = '92373-6611', endereco_pais = 'US' WHERE id = '42c533f1-d7d6-4bb4-b282-9abc393a965b';
UPDATE public.clients SET endereco_rua = '376 Hollis St Apt 7', endereco_cidade = 'Framingham', endereco_estado = 'MA', endereco_cep = '01702-8660', endereco_pais = 'US' WHERE id = '436bed46-a78a-46ae-b81a-3f7526271519';
UPDATE public.clients SET endereco_rua = '5014 Willow Point Dr', endereco_cidade = 'Conroe', endereco_estado = 'TX', endereco_cep = '77303', endereco_pais = 'US' WHERE id = '1b6465b0-776b-4403-84d2-6c10384f92c3';
UPDATE public.clients SET endereco_rua = '3201 Pine Ave', endereco_cidade = 'Manhattan Beach', endereco_estado = 'CA', endereco_cep = '90266', endereco_pais = 'US' WHERE id = '7f371b27-94bd-467b-880e-d6bd5e662fce';
UPDATE public.clients SET endereco_rua = '2625 Einwood Dr', endereco_cidade = 'Kissimmee', endereco_estado = 'FL', endereco_cep = '34758', endereco_pais = 'US' WHERE id = '21d3a050-cc4c-4f2d-8e0d-dab49a2eead3';
UPDATE public.clients SET endereco_rua = '1601 Rice Blvd, Duncan College', endereco_cidade = 'Houston', endereco_estado = 'TX', endereco_cep = '77005-4401', endereco_pais = 'US' WHERE id = 'fae696b2-6f9b-4ff9-9f5c-17979891db9e';
UPDATE public.clients SET endereco_rua = '150 River St (239)', endereco_cidade = 'Hackensack', endereco_estado = 'NJ', endereco_cep = '07601', endereco_pais = 'US' WHERE id = 'e608ddf9-b11c-4e5e-a6ef-af74770e52cb';
UPDATE public.clients SET endereco_rua = '1116 Glory Vine Rd', endereco_cidade = 'Whitsett', endereco_estado = 'NC', endereco_cep = '27377-9303', endereco_pais = 'US' WHERE id = 'e40671b7-d7b2-4e77-b032-2e154248bdd5';

-- Batch 2: eBay-synced clients with pais stored as "United States" instead of the ISO2
-- code Shippo requires ("US") — 8 of them also have the redundant compound string
-- (city+state+zip+country all crammed into endereco_cidade) even though state/zip
-- already exist correctly in their own columns, so trim endereco_cidade to just the city.
UPDATE public.clients SET endereco_cidade = 'West Palm Beach', endereco_pais = 'US' WHERE id = '01f673ef-13a6-4786-86a8-b62b5a6ff745';
UPDATE public.clients SET endereco_cidade = 'Rego Park', endereco_pais = 'US' WHERE id = '99d175a8-4bc9-4590-851c-063beea8b21e';
UPDATE public.clients SET endereco_cidade = 'Queens Village', endereco_pais = 'US' WHERE id = '96ea4e20-33c4-4356-993e-1626af0e88ed';
UPDATE public.clients SET endereco_cidade = 'North Hollywood', endereco_pais = 'US' WHERE id = '8fbc4795-bc38-4f39-a2d3-d62de6a25a83';
UPDATE public.clients SET endereco_cidade = 'Staten Island', endereco_pais = 'US' WHERE id = '92e7f675-0c6c-4faa-8847-2b356ec3a732';
UPDATE public.clients SET endereco_cidade = 'Lakeside Park', endereco_pais = 'US' WHERE id = '13f8f6c6-443e-43c2-9448-9ff9a1e8d88d';
UPDATE public.clients SET endereco_cidade = 'Fort Smith', endereco_pais = 'US' WHERE id = '6ee0a04e-d189-4ed1-ace8-44256e5ccc32';
UPDATE public.clients SET endereco_cidade = 'Woodhaven', endereco_pais = 'US' WHERE id = '49eba32a-5d71-4076-a5b7-0dca3ef0f15e';

UPDATE public.clients SET endereco_pais = 'US' WHERE id IN (
  '91abf2bc-6b2b-4432-a059-e0bebfb214b7', '65632cc0-f188-4714-96d4-6dfaa3519be8', 'b24df778-2a86-4594-861c-77b4672a70b8',
  '100994cf-2dd0-4130-82d7-f425efd1ab94', '4f7b4573-5d99-4cf4-bb7f-b7c8b67f0361', '8517aba1-53cc-4b57-ade3-1a09a7f06b70',
  '0b0e0d7b-ef24-440b-8e8e-f81edd7cc56b', 'f3507af6-64c7-4f27-8029-9f2c6379805d', '7eb3cd31-172d-44c6-87df-1e80427f4c88',
  '4e954f0c-41b7-471c-ba39-33e55378014b', '34765cc7-fa0e-4ab8-acc8-66742d9f8ed9', '1dc59e77-f952-4776-bc26-ca525e32704f',
  '30a291ee-e61e-49c6-b2a5-4a311290e1b8', '1bc90ce8-fd91-4771-9692-e0721b94601b', 'a41eec02-13ef-425a-83fd-f398fd3f60c6',
  '044c851e-b78b-4e83-94fb-0e27b6f90512', 'd8791200-3d9e-44cb-94ec-58d43069d545', '32408eca-08b3-445a-b287-5e79839e8f6c',
  '3992287b-0685-46b0-8be7-1a6441831a76', '2847e13d-c172-4e70-8913-27db266c1140', 'a0297d99-3690-41ef-a288-df03a0448345',
  'ddc6742a-db41-4fc6-8d0c-7258478cd642', '23e048e0-aca0-4357-bc5c-7dcbf7fb1023', '52ce949c-8e4f-4823-8c74-626473b80d26'
);

-- Batch 3: clients with no address data at all — the "Brasil" value there was a wrong
-- default, not a real answer. NULL is honest about "unknown" (and Buy Label already
-- defaults an unset country to US), instead of asserting a country we have zero evidence for.
UPDATE public.clients SET endereco_pais = NULL WHERE id IN ('21824e64-db31-4aa0-a42c-189d26da6aba', '186fc7e9-14fe-483b-afb4-def7d55c8a96');

-- Batch 4 (test/dummy clients — intentionally left untouched):
-- Ana Cliente Internacional, Carlos Cartao Internacional, Joao Producao Teste,
-- Maria Teste da Silva, testyre, teste.

-- Batch 5: 24 Amazon orders with no client_id at all — Amazon's report only ever exposed
-- city/state/zip/country for these (no buyer name, no street), so a real client record
-- was never created. Give each its own placeholder client ('-' as the name — we have no
-- buyer name to put there) with the structured city/state/zip/country it did have, and
-- link it — Buy Label will at least prefill that much instead of nothing.
WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Sacramento', 'CA', '95864-4939', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'cef94c88-3c93-4f90-babb-d6975723b108';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Glen Burnie', 'MD', '21061-3506', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'cf10447f-6cfb-49b4-add6-5ca60be80a37';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Miami', 'FL', '33195-6348', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = '47ec8a9d-2104-4d98-a85e-6cfbbfdbe5fc';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Miami', 'FL', '33166-2776', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = '72b7ee59-ee44-4e44-ac3b-530fc684e411';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Miami', 'FL', '33166-2776', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'ff63acde-c7ce-471d-8b5f-c7d76c24bf16';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Colorado Springs', 'CO', '80924-5230', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = '4218e7ae-dbff-4c4d-976f-70b72b24eea9';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Bronx', 'NY', '10455-2105', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = '461e21c0-f2ec-4329-9fde-1dc1e1b9c60c';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Hyattsville', 'MD', '20783-2631', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'c602eca6-a827-4c8d-91c1-c1ae09ae3d46';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Ridgewood', 'NY', '11385-7055', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = '0799d4b0-3029-418f-979d-d53df05f838a';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Lakeland', 'FL', '33809-4235', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'ebe23b7f-c552-4751-b68c-86f60c0e5930';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Wynnewood', 'PA', '19096-3329', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = '67f35239-2b7d-436b-a0d9-394d50c04415';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Glendale', 'AZ', '85307-2412', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'f6002ec6-93e3-42f5-b9f4-8cd2f84c1676';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Doral', 'FL', '33122-1611', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'b3c13674-e574-4cc3-aa01-e67d6fd7b72b';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Sacramento', 'CA', '95864-4939', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'e282ae37-63cd-4d02-8e7f-9a5da67a56ce';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Doral', 'FL', '33122-1611', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'acf15cca-bc4f-43c7-a9c5-2eaa89e69703';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Cincinnati', 'OH', '45238-2657', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = '69cbe60e-95e0-4800-a837-e70aaf7c9495';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Doral', 'FL', '33122-1611', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = '071d8fcf-3b57-4133-89f4-f9b517909a62';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Philadelphia', 'PA', '19123-2467', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = '57c23318-e779-4f80-8c33-aecb726c3435';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Doral', 'FL', '33122-1611', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = '8f98b2a6-9358-425d-813e-b4e3ff60089c';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'South Plainfield', 'NJ', '07080-1219', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'ba83e42d-d3fd-4ccd-aa0d-88e78e04bbaa';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'East Elmhurst', 'NY', '11370-1100', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'cc39f429-9bb2-4f71-b91c-39058d9557d9';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Damascus', 'MD', '20872-2362', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'de1e2919-75eb-4c3b-80eb-0b8e41ca85cd';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'Bowling Green', 'KY', '42101', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = '1d7467ec-ffba-41e4-828d-efbb5bd7c706';

WITH nc AS (INSERT INTO public.clients (nome_razao, endereco_cidade, endereco_estado, endereco_cep, endereco_pais, tipo, canal_principal) VALUES ('-', 'East Elmhurst', 'NY', '11370-1100', 'US', 'Cliente Final', 'Amazon') RETURNING id)
UPDATE public.orders SET client_id = (SELECT id FROM nc) WHERE id = 'ac47f6c8-85a1-4dd9-b6fe-73419b6373b2';
