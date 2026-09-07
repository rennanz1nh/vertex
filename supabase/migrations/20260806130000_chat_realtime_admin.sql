SET search_path TO vertex, extensions;

-- Enable Realtime for the admin chat (authenticated users only). Public store chat keeps
-- polling; anon is intentionally NOT granted SELECT so visitors can't read other people's
-- conversations. Admin routes still write via service_role; these SELECT policies only
-- let the logged-in admin subscribe to Postgres change events.

ALTER PUBLICATION supabase_realtime ADD TABLE vertex.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE vertex.chat_conversations;

-- Needed so Realtime can deliver the full row (not just the id) on UPDATE/DELETE.
ALTER TABLE vertex.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE vertex.chat_conversations REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Authenticated users can read chat messages" ON vertex.chat_messages;
CREATE POLICY "Authenticated users can read chat messages"
  ON vertex.chat_messages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can read chat conversations" ON vertex.chat_conversations;
CREATE POLICY "Authenticated users can read chat conversations"
  ON vertex.chat_conversations FOR SELECT
  TO authenticated
  USING (true);
