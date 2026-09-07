SET search_path TO vertex, extensions;

-- History of eBay "send offer to interested buyers" sends, so the Send Offer page can show
-- the last 30 days of sent offers as a read-only reference below the eligible-items list.
CREATE TABLE IF NOT EXISTS vertex.ebay_offers_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id TEXT NOT NULL,
  title TEXT,
  image TEXT,
  original_price NUMERIC,
  discount_percentage NUMERIC NOT NULL,
  offered_price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  quantity INTEGER NOT NULL DEFAULT 1,
  message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ebay_offers_sent_sent_at ON vertex.ebay_offers_sent (sent_at DESC);

ALTER TABLE vertex.ebay_offers_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages ebay offers sent" ON vertex.ebay_offers_sent;
CREATE POLICY "Service role manages ebay offers sent"
  ON vertex.ebay_offers_sent FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read ebay offers sent" ON vertex.ebay_offers_sent;
CREATE POLICY "Authenticated users can read ebay offers sent"
  ON vertex.ebay_offers_sent FOR SELECT
  TO authenticated
  USING (true);
