SET search_path TO vertex, extensions;

-- Add ASIN column to products table for Amazon integration
ALTER TABLE vertex.products
ADD COLUMN "ASIN" TEXT UNIQUE;

-- Create index on ASIN for faster lookups
CREATE INDEX idx_products_asin ON vertex.products("ASIN") WHERE "ASIN" IS NOT NULL;
