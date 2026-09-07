-- Extends the admin notification bell with a fourth type: an order being cancelled.
-- Mirrors notify_admin_delivery_update (20260818130100), same trigger shape, different
-- status transition.

ALTER TABLE public.admin_notifications DROP CONSTRAINT admin_notifications_type_check;
ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_type_check
  CHECK (type IN ('new_order', 'delivery_update', 'ebay_offer_eligible', 'order_cancelled'));

CREATE OR REPLACE FUNCTION public.notify_admin_order_cancelled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'Cancelado' THEN
    INSERT INTO public.admin_notifications (type, title, message, link)
    VALUES (
      'order_cancelled',
      'Pedido cancelado',
      coalesce(NEW.numero_pedido_canal, left(NEW.id::text, 8)) || ' · ' || coalesce(NEW.canal::text, ''),
      '/admin/orders'
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS admin_notify_order_cancelled ON public.orders;
CREATE TRIGGER admin_notify_order_cancelled
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_order_cancelled();
