-- ============================================================
-- 0xRace: Auto-create profile on auth user signup
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Function runs as postgres (SECURITY DEFINER), bypasses RLS.
-- User metadata passed via signUp({ options: { data: {...} } })
-- is available as NEW.raw_user_meta_data.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username      TEXT;
  _display_name  TEXT;
  _initials      TEXT;
  _show_real_name BOOLEAN;
BEGIN
  -- Sanitise username from metadata (lowercase, strip invalid chars)
  _username := lower(
    regexp_replace(
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
      '[^a-z0-9_]', '', 'g'
    )
  );

  _display_name   := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'display_name', '')), '');
  _initials       := upper(left(COALESCE(_display_name, _username), 2));
  _show_real_name := COALESCE((NEW.raw_user_meta_data->>'show_real_name')::boolean, false);

  INSERT INTO public.profiles (id, email, username, display_name, avatar_initials, show_real_name)
  VALUES (NEW.id, NEW.email, _username, _display_name, _initials, _show_real_name)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger first in case you re-run this migration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
