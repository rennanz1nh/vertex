SET search_path TO vertex, extensions;

INSERT INTO vertex.push_notifications (trigger_key, enabled, title, message, tags) VALUES
('new_booking', true, 'Nova reserva: {car}', '{customer} · {dates} · {paid}', 'red_car,tada')
ON CONFLICT (trigger_key) DO NOTHING;
