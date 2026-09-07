SET search_path TO vertex, extensions;

-- Allow 'select' as a run mode (user picked specific listings instead of test/full)
ALTER TABLE vertex.ebay_price_automation_logs
  DROP CONSTRAINT IF EXISTS ebay_price_automation_logs_mode_check;

ALTER TABLE vertex.ebay_price_automation_logs
  ADD CONSTRAINT ebay_price_automation_logs_mode_check CHECK (mode IN ('test', 'full', 'select'));
