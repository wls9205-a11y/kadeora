-- #6 토론방 → 채팅방: chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL CHECK(char_length(content) <= 300),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chat" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Logged in users can write" ON chat_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC);
