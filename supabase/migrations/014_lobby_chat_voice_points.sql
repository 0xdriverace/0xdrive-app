-- ============================================================
-- 014: Lobby chat, voice (mic_active), and points system
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ── PROFILES: add points column ───────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;

-- ── LOBBY_MEMBERS: add mic_active column ──────────────────────────────
ALTER TABLE public.lobby_members
  ADD COLUMN IF NOT EXISTS mic_active BOOLEAN NOT NULL DEFAULT false;

-- ── LOBBY_MESSAGES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lobby_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id   UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lobby_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read messages in a lobby they're a member of
CREATE POLICY "lobby_messages_select_members" ON public.lobby_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lobby_members lm
      WHERE lm.lobby_id = lobby_messages.lobby_id
        AND lm.user_id = auth.uid()
        AND lm.status = 'active'
    )
  );

-- Members can send messages
CREATE POLICY "lobby_messages_insert_members" ON public.lobby_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.lobby_members lm
      WHERE lm.lobby_id = lobby_messages.lobby_id
        AND lm.user_id = auth.uid()
        AND lm.status = 'active'
    )
  );

-- Users can delete their own messages
CREATE POLICY "lobby_messages_delete_own" ON public.lobby_messages
  FOR DELETE USING (auth.uid() = user_id);

-- ── REALTIME: publish lobby_messages and lobby_members ────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_members;

-- ── INDEXES ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lobby_messages_lobby ON public.lobby_messages(lobby_id);
CREATE INDEX IF NOT EXISTS idx_lobby_messages_created ON public.lobby_messages(created_at);
