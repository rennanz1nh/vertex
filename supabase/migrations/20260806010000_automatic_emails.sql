-- Automatic transactional emails (Settings → E-mails Automáticos). Sent through Brevo's
-- transactional email API (src/lib/brevo.ts's sendTransactionalEmail) — same account
-- already connected for the Email Marketing section, just a different Brevo endpoint.
CREATE TYPE email_trigger_key AS ENUM (
  'order_confirmation',
  'order_shipped',
  'order_delivered',
  'order_cancelled',
  'newsletter_welcome',
  'abandoned_cart'
);

CREATE TABLE IF NOT EXISTS public.automatic_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key email_trigger_key NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  sender_name TEXT,
  sender_email TEXT,
  -- Only meaningful for abandoned_cart: how long an unpaid Checkout Session sits before
  -- it's considered abandoned and the reminder fires (also used to set that Session's
  -- own expires_at, since Stripe only tells us "expired", not "abandoned after N hours").
  delay_hours INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.automatic_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view automatic emails"
  ON public.automatic_emails
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and operador can manage automatic emails"
  ON public.automatic_emails
  FOR ALL
  TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['admin'::app_role, 'operador'::app_role]))
  WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::app_role, 'operador'::app_role]));

INSERT INTO public.automatic_emails (trigger_key, enabled, subject, html_content, delay_hours) VALUES
(
  'order_confirmation',
  true,
  'Your order #{order_number} is confirmed!',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#111827;font-size:20px">Thanks for your order, {customer_name}!</h1>
  <p>We''ve received your order <strong>#{order_number}</strong> and we''re getting it ready.</p>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0">
    <p style="margin:0 0 8px"><strong>Order total:</strong> {order_total}</p>
    <p style="margin:0"><strong>Shipping to:</strong> {shipping_address}</p>
  </div>
  <p>{items_list}</p>
  <p>We''ll email you again as soon as it ships.</p>
  <p style="color:#6b7280;font-size:13px;margin-top:32px">Cosmetic Marketplace</p>
</div>',
  null
),
(
  'order_shipped',
  true,
  'Your order #{order_number} has shipped!',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#111827;font-size:20px">It''s on the way, {customer_name}!</h1>
  <p>Your order <strong>#{order_number}</strong> has shipped via {carrier}.</p>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0">
    <p style="margin:0"><strong>Tracking number:</strong> {tracking_number}</p>
  </div>
  <p><a href="{tracking_url}" style="background:#db3614;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Track your package</a></p>
  <p style="color:#6b7280;font-size:13px;margin-top:32px">Cosmetic Marketplace</p>
</div>',
  null
),
(
  'order_delivered',
  true,
  'Your order #{order_number} was delivered!',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#111827;font-size:20px">Delivered! We hope you love it, {customer_name}.</h1>
  <p>Your order <strong>#{order_number}</strong> was delivered. If anything looks off, just reply to this email and we''ll sort it out.</p>
  <p>Enjoying your products? A quick review helps us a lot!</p>
  <p style="color:#6b7280;font-size:13px;margin-top:32px">Cosmetic Marketplace</p>
</div>',
  null
),
(
  'order_cancelled',
  true,
  'Your order #{order_number} was cancelled',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#111827;font-size:20px">Order cancelled</h1>
  <p>Hi {customer_name}, your order <strong>#{order_number}</strong> has been cancelled.</p>
  <p>If a payment was made, any refund will be processed back to your original payment method within a few business days.</p>
  <p>Questions? Just reply to this email.</p>
  <p style="color:#6b7280;font-size:13px;margin-top:32px">Cosmetic Marketplace</p>
</div>',
  null
),
(
  'newsletter_welcome',
  true,
  'Welcome! Here''s 10% off your first order',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#111827;font-size:20px">Welcome to Cosmetic Marketplace!</h1>
  <p>Thanks for joining our list — expect news, restocks and offers straight to your inbox.</p>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0;text-align:center">
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Use this code on your first order</p>
    <p style="margin:0;font-size:22px;font-weight:bold;letter-spacing:2px">WELCOME10</p>
  </div>
  <p style="color:#6b7280;font-size:13px;margin-top:32px">Cosmetic Marketplace</p>
</div>',
  null
),
(
  'abandoned_cart',
  true,
  'You left something in your cart',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#111827;font-size:20px">Still thinking it over?</h1>
  <p>You left some items in your cart. They''re still available, but we can''t hold them forever!</p>
  <p>{items_list}</p>
  <p><a href="{store_url}" style="background:#db3614;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Complete your purchase</a></p>
  <p style="color:#6b7280;font-size:13px;margin-top:32px">Cosmetic Marketplace</p>
</div>',
  4
)
ON CONFLICT (trigger_key) DO NOTHING;
