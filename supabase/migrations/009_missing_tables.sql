-- ============================================================
-- 009: Add missing tables and columns referenced in app code
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ── GROUPS: add missing columns ───────────────────────────────────────
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS banner_url   TEXT,
  ADD COLUMN IF NOT EXISTS theme_color  TEXT NOT NULL DEFAULT '#e61a1a';

-- ── FRIENDS ────────────────────────────────────────────────────────────
-- Simplified bidirectional friendship (optimistic accept on add).
-- Each direction is a separate row; app queries user_id OR friend_id.
CREATE TABLE IF NOT EXISTS public.friends (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending','accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id)
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friends_select_own" ON public.friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "friends_insert_own" ON public.friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "friends_update_own" ON public.friends
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "friends_delete_own" ON public.friends
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ── LOBBIES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lobbies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'cruise',
  is_open     BOOLEAN NOT NULL DEFAULT true,
  group_id    UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  destination TEXT,
  created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lobbies_select_all" ON public.lobbies
  FOR SELECT USING (true);

CREATE POLICY "lobbies_insert_own" ON public.lobbies
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "lobbies_update_own" ON public.lobbies
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "lobbies_delete_own" ON public.lobbies
  FOR DELETE USING (auth.uid() = created_by);

-- ── LOBBY_MEMBERS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lobby_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id  UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lobby_id, user_id)
);

ALTER TABLE public.lobby_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lobby_members_select_all" ON public.lobby_members
  FOR SELECT USING (true);

CREATE POLICY "lobby_members_insert_own" ON public.lobby_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Owner can approve/deny; member can update their own status
CREATE POLICY "lobby_members_update_own_or_owner" ON public.lobby_members
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.lobbies l
      WHERE l.id = lobby_id AND l.created_by = auth.uid()
    )
  );

CREATE POLICY "lobby_members_delete_own_or_owner" ON public.lobby_members
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.lobbies l
      WHERE l.id = lobby_id AND l.created_by = auth.uid()
    )
  );

-- ── GROUP_POSTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;

-- Active members can read posts in their groups
CREATE POLICY "group_posts_select_members" ON public.group_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_posts.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

-- Active members can post
CREATE POLICY "group_posts_insert_members" ON public.group_posts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_posts.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

CREATE POLICY "group_posts_delete_own" ON public.group_posts
  FOR DELETE USING (auth.uid() = user_id);

-- ── GROUP_EVENTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  event_date DATE NOT NULL,
  location   TEXT,
  is_public  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_events_select_all" ON public.group_events
  FOR SELECT USING (
    is_public OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_events.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

CREATE POLICY "group_events_insert_members" ON public.group_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_events.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

-- ── INDEXES ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_friends_user_id    ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id  ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_created_by ON public.lobbies(created_by);
CREATE INDEX IF NOT EXISTS idx_lobby_members_lobby ON public.lobby_members(lobby_id);
CREATE INDEX IF NOT EXISTS idx_group_posts_group  ON public.group_posts(group_id);
CREATE INDEX IF NOT EXISTS idx_group_events_group ON public.group_events(group_id);
