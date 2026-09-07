SET search_path TO vertex, extensions;

-- Settings for phone push notifications (ntfy.sh) sent on automation runs (single-row table)
CREATE TABLE IF NOT EXISTS vertex.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT true,
  ntfy_topic TEXT, -- if null/empty, the NTFY_TOPIC env var is used as a fallback
  success_title TEXT NOT NULL DEFAULT 'eBay: preços atualizados',
  success_message TEXT NOT NULL DEFAULT 'Execução {trigger} ({mode}): {updated}/{total} listing(s) atualizado(s).',
  error_title TEXT NOT NULL DEFAULT 'eBay: falha na automação de preço',
  error_message TEXT NOT NULL DEFAULT 'Execução {trigger} ({mode}) falhou: {error}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vertex.notification_settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users (admin panel) can read + update settings
CREATE POLICY "Authenticated users can read notification settings"
  ON vertex.notification_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update notification settings"
  ON vertex.notification_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role (cron route + manual update route, using the service key) manages everything
CREATE POLICY "Service role manages notification settings"
  ON vertex.notification_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed the single settings row
INSERT INTO vertex.notification_settings (enabled)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM vertex.notification_settings);
