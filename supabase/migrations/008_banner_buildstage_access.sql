-- ============================================================
-- 008: Add missing columns + access control for Stripe
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Fix: add banner_url to profiles (was referenced in app but missing from schema)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Fix: add build_stage to user_cars (was referenced in app but missing from schema)
ALTER TABLE public.user_cars
  ADD COLUMN IF NOT EXISTS build_stage TEXT NOT NULL DEFAULT 'stock';

-- Access control: has_access gates the app behind payment
-- Tier 2 0xdrive members get true for free; everyone else pays $45 one-time
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_access BOOLEAN NOT NULL DEFAULT false;

-- Stripe metadata (set by webhook after payment)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- Grant access to any existing users (early members / you)
-- Comment this out if you want everyone to pay
UPDATE public.profiles SET has_access = true;
