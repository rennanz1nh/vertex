INSERT INTO public.automatic_emails (trigger_key, enabled, subject, html_content, delay_hours) VALUES
(
  'order_refunded',
  true,
  'Your refund for order #{order_number} has been processed',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#111827;font-size:20px">Refund processed, {customer_name}</h1>
  <p>We''ve processed a refund of <strong>{refund_amount}</strong> for your order <strong>#{order_number}</strong>.</p>
  <p>It can take a few business days to appear on your original payment method, depending on your bank or card issuer.</p>
  <p>Questions? Just reply to this email.</p>
  <p style="color:#6b7280;font-size:13px;margin-top:32px">Cosmetic Marketplace</p>
</div>',
  null
)
ON CONFLICT (trigger_key) DO NOTHING;
