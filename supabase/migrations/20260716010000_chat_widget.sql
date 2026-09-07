SET search_path TO vertex, extensions;

-- Storefront chat widget: visitor conversations + messages.
-- No anon/authenticated RLS policies on purpose — every read/write goes through
-- Next.js API routes using the service role key, which apply their own filtering
-- (conversation_id scoping for visitors, Supabase-session check for admin routes).
-- This avoids relying on "authenticated = admin", which isn't a safe assumption
-- in this project (see profiles.role / handle_new_user()).
CREATE TABLE IF NOT EXISTS vertex.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  closed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS vertex.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES vertex.chat_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('visitor', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_created_at_idx
  ON vertex.chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS chat_conversations_last_message_at_idx
  ON vertex.chat_conversations(last_message_at DESC);

ALTER TABLE vertex.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertex.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages chat conversations"
  ON vertex.chat_conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages chat messages"
  ON vertex.chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
