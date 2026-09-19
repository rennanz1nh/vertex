SET search_path TO vertex, extensions;

ALTER TYPE email_trigger_key ADD VALUE IF NOT EXISTS 'booking_confirmed';
