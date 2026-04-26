-- ============================================================
-- 018: Voice messages, lobby sub-rooms, event RSVP, customizable meets
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ── LOBBY_MESSAGES: add voice message support ─────────────────────────
ALTER TABLE public.lobby_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text','voice')),
  ADD COLUMN IF NOT EXISTS voice_url TEXT,
  ADD COLUMN IF NOT EXISTS voice_duration INTEGER; -- duration in seconds

-- ── LOBBY_ROOMS: private chat rooms within a lobby ────────────────────
CREATE TABLE IF NOT EXISTS public.lobby_rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id   UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lobby_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lobby_rooms_select_members" ON public.lobby_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lobby_members lm
      WHERE lm.lobby_id = lobby_rooms.lobby_id
        AND lm.user_id = auth.uid()
        AND lm.status = 'active'
    )
  );

CREATE POLICY "lobby_rooms_insert_members" ON public.lobby_rooms
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM public.lobby_members lm
      WHERE lm.lobby_id = lobby_rooms.lobby_id
        AND lm.user_id = auth.uid()
        AND lm.status = 'active'
    )
  );

CREATE POLICY "lobby_rooms_delete_owner" ON public.lobby_rooms
  FOR DELETE USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.lobbies l
      WHERE l.id = lobby_rooms.lobby_id AND l.created_by = auth.uid()
    )
  );

-- ── LOBBY_ROOM_MEMBERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lobby_room_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   UUID NOT NULL REFERENCES public.lobby_rooms(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE public.lobby_room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lobby_room_members_select" ON public.lobby_room_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lobby_room_members lrm2
      WHERE lrm2.room_id = lobby_room_members.room_id
        AND lrm2.user_id = auth.uid()
    )
  );

CREATE POLICY "lobby_room_members_insert" ON public.lobby_room_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.lobby_rooms lr
      WHERE lr.id = lobby_room_members.room_id AND lr.created_by = auth.uid()
    )
  );

CREATE POLICY "lobby_room_members_delete" ON public.lobby_room_members
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.lobby_rooms lr
      WHERE lr.id = lobby_room_members.room_id AND lr.created_by = auth.uid()
    )
  );

-- ── LOBBY_ROOM_MESSAGES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lobby_room_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES public.lobby_rooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content      TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','voice')),
  voice_url    TEXT,
  voice_duration INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lobby_room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lobby_room_messages_select" ON public.lobby_room_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lobby_room_members lrm
      WHERE lrm.room_id = lobby_room_messages.room_id
        AND lrm.user_id = auth.uid()
    )
  );

CREATE POLICY "lobby_room_messages_insert" ON public.lobby_room_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.lobby_room_members lrm
      WHERE lrm.room_id = lobby_room_messages.room_id
        AND lrm.user_id = auth.uid()
    )
  );

-- ── GROUP_EVENTS: expand for customizable meets ──────────────────────
ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS rules TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS require_rsvp BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- ── EVENT_RSVPS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_rsvps_select" ON public.event_rsvps
  FOR SELECT USING (true);

CREATE POLICY "event_rsvps_insert_own" ON public.event_rsvps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Event creator can approve/deny; user can update own
CREATE POLICY "event_rsvps_update" ON public.event_rsvps
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.group_events ge
      WHERE ge.id = event_rsvps.event_id AND ge.created_by = auth.uid()
    )
  );

CREATE POLICY "event_rsvps_delete" ON public.event_rsvps
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.group_events ge
      WHERE ge.id = event_rsvps.event_id AND ge.created_by = auth.uid()
    )
  );

-- ── REALTIME ──────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps;

-- ── INDEXES ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lobby_rooms_lobby ON public.lobby_rooms(lobby_id);
CREATE INDEX IF NOT EXISTS idx_lobby_room_members_room ON public.lobby_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_lobby_room_messages_room ON public.lobby_room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON public.event_rsvps(user_id);

-- ── STORAGE: voice-messages bucket ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-messages', 'voice-messages', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "voice_messages_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'voice-messages' AND auth.uid() IS NOT NULL);

CREATE POLICY "voice_messages_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice-messages');
