-- ============================================================
-- 010: Grant access to all existing users + default new signups to true
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Grant access to every existing account
UPDATE public.profiles SET has_access = true;

-- New signups automatically get access (no payment required)
ALTER TABLE public.profiles ALTER COLUMN has_access SET DEFAULT true;
