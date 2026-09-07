SET search_path TO vertex, extensions;

ALTER PUBLICATION supabase_realtime ADD TABLE vertex.admin_notifications;
ALTER TABLE vertex.admin_notifications REPLICA IDENTITY FULL;
