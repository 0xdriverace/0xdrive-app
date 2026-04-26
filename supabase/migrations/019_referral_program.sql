-- ============================================================
-- 019: Referral / Creator code program
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ── PROFILES: add referral fields ────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS is_creator BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creator_tier TEXT DEFAULT 'starter'
    CHECK (creator_tier IN ('starter','bronze','silver','gold','ambassador')),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(4,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS total_referrals INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS host_events_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS host_badge BOOLEAN NOT NULL DEFAULT false;

-- ── REFERRAL_SIGNUPS: track each referral ────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_signups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'signed_up'
    CHECK (status IN ('signed_up','active','premium','churned')),
  earned      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (referred_id)
);

ALTER TABLE public.referral_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_signups_select_own" ON public.referral_signups
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "referral_signups_insert" ON public.referral_signups
  FOR INSERT WITH CHECK (auth.uid() = referred_id);

-- ── CREATOR_PAYOUTS: track payout history ────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_payouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','paid','failed')),
  method      TEXT DEFAULT 'stripe',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_payouts_select_own" ON public.creator_payouts
  FOR SELECT USING (auth.uid() = user_id);

-- ── INDEXES ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_referral_signups_referrer ON public.referral_signups(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_signups_code ON public.referral_signups(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_user ON public.creator_payouts(user_id);

-- ── REALTIME ─────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_signups;
