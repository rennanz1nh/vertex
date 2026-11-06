SET search_path TO vertex, extensions;

-- Turo has no host API to block a car's calendar, so a booking made on our site has to be
-- blocked on Turo by hand. Every new booking (storefront request or admin entry) raises a
-- bell notification, and the admin marks it done on the booking (turo_blocked_at).

ALTER TABLE vertex.bookings ADD COLUMN IF NOT EXISTS turo_blocked_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE vertex.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_type_check;
ALTER TABLE vertex.admin_notifications ADD CONSTRAINT admin_notifications_type_check
  CHECK (type IN ('new_order', 'delivery_update', 'ebay_offer_eligible', 'order_cancelled', 'turo_block'));

CREATE OR REPLACE FUNCTION vertex.notify_admin_turo_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'vertex'
AS $function$
DECLARE
  v_car TEXT;
BEGIN
  IF NEW.status::text = 'cancelled' THEN
    RETURN NEW;
  END IF;
  SELECT coalesce(nullif(trim(name), ''), trim(concat_ws(' ', year, make, model)))
    INTO v_car FROM vertex.products WHERE id = NEW.car_id;
  INSERT INTO vertex.admin_notifications (type, title, message, link)
  VALUES (
    'turo_block',
    'Bloquear na Turo',
    coalesce(v_car, 'Carro') || ' · ' || to_char(NEW.pickup_date, 'MM/DD') || ' → ' || to_char(NEW.return_date, 'MM/DD'),
    '/admin/bookings'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS admin_notify_turo_block ON vertex.bookings;
CREATE TRIGGER admin_notify_turo_block
  AFTER INSERT ON vertex.bookings
  FOR EACH ROW
  EXECUTE FUNCTION vertex.notify_admin_turo_block();
