SET search_path TO vertex, extensions;

-- Sent by the booking-payments cron when the automatic charge of the remaining balance
-- fails; {pay_link} lets the customer pay with another card.
INSERT INTO vertex.automatic_emails (trigger_key, enabled, subject, html_content, delay_hours) VALUES
(
  'booking_payment_failed',
  true,
  'Action needed: payment for your {car_name} trip',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#111827;font-size:20px">Hi {customer_name},</h1>
  <p>We tried to charge the remaining balance of <strong>{balance_amount}</strong> for your trip, but the payment did not go through ({failure_reason}).</p>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0">
    <p style="margin:0 0 8px"><strong>Confirmation #:</strong> {confirmation_number}</p>
    <p style="margin:0 0 8px"><strong>Vehicle:</strong> {car_name}</p>
    <p style="margin:0"><strong>Pick-up:</strong> {pickup_date} at {pickup_time}</p>
  </div>
  <p>Please pay the balance before your pick-up to keep your reservation:</p>
  <p style="margin:24px 0"><a href="{pay_link}" style="background:#111827;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Pay {balance_amount}</a></p>
  <p style="font-size:12px;color:#6b7280">We will try your card on file again in 24 hours.</p>
</div>',
  0
)
ON CONFLICT (trigger_key) DO NOTHING;

-- Adds the payment schedule to the confirmation email, only if the template still has the
-- stock "Estimated total" line (an edited template is left alone).
UPDATE vertex.automatic_emails
SET html_content = replace(
  html_content,
  '<p style="margin:0 0 20px"><strong>Estimated total:</strong> {estimated_total}</p>',
  '<p style="margin:0 0 8px"><strong>Total:</strong> {estimated_total}</p>
  <p style="margin:0 0 20px">{payment_summary}</p>'
)
WHERE trigger_key = 'booking_confirmed' AND html_content NOT LIKE '%{payment_summary}%';
