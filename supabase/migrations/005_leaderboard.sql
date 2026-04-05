-- ============================================================
-- 005: Leaderboard — proof_url, car_class, indexes
-- Run this in the Supabase SQL Editor
-- ============================================================

ALTER TABLE public.race_times
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS car_class TEXT;

-- Faster filtering by category + class + time
CREATE INDEX IF NOT EXISTS idx_race_times_cat_time
  ON public.race_times(category, time_seconds ASC);

CREATE INDEX IF NOT EXISTS idx_race_times_cat_class_time
  ON public.race_times(category, car_class, time_seconds ASC);
