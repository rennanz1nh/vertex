SET search_path TO vertex, extensions;

-- First, update any existing orders to have a valid canal value
UPDATE orders SET canal = 'Online' WHERE canal IS NULL OR canal NOT IN ('Online', 'WhatsApp', 'Presencial');

-- Drop the existing canal type
ALTER TABLE orders ALTER COLUMN canal TYPE text;

-- Drop the old enum type if it exists
DROP TYPE IF EXISTS sales_channel CASCADE;

-- Create new enum type with all the sales channels
CREATE TYPE sales_channel AS ENUM (
  'Presencial',
  'Amazon',
  'eBay',
  'Etsy',
  'TikTok',
  'Vertex Rental Cars',
  'Credit Card',
  'Zelle',
  'Online',
  'WhatsApp',
  'Outro'
);

-- Update the column to use the new enum type
ALTER TABLE orders ALTER COLUMN canal TYPE sales_channel USING canal::sales_channel;

-- Set default value
ALTER TABLE orders ALTER COLUMN canal SET DEFAULT 'Online'::sales_channel;