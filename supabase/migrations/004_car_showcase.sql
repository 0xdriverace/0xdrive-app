-- ============================================================
-- 004: Car showcase — trim, mods, instagram, storage bucket
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Add trim and mods to user_cars
ALTER TABLE public.user_cars
  ADD COLUMN IF NOT EXISTS trim TEXT,
  ADD COLUMN IF NOT EXISTS mods TEXT;

-- Add instagram handle to profiles (quick access, avoids join for most common social)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instagram TEXT;

-- ── STORAGE BUCKET ─────────────────────────────────────────────────────
-- Create the car-photos bucket (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'car-photos',
  'car-photos',
  true,
  10485760,   -- 10 MB max
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- ── STORAGE POLICIES ───────────────────────────────────────────────────
-- Public read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'car_photos_public_read'
  ) THEN
    CREATE POLICY "car_photos_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'car-photos');
  END IF;
END $$;

-- Authenticated users upload into their own user-id folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'car_photos_insert_own'
  ) THEN
    CREATE POLICY "car_photos_insert_own"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'car-photos'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- Users can update (replace) their own objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'car_photos_update_own'
  ) THEN
    CREATE POLICY "car_photos_update_own"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'car-photos'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- Users can delete their own objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'car_photos_delete_own'
  ) THEN
    CREATE POLICY "car_photos_delete_own"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'car-photos'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
