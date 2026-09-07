-- Add new values to the sales_channel enum
ALTER TYPE sales_channel ADD VALUE IF NOT EXISTS 'Online';
ALTER TYPE sales_channel ADD VALUE IF NOT EXISTS 'Loja';
ALTER TYPE sales_channel ADD VALUE IF NOT EXISTS 'Telefone';
ALTER TYPE sales_channel ADD VALUE IF NOT EXISTS 'WhatsApp';
ALTER TYPE sales_channel ADD VALUE IF NOT EXISTS 'Presencial';