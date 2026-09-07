-- The product feed's feedLabel/contentLanguage must exactly match whatever the actual
-- Merchant Center primary data source was configured with (Google rejects every insert
-- otherwise: INVALID_DATA_SOURCE_FEED_LABEL_OR_LANGUAGE_MISMATCH_ITEM) — this can't be
-- safely hardcoded, so it's discovered once via datasources.list at connect time and
-- cached here alongside the data source name.
ALTER TABLE public.google_shopping_tokens
  ADD COLUMN IF NOT EXISTS feed_label TEXT,
  ADD COLUMN IF NOT EXISTS content_language TEXT;
