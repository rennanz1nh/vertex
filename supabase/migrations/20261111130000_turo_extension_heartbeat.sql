-- Last attempt reported by the Chrome extension (success or failure), so the admin can see
-- why the Turo data is stale instead of only "X hours without sync".
ALTER TABLE vertex.turo_tokens ADD COLUMN IF NOT EXISTS extension_seen_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE vertex.turo_tokens ADD COLUMN IF NOT EXISTS extension_ok BOOLEAN;
ALTER TABLE vertex.turo_tokens ADD COLUMN IF NOT EXISTS extension_message TEXT;
