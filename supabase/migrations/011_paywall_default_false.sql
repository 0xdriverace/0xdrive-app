-- ============================================================
-- 011: New signups default to no access (must pay or be granted)
-- Existing accounts (owner + Branden) keep has_access = true from 010.
-- Run this in the Supabase SQL Editor
-- ============================================================

-- New signups require payment or manual grant
ALTER TABLE public.profiles ALTER COLUMN has_access SET DEFAULT false;

-- To grant a specific user free access (run per user as needed):
-- UPDATE public.profiles SET has_access = true WHERE email = 'user@example.com';
