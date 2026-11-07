SET search_path TO vertex, extensions;

-- Apply only once the code that knows 'new_booking' is live: older builds of the Settings
-- page crash on push rows they have no label for. The push works without this row (see
-- BUILT_IN_TEMPLATES in src/lib/notify.ts); the row only makes it editable in Settings.

INSERT INTO vertex.push_notifications (trigger_key, enabled, title, message, tags) VALUES
('new_booking', true, 'Nova reserva: {car}', '{customer} · {dates} · {paid}', 'red_car,tada')
ON CONFLICT (trigger_key) DO NOTHING;
