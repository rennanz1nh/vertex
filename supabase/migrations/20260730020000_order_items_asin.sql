-- Amazon identifies products by ASIN, not by our SKU (the seller SKU Amazon reports is its
-- own internal code, e.g. "RX-9OAO-GC7D", which has no relation to our catalog). Products
-- carry the ASIN via products."ASIN"; this column records which ASIN was actually sold on
-- each line, so the historical order stays accurate even if a product's ASIN is later
-- changed or reassigned to a different listing.
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS asin TEXT;
