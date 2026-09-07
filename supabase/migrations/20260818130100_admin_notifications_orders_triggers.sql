-- New sale: fires on every order insert, regardless of channel (Stripe, eBay sync, Amazon
-- upload, manual entry) since they all insert into orders.
CREATE OR REPLACE FUNCTION public.notify_admin_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total TEXT;
BEGIN
  v_total := to_char(coalesce(NEW.total, 0), 'FM999999990.00');
  INSERT INTO public.admin_notifications (type, title, message, link)
  VALUES (
    'new_order',
    'Nova venda',
    coalesce(NEW.canal::text, 'Pedido') || ' · $' || v_total,
    '/admin/orders'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS admin_notify_new_order ON public.orders;
CREATE TRIGGER admin_notify_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_order();

-- Delivery update: fires when status actually changes into Enviado or Entregue (not on
-- every update, and not if it was already in that status).
CREATE OR REPLACE FUNCTION public.notify_admin_delivery_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('Enviado', 'Entregue') THEN
    INSERT INTO public.admin_notifications (type, title, message, link)
    VALUES (
      'delivery_update',
      CASE WHEN NEW.status = 'Entregue' THEN 'Pedido entregue' ELSE 'Pedido enviado' END,
      coalesce(NEW.numero_pedido_canal, left(NEW.id::text, 8)) || ' · ' || coalesce(NEW.canal::text, ''),
      '/admin/orders'
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS admin_notify_delivery_update ON public.orders;
CREATE TRIGGER admin_notify_delivery_update
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_delivery_update();
