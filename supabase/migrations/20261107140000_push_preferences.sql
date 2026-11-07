SET search_path TO vertex, extensions;

-- On/off and custom text for each Vertex phone notification (catalog in
-- src/lib/push-catalog.ts). A separate table from push_notifications on purpose: older
-- builds of the Settings page crash on push_notifications rows they have no label for, so
-- new triggers never get rows there. No row = catalog defaults.
CREATE TABLE IF NOT EXISTS vertex.push_preferences (
  trigger_key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL,
  title TEXT,
  message TEXT,
  tags TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE vertex.push_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages push preferences" ON vertex.push_preferences;
CREATE POLICY "Service role manages push preferences"
  ON vertex.push_preferences FOR ALL TO service_role USING (true) WITH CHECK (true);

-- "Turo sem sincronizar" is sent at most once a day.
ALTER TABLE vertex.turo_tokens ADD COLUMN IF NOT EXISTS stale_alert_at TIMESTAMP WITH TIME ZONE;
