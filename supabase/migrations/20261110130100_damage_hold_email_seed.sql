SET search_path TO vertex, extensions;

-- Sent by the booking-payments cron when the $99 damage-deposit hold could not be placed on
-- the saved card on pick-up day; {hold_link} lets the customer authorize it with any card.
INSERT INTO vertex.automatic_emails (trigger_key, enabled, subject, html_content, delay_hours) VALUES
(
  'booking_hold_failed',
  true,
  'Action needed: damage deposit for your {car_name} trip',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#111827;font-size:20px">Hi {customer_name},</h1>
  <p>We tried to place the refundable damage deposit of <strong>{hold_amount}</strong> on your card for your trip, but your bank did not approve it ({failure_reason}).</p>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0">
    <p style="margin:0 0 8px"><strong>Confirmation #:</strong> {confirmation_number}</p>
    <p style="margin:0 0 8px"><strong>Vehicle:</strong> {car_name}</p>
    <p style="margin:0 0 8px"><strong>Pick-up:</strong> {pickup_date} at {pickup_time}</p>
    <p style="margin:0"><strong>Return:</strong> {return_date} at {return_time}</p>
  </div>
  <p>This is a hold, not a charge: it is released automatically 3 days after you return the car. Please authorize it with any card:</p>
  <p style="margin:24px 0"><a href="{hold_link}" style="background:#111827;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Authorize {hold_amount} hold</a></p>
</div>',
  0
)
ON CONFLICT (trigger_key) DO NOTHING;
