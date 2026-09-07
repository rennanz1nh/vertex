SET search_path TO vertex, extensions;

-- Add canal_principal column to clients table
ALTER TABLE vertex.clients 
ADD COLUMN IF NOT EXISTS canal_principal text;