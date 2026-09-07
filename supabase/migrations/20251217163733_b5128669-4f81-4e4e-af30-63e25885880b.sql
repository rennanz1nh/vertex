-- Add canal_principal column to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS canal_principal text;