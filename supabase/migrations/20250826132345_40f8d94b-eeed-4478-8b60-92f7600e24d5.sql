SET search_path TO vertex, extensions;

-- Create enum types first
CREATE TYPE vertex.app_role AS ENUM ('admin', 'operador', 'leitura');
CREATE TYPE vertex.product_brand AS ENUM ('Sorali', 'Just Sofistic', 'Argilo Detox', 'Daily Therapy');
CREATE TYPE vertex.client_type AS ENUM ('Salão/Cabeleireira', 'Revendedor', 'Online/Marketplace', 'Cliente Final');
CREATE TYPE vertex.sales_channel AS ENUM ('eBay', 'Amazon', 'Etsy', 'Direto/Outros');
CREATE TYPE vertex.order_status AS ENUM ('Orçado', 'Pago', 'Enviado', 'Entregue', 'Cancelado');
CREATE TYPE vertex.validity_status AS ENUM ('Válido', 'Vencendo em 60 dias', 'Vencido');

-- Create profiles table for user management
CREATE TABLE vertex.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role app_role NOT NULL DEFAULT 'leitura',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for profiles
ALTER TABLE vertex.profiles ENABLE ROW LEVEL SECURITY;

-- Create products table
CREATE TABLE vertex.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  upc TEXT,
  nome TEXT NOT NULL,
  marca product_brand,
  linha_produto TEXT,
  gramas_ml DECIMAL(10,2),
  quantidade_por_caixa INTEGER,
  fornecedor TEXT,
  custo_minimo_unidade DECIMAL(10,2) NOT NULL DEFAULT 0,
  frete_unidade DECIMAL(10,2) DEFAULT 0,
  imposto_retido_unidade DECIMAL(10,2) DEFAULT 0,
  preco_salao DECIMAL(10,2) NOT NULL DEFAULT 0,
  preco_revendedor DECIMAL(10,2) NOT NULL DEFAULT 0,
  preco_online DECIMAL(10,2) NOT NULL DEFAULT 0,
  barcode TEXT,
  estoque_atual INTEGER NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 0,
  lote TEXT,
  data_validade DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for products
ALTER TABLE vertex.products ENABLE ROW LEVEL SECURITY;

-- Create clients table
CREATE TABLE vertex.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo client_type NOT NULL,
  nome_razao TEXT NOT NULL,
  contato_responsavel TEXT,
  telefone TEXT,
  email TEXT,
  endereco_rua TEXT,
  endereco_cidade TEXT,
  endereco_estado TEXT,
  endereco_cep TEXT,
  endereco_pais TEXT DEFAULT 'Brasil',
  canal_principal sales_channel,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for clients
ALTER TABLE vertex.clients ENABLE ROW LEVEL SECURITY;

-- Create orders table
CREATE TABLE vertex.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
  canal sales_channel NOT NULL,
  client_id UUID REFERENCES vertex.clients(id),
  status order_status NOT NULL DEFAULT 'Orçado',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  impostos DECIMAL(10,2) NOT NULL DEFAULT 0,
  frete_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  descontos DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  numero_pedido_canal TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for orders
ALTER TABLE vertex.orders ENABLE ROW LEVEL SECURITY;

-- Create order items table
CREATE TABLE vertex.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES vertex.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES vertex.products(id),
  quantidade INTEGER NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  custo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  imposto_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  frete_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for order items
ALTER TABLE vertex.order_items ENABLE ROW LEVEL SECURITY;

-- Create investments table
CREATE TABLE vertex.investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  comprovante_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for investments
ALTER TABLE vertex.investments ENABLE ROW LEVEL SECURITY;

-- Create expired products table
CREATE TABLE vertex.expired_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES vertex.products(id),
  quantidade INTEGER NOT NULL,
  data_identificacao DATE NOT NULL DEFAULT CURRENT_DATE,
  destino TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for expired products
ALTER TABLE vertex.expired_products ENABLE ROW LEVEL SECURITY;

-- Create audit logs table
CREATE TABLE vertex.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for audit logs
ALTER TABLE vertex.audit_logs ENABLE ROW LEVEL SECURITY;