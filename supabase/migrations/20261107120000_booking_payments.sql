SET search_path TO vertex, extensions;

-- Storefront payments: 20% deposit charged at checkout (card saved for off-session use),
-- remaining 80% charged automatically 5 days before pickup by /api/cron/booking-payments.
-- Bookings made less than 5 days out pay 100% at checkout (payment_plan = 'full').
-- Admin-entered bookings keep payment_plan NULL and are never charged by the app.

ALTER TABLE vertex.bookings
  ADD COLUMN IF NOT EXISTS payment_plan TEXT CHECK (payment_plan IN ('deposit_balance', 'full')),
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS balance_due_date DATE,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS deposit_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS balance_status TEXT NOT NULL DEFAULT 'none'
    CHECK (balance_status IN ('none', 'scheduled', 'processing', 'paid', 'failed')),
  ADD COLUMN IF NOT EXISTS balance_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS balance_paid_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS balance_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_last_attempt_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS balance_last_error TEXT,
  -- Secret for the customer's own "pay remaining balance" link (no customer accounts exist).
  ADD COLUMN IF NOT EXISTS payment_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_bookings_balance_due
  ON vertex.bookings (balance_due_date)
  WHERE balance_status IN ('scheduled', 'failed');
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_deposit_pi ON vertex.bookings (deposit_payment_intent_id);

ALTER TABLE vertex.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_type_check;
ALTER TABLE vertex.admin_notifications ADD CONSTRAINT admin_notifications_type_check
  CHECK (type IN ('new_order', 'delivery_update', 'ebay_offer_eligible', 'order_cancelled', 'turo_block', 'payment_failed'));
