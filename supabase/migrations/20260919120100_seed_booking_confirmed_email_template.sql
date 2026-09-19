SET search_path TO vertex, extensions;

-- Fired from POST /api/bookings/[id]/notify-confirmed, which the admin Reservas panel
-- calls when a booking's status is changed from something else into "confirmed" (i.e.
-- once payment has been confirmed and the admin approves the trip).
INSERT INTO vertex.automatic_emails (trigger_key, enabled, subject, html_content, delay_hours) VALUES
(
  'booking_confirmed',
  true,
  'Your booking is confirmed — {car_name}',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="color:#111827;font-size:20px">You''re all set, {customer_name}!</h1>
  <p>Your booking has been confirmed. Here are your rental details:</p>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0">
    <p style="margin:0 0 8px"><strong>Confirmation #:</strong> {confirmation_number}</p>
    <p style="margin:0 0 8px"><strong>Vehicle:</strong> {car_name}</p>
    <p style="margin:0 0 8px"><strong>Pick-up:</strong> {pickup_date} at {pickup_time}</p>
    <p style="margin:0 0 8px"><strong>Return:</strong> {return_date} at {return_time}</p>
    <p style="margin:0 0 8px"><strong>Trip length:</strong> {days} day(s)</p>
    <p style="margin:0 0 8px"><strong>Protection plan:</strong> {protection_plan}</p>
    <p style="margin:0"><strong>Extras:</strong> {extras_list}</p>
  </div>
  <p style="margin:0 0 20px"><strong>Estimated total:</strong> {estimated_total}</p>
  <p>Please bring a valid driver''s license and the card used for payment when you pick up the vehicle. If anything needs to change, just reply to this email.</p>
  <p style="color:#6b7280;font-size:13px;margin-top:32px">Vertex Rental Cars</p>
</div>',
  null
)
ON CONFLICT (trigger_key) DO NOTHING;
