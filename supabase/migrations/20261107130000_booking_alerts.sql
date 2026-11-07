SET search_path TO vertex, extensions;

-- Who gets told about every booking paid on the site (email + SMS). Comma-separated lists.
-- Empty = fall back to site_settings.business_email / master admin email, and
-- site_settings.business_phone / whatsapp_number (see src/lib/booking-alerts.ts).
ALTER TABLE vertex.notification_settings
  ADD COLUMN IF NOT EXISTS booking_alert_emails TEXT,
  ADD COLUMN IF NOT EXISTS booking_alert_phones TEXT,
  ADD COLUMN IF NOT EXISTS booking_alert_sms_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_alert_sms_sender TEXT;

-- Must be its own transaction before the value is used (next migration).
ALTER TYPE push_trigger_key ADD VALUE IF NOT EXISTS 'new_booking';
