-- Separate on/off switch for the "visitor / checkout started" push notifications,
-- independent from the main `enabled` flag which governs automation notifications.
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS notify_visits BOOLEAN NOT NULL DEFAULT true;
