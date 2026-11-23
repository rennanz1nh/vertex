SET search_path TO vertex, extensions;

-- Admin "Reembolsar" on website bookings: running total refunded through Stripe.
ALTER TABLE vertex.bookings
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS refund_note TEXT;
