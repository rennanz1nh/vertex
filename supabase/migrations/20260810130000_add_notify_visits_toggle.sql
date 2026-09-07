SET search_path TO vertex, extensions;

-- Separate on/off switch for the "visitor / checkout started" push notifications,
-- independent from the main `enabled` flag which governs automation notifications.
ALTER TABLE vertex.notification_settings
  ADD COLUMN IF NOT EXISTS notify_visits BOOLEAN NOT NULL DEFAULT true;
