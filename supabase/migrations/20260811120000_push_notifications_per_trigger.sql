-- Per-trigger control for push notifications (Settings → Notificações), mirroring the
-- automatic_emails table: each notification the system can send to the phone (via
-- ntfy.sh) now has its own enabled flag + editable title/message template, instead of
-- sharing one generic on/off switch and one eBay-flavored title/message pair.
CREATE TYPE push_trigger_key AS ENUM (
  'ebay_price_success',
  'ebay_price_error',
  'amazon_price_success',
  'amazon_price_error',
  'tiktok_price_success',
  'tiktok_price_error',
  'google_shopping_success',
  'google_shopping_error',
  'new_chat_message',
  'new_visit',
  'checkout_started'
);

CREATE TABLE IF NOT EXISTS public.push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key push_trigger_key NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  -- Comma-separated ntfy emoji short-codes (https://docs.ntfy.sh/emojis/), e.g. "moneybag,white_check_mark".
  tags TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view push notifications"
  ON public.push_notifications
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and operador can manage push notifications"
  ON public.push_notifications
  FOR ALL
  TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['admin'::app_role, 'operador'::app_role]))
  WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::app_role, 'operador'::app_role]));

INSERT INTO public.push_notifications (trigger_key, enabled, title, message, tags) VALUES
('ebay_price_success', true, 'eBay: preços atualizados', 'Execução {trigger} ({mode}): {updated}/{total} listing(s) atualizado(s).', 'moneybag,white_check_mark'),
('ebay_price_error', true, 'eBay: falha na automação de preço', 'Execução {trigger} ({mode}) falhou: {error}', 'warning'),
('amazon_price_success', true, 'Amazon: preços atualizados', 'Execução {trigger} ({mode}): {updated}/{total} listing(s) atualizado(s).', 'moneybag,white_check_mark'),
('amazon_price_error', true, 'Amazon: falha na automação de preço', 'Execução {trigger} ({mode}) falhou: {error}', 'warning'),
('tiktok_price_success', true, 'TikTok Shop: preços atualizados', 'Execução {trigger} ({mode}): {updated}/{total} listing(s) atualizado(s).', 'moneybag,white_check_mark'),
('tiktok_price_error', true, 'TikTok Shop: falha na automação de preço', 'Execução {trigger} ({mode}) falhou: {error}', 'warning'),
('google_shopping_success', true, 'Google Shopping: produtos sincronizados', 'Execução {trigger} ({mode}): {synced}/{total} produto(s) sincronizado(s).', 'mag,white_check_mark'),
('google_shopping_error', true, 'Google Shopping: falha na sincronização', 'Execução {trigger} ({mode}) falhou: {error}', 'warning'),
('new_chat_message', true, 'Novo chat: {who}', '{preview}', 'speech_balloon'),
('new_visit', true, 'Alguém visitou seu site', 'Página: {path}\nLocal: {location}', 'eyes'),
('checkout_started', true, 'Checkout iniciado', 'Valor: {amount}\nLocal: {location}', 'shopping_cart')
ON CONFLICT (trigger_key) DO NOTHING;

-- The old generic title/message pair and the ad-hoc notify_visits flag are superseded
-- by the per-trigger rows above; notification_settings now only holds the master
-- on/off switch and the shared ntfy topic.
ALTER TABLE public.notification_settings
  DROP COLUMN IF EXISTS success_title,
  DROP COLUMN IF EXISTS success_message,
  DROP COLUMN IF EXISTS error_title,
  DROP COLUMN IF EXISTS error_message,
  DROP COLUMN IF EXISTS notify_visits;
