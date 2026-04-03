-- ============================================================
-- 0xRace: Seed data + lat/lng on profiles
-- Run this in the Supabase SQL Editor (runs as service role)
-- ============================================================

-- ── Add lat/lng columns ────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Set 0xmeyn's location (Portland downtown)
UPDATE public.profiles
SET lat = 45.5231, lng = -122.6765
WHERE username = '0xmeyn';

-- ── Create 0x340 user + 4 groups + members ─────────────────
DO $$
DECLARE
  user_340_id UUID := gen_random_uuid();
  meyn_id     UUID;
  g1 UUID; g2 UUID; g3 UUID; g4 UUID;
BEGIN
  SELECT id INTO meyn_id FROM public.profiles WHERE username = '0xmeyn';

  -- Create auth user (trigger auto-creates profile row)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user
  ) VALUES (
    user_340_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    '0x340@placeholder.local',
    crypt('placeholder123!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"0x340","display_name":"0x340"}',
    false, false
  );

  -- Set location for 0x340 (NW Portland)
  UPDATE public.profiles SET lat = 45.5290, lng = -122.6850 WHERE id = user_340_id;

  -- Create 4 groups owned by 0xmeyn
  INSERT INTO public.groups (name, description, is_private, tags, created_by)
  VALUES ('PDX G8X', 'Portland G8X platform owners', false, ARRAY['G8X','BMW','Track'], meyn_id)
  RETURNING id INTO g1;

  INSERT INTO public.groups (name, description, is_private, tags, created_by)
  VALUES ('PDX JDM', 'Portland JDM community', false, ARRAY['JDM','Import','Street'], meyn_id)
  RETURNING id INTO g2;

  INSERT INTO public.groups (name, description, is_private, tags, created_by)
  VALUES ('PDX Euro', 'Portland European performance', false, ARRAY['Euro','Track','Performance'], meyn_id)
  RETURNING id INTO g3;

  INSERT INTO public.groups (name, description, is_private, tags, created_by)
  VALUES ('PDX Muscle', 'Portland American muscle', false, ARRAY['Muscle','American','Drag'], meyn_id)
  RETURNING id INTO g4;

  -- 0xmeyn as owner of all 4 groups
  INSERT INTO public.group_members (group_id, user_id, role, status) VALUES
    (g1, meyn_id, 'owner', 'active'),
    (g2, meyn_id, 'owner', 'active'),
    (g3, meyn_id, 'owner', 'active'),
    (g4, meyn_id, 'owner', 'active');

  -- 0x340 as member of all 4 groups
  INSERT INTO public.group_members (group_id, user_id, role, status) VALUES
    (g1, user_340_id, 'member', 'active'),
    (g2, user_340_id, 'member', 'active'),
    (g3, user_340_id, 'member', 'active'),
    (g4, user_340_id, 'member', 'active');

  RAISE NOTICE 'Done. 0x340 id=%, groups g1=%, g2=%, g3=%, g4=%',
    user_340_id, g1, g2, g3, g4;
END $$;
