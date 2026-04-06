-- ============================================================
-- 0xRace: Map visibility + group locations
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Add map_visible to profiles (users can hide themselves from the map)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS map_visible BOOLEAN NOT NULL DEFAULT true;

-- Add optional lat/lng to groups (for group pin markers on the map)
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Default existing users to visible
UPDATE public.profiles SET map_visible = true WHERE map_visible IS NULL;

-- Seed some group locations around Portland for the existing groups
UPDATE public.groups SET lat = 45.5231, lng = -122.6765 WHERE name = 'PDX G8X';
UPDATE public.groups SET lat = 45.5180, lng = -122.6590 WHERE name = 'PDX JDM';
UPDATE public.groups SET lat = 45.5350, lng = -122.6900 WHERE name = 'PDX Euro';
UPDATE public.groups SET lat = 45.5100, lng = -122.6700 WHERE name = 'PDX Muscle';
