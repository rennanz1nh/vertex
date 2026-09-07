SET search_path TO vertex, extensions;

-- Push notification on every new sale, regardless of which channel wrote the row
-- (eBay/Amazon/TikTok Shop syncs, Stripe checkout webhook, manual order in the admin).
-- Implemented as a DB trigger (instead of patching every insert call site, which live in
-- both Next.js routes and Deno edge functions) so it fires no matter where the INSERT
-- comes from. Reuses the same notification_settings/push_notifications tables and ntfy.sh
-- delivery as every other push trigger — see src/lib/notify.ts for the app-side sender
-- used by triggers that run inside Next.js.
CREATE EXTENSION IF NOT EXISTS pg_net;

INSERT INTO vertex.push_notifications (trigger_key, enabled, title, message, tags) VALUES
('new_order', true, 'Nova venda: {canal}', 'Pedido de {total} recebido pelo {canal}.', 'moneybag,tada')
ON CONFLICT (trigger_key) DO NOTHING;

CREATE OR REPLACE FUNCTION vertex.notify_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_master RECORD;
  v_tpl RECORD;
  v_site_url TEXT;
  v_total TEXT;
  v_title TEXT;
  v_message TEXT;
  v_topic TEXT;
BEGIN
  SELECT enabled, ntfy_topic INTO v_master FROM vertex.notification_settings LIMIT 1;
  IF v_master IS NULL OR v_master.enabled IS NOT TRUE OR coalesce(v_master.ntfy_topic, '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT enabled, title, message, tags INTO v_tpl FROM vertex.push_notifications WHERE trigger_key = 'new_order';
  IF v_tpl IS NULL OR v_tpl.enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_total := to_char(coalesce(NEW.total, 0), 'FM999999990.00');
  v_title := replace(replace(v_tpl.title, '{canal}', NEW.canal::text), '{total}', v_total);
  v_message := replace(replace(v_tpl.message, '{canal}', NEW.canal::text), '{total}', v_total);

  -- Same normalization as normalizeNtfyTopic() in src/lib/notify.ts, so a topic saved
  -- with a pasted-in protocol/domain still resolves to the right ntfy.sh topic here.
  v_topic := regexp_replace(regexp_replace(regexp_replace(v_master.ntfy_topic, '^https?://', '', 'i'), '^ntfy\.sh/', '', 'i'), '^/+|/+$', '', 'g');

  SELECT site_url INTO v_site_url FROM vertex.site_settings LIMIT 1;

  PERFORM net.http_post(
    url := 'https://ntfy.sh/',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'topic', v_topic,
      'title', v_title,
      'message', v_message,
      'priority', 4,
      'tags', string_to_array(coalesce(v_tpl.tags, ''), ','),
      'click', coalesce(v_site_url, '') || '/admin'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A failed/misconfigured notification must never fail the order insert itself.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = vertex;

DROP TRIGGER IF EXISTS orders_notify_new_order ON vertex.orders;
CREATE TRIGGER orders_notify_new_order
  AFTER INSERT ON vertex.orders
  FOR EACH ROW
  EXECUTE FUNCTION vertex.notify_new_order();
