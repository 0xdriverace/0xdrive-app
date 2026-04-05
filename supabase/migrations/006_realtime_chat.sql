-- ============================================================
-- 006: Enable Realtime for group_messages
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Add group_messages to the realtime publication so clients
-- receive INSERT events via Supabase channel subscriptions.
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- Also publish group_members changes so member counts stay live.
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
