-- ============================================================
-- 0xRace Initial Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ── PROFILES ──────────────────────────────────────────────────────────
-- One row per auth user. Username is the unique public handle.
-- Display name is the real name (optional, toggled by show_real_name).
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT NOT NULL,
  username         TEXT NOT NULL UNIQUE,
  display_name     TEXT,
  avatar_initials  TEXT,           -- 2-letter fallback until avatar_url is set
  avatar_url       TEXT,
  bio              TEXT,
  city             TEXT,
  show_real_name   BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (needed for leaderboard, search, etc.)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Insert is handled server-side during signup (service role or via function)
-- We allow the authenticated user to insert their own row
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);


-- ── USER_CARS ──────────────────────────────────────────────────────────
-- A user can have multiple cars; is_primary flags the main one shown on profile.
CREATE TABLE IF NOT EXISTS public.user_cars (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  make        TEXT NOT NULL,
  model       TEXT NOT NULL,
  year        INT  NOT NULL,
  photos      TEXT[],            -- array of storage URLs
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_cars_select_all" ON public.user_cars
  FOR SELECT USING (true);

CREATE POLICY "user_cars_insert_own" ON public.user_cars
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_cars_update_own" ON public.user_cars
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_cars_delete_own" ON public.user_cars
  FOR DELETE USING (auth.uid() = user_id);


-- ── USER_SOCIALS ───────────────────────────────────────────────────────
-- Social links per platform per user (instagram, twitter, youtube, etc.)
CREATE TABLE IF NOT EXISTS public.user_socials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,      -- 'instagram' | 'twitter' | 'youtube'
  handle      TEXT NOT NULL,
  UNIQUE (user_id, platform)
);

ALTER TABLE public.user_socials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_socials_select_all" ON public.user_socials
  FOR SELECT USING (true);

CREATE POLICY "user_socials_insert_own" ON public.user_socials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_socials_update_own" ON public.user_socials
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_socials_delete_own" ON public.user_socials
  FOR DELETE USING (auth.uid() = user_id);


-- ── FRIENDSHIPS ────────────────────────────────────────────────────────
-- Bidirectional friendship. requester sends, recipient accepts/rejects.
-- status: 'pending' | 'accepted' | 'rejected'
CREATE TABLE IF NOT EXISTS public.friendships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, recipient_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Users can see friendships they are part of
CREATE POLICY "friendships_select_own" ON public.friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Users can send friend requests (insert as requester)
CREATE POLICY "friendships_insert_own" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Recipients can update status (accept/reject); requester can cancel (delete)
CREATE POLICY "friendships_update_recipient" ON public.friendships
  FOR UPDATE USING (auth.uid() = recipient_id OR auth.uid() = requester_id);

CREATE POLICY "friendships_delete_own" ON public.friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = recipient_id);


-- ── GROUPS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  is_private  BOOLEAN NOT NULL DEFAULT false,
  tags        TEXT[],
  max_members INT NOT NULL DEFAULT 50,
  created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Anyone can read groups (for search)
CREATE POLICY "groups_select_all" ON public.groups
  FOR SELECT USING (true);

-- Authenticated users can create groups
CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Only owner (created_by) or admins can update group metadata
-- (admin check handled in app logic for now; tighten later)
CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE USING (auth.uid() = created_by);


-- ── GROUP_MEMBERS ──────────────────────────────────────────────────────
-- role:   'owner' | 'admin' | 'member'
-- status: 'active' | 'pending'
CREATE TABLE IF NOT EXISTS public.group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Anyone can read group membership (for member counts, etc.)
CREATE POLICY "group_members_select_all" ON public.group_members
  FOR SELECT USING (true);

-- Users can join groups (insert themselves)
CREATE POLICY "group_members_insert_own" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own membership; owners/admins handle approvals
-- (admin check via role enforced in app; revisit with a function for tighter security)
CREATE POLICY "group_members_update_own" ON public.group_members
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can update any member in groups they admin
CREATE POLICY "group_members_update_admin" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner','admin')
        AND gm.status = 'active'
    )
  );

CREATE POLICY "group_members_delete_own" ON public.group_members
  FOR DELETE USING (auth.uid() = user_id);


-- ── GROUP_MESSAGES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Only active group members can read messages
CREATE POLICY "group_messages_select_members" ON public.group_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_messages.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

-- Active members can send messages
CREATE POLICY "group_messages_insert_members" ON public.group_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_messages.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'active'
    )
  );

-- Users can delete their own messages
CREATE POLICY "group_messages_delete_own" ON public.group_messages
  FOR DELETE USING (auth.uid() = user_id);


-- ── RACE_TIMES ─────────────────────────────────────────────────────────
-- category: '0-60' | '0-120' | 'quarter_mile' | 'half_mile'
-- time_seconds stored as numeric for proper sorting/comparison
CREATE TABLE IF NOT EXISTS public.race_times (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  car_id       UUID REFERENCES public.user_cars(id) ON DELETE SET NULL,
  category     TEXT NOT NULL CHECK (category IN ('0-60','0-120','quarter_mile','half_mile')),
  time_seconds NUMERIC(6,3) NOT NULL,
  verified     BOOLEAN NOT NULL DEFAULT false,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.race_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "race_times_select_all" ON public.race_times
  FOR SELECT USING (true);

CREATE POLICY "race_times_insert_own" ON public.race_times
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "race_times_update_own" ON public.race_times
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "race_times_delete_own" ON public.race_times
  FOR DELETE USING (auth.uid() = user_id);


-- ── CAR_LISTINGS ───────────────────────────────────────────────────────
-- status: 'active' | 'sold' | 'draft'
CREATE TABLE IF NOT EXISTS public.car_listings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  make        TEXT NOT NULL,
  model       TEXT NOT NULL,
  year        INT  NOT NULL,
  mileage     INT,
  price       NUMERIC(10,2),
  description TEXT,
  photos      TEXT[],
  location    TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','draft')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.car_listings ENABLE ROW LEVEL SECURITY;

-- Anyone can read active listings
CREATE POLICY "car_listings_select_active" ON public.car_listings
  FOR SELECT USING (status = 'active' OR auth.uid() = user_id);

CREATE POLICY "car_listings_insert_own" ON public.car_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "car_listings_update_own" ON public.car_listings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "car_listings_delete_own" ON public.car_listings
  FOR DELETE USING (auth.uid() = user_id);


-- ── INDEXES ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_username      ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_cars_user_id      ON public.user_cars(user_id);
CREATE INDEX IF NOT EXISTS idx_user_socials_user_id   ON public.user_socials(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester  ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_recipient  ON public.friendships(recipient_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group    ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user     ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group   ON public.group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_race_times_user        ON public.race_times(user_id);
CREATE INDEX IF NOT EXISTS idx_car_listings_user      ON public.car_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_car_listings_status    ON public.car_listings(status);
