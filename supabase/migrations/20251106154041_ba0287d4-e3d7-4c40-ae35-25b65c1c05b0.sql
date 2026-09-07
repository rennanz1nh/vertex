SET search_path TO vertex, extensions;

-- Add new fields to orders table
ALTER TABLE vertex.orders 
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
ADD COLUMN IF NOT EXISTS shipping_tracking TEXT,
ADD COLUMN IF NOT EXISTS custo_total_shipping NUMERIC DEFAULT 0;