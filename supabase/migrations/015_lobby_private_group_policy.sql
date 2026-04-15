-- ============================================================
-- 015: Block pending group members from creating lobbies for private groups
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Drop the existing permissive insert policy
DROP POLICY IF EXISTS "lobbies_insert_own" ON public.lobbies;

-- New policy: allow insert only if
--   a) not linked to a group (group_id is null), OR
--   b) linked to an open group, OR
--   c) linked to a private group AND user is an active member
CREATE POLICY "lobbies_insert_own" ON public.lobbies
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = group_id AND g.is_private = false
      )
      OR EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = lobbies.group_id
          AND gm.user_id = auth.uid()
          AND gm.status = 'active'
      )
    )
  );
