-- ============================================================
-- 016: Race sessions + destination lat/lng on lobbies
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ── LOBBIES: store destination coordinates ───────────────────
ALTER TABLE public.lobbies
  ADD COLUMN IF NOT EXISTS dest_lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dest_lng  DOUBLE PRECISION;

-- ── RACE_SESSIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.race_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id    UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  format      TEXT NOT NULL DEFAULT 'quarter_mile',
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','cancelled')),
  created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);

ALTER TABLE public.race_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "race_sessions_select_all" ON public.race_sessions FOR SELECT USING (true);
CREATE POLICY "race_sessions_insert_own" ON public.race_sessions FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "race_sessions_update_own" ON public.race_sessions FOR UPDATE USING (auth.uid() = created_by);

-- ── RACE_PARTICIPANTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.race_participants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id          UUID NOT NULL REFERENCES public.race_sessions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  car_id           UUID REFERENCES public.user_cars(id) ON DELETE SET NULL,
  elapsed_ms       INTEGER,      -- milliseconds from GO to finish
  finished_at      TIMESTAMPTZ,
  position         INTEGER,      -- 1 = winner
  UNIQUE (race_id, user_id)
);

ALTER TABLE public.race_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "race_participants_select_all" ON public.race_participants FOR SELECT USING (true);
CREATE POLICY "race_participants_insert_own" ON public.race_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "race_participants_update_own" ON public.race_participants FOR UPDATE USING (auth.uid() = user_id);

-- ── REALTIME ──────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.race_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.race_participants;

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_race_sessions_lobby ON public.race_sessions(lobby_id);
CREATE INDEX IF NOT EXISTS idx_race_participants_race ON public.race_participants(race_id);
