SET search_path TO vertex, extensions;

-- Refundable damage deposit ($99) for storefront bookings. Nothing is charged at checkout:
-- on pick-up day /api/cron/booking-payments places a card authorization (hold) on the card
-- saved at checkout, and releases it 3 days after the admin marks the car as returned
-- ("Carro devolvido"), unless the admin charges damage ("Cobrar dano") first.
-- Admin-entered bookings keep damage_hold_status = 'none' and never get a hold.

ALTER TABLE vertex.bookings
  ADD COLUMN IF NOT EXISTS damage_hold_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS damage_hold_status TEXT NOT NULL DEFAULT 'none'
    CHECK (damage_hold_status IN ('none', 'scheduled', 'processing', 'held', 'failed', 'released', 'captured')),
  ADD COLUMN IF NOT EXISTS damage_hold_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS damage_hold_authorized_at TIMESTAMP WITH TIME ZONE,
  -- When the card network drops the authorization; the cron places a new hold before then
  -- if the car is still out.
  ADD COLUMN IF NOT EXISTS damage_hold_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS damage_hold_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damage_hold_last_attempt_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS damage_hold_last_error TEXT,
  ADD COLUMN IF NOT EXISTS damage_hold_released_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS damage_charged_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS damage_charged_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS damage_charge_note TEXT,
  -- Set by the admin "Carro devolvido" button; the hold is released 3 days later.
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_bookings_damage_hold_active
  ON vertex.bookings (damage_hold_status)
  WHERE damage_hold_status IN ('scheduled', 'processing', 'held', 'failed');

ALTER TYPE email_trigger_key ADD VALUE IF NOT EXISTS 'booking_hold_failed';
