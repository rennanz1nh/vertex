SET search_path TO vertex, extensions;

-- Powers the floating WhatsApp button (src/components/store/WhatsAppButton.tsx) — a
-- wa.me link built from this number. Digits only, with country code (e.g. 14075551234),
-- same convention wa.me itself expects; the button hides itself if this is empty.
ALTER TABLE vertex.site_settings ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
