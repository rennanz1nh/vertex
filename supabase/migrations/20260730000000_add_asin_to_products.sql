-- Add ASIN column to products table for Amazon integration
ALTER TABLE public.products
ADD COLUMN "ASIN" TEXT UNIQUE;

-- Create index on ASIN for faster lookups
CREATE INDEX idx_products_asin ON public.products("ASIN") WHERE "ASIN" IS NOT NULL;
