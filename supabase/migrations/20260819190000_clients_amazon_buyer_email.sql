-- Mirrors the eBay dedupe pattern (clients.ebay_username) for Amazon: the flat-file "All
-- Orders" report the Amazon import reads does carry buyer-name/buyer-email/ship-address
-- columns, but the importer never used them, so imported Amazon orders never got a linked
-- client — the order screen showed no buyer name at all. Amazon's report has no stable
-- per-buyer id (unlike eBay's username), so buyer-email is the dedupe key instead.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS amazon_buyer_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS clients_amazon_buyer_email_unique
  ON public.clients (amazon_buyer_email)
  WHERE amazon_buyer_email IS NOT NULL;
