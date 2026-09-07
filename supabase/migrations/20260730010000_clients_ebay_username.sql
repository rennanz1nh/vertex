-- The ebay-sync Edge Function used to dedupe auto-created eBay clients by string-matching
-- the free-text `observacoes` column (e.g. "eBay:{username}"). When that string format
-- changed between deployments ("eBay buyer: {username}" -> "eBay:{username}"), the lookup
-- silently stopped matching existing rows and created a fresh duplicate client for every
-- eBay buyer — confirmed and cleaned up manually on 2026-07-30 (26 orphaned zero-order
-- duplicates removed). This column + unique index makes that class of bug impossible going
-- forward: the dedupe key is now structured data, not a text pattern that can drift.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ebay_username TEXT;

-- Backfill from whatever format observacoes is currently in.
UPDATE public.clients
SET ebay_username = regexp_replace(observacoes, '^eBay:', '')
WHERE observacoes LIKE 'eBay:%' AND ebay_username IS NULL;

UPDATE public.clients
SET ebay_username = regexp_replace(observacoes, '^eBay buyer: ', '')
WHERE observacoes LIKE 'eBay buyer: %' AND ebay_username IS NULL;

-- Partial unique index (most clients aren't eBay buyers, so NULLs must stay unrestricted).
CREATE UNIQUE INDEX IF NOT EXISTS clients_ebay_username_unique
  ON public.clients (ebay_username)
  WHERE ebay_username IS NOT NULL;
