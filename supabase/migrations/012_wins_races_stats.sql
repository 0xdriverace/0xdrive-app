-- Add wins, races JSONB columns to profiles for per-format tracking
alter table profiles
  add column if not exists wins  jsonb default '{"h2h":0,"group":0,"trial":0,"drag":0}'::jsonb,
  add column if not exists races jsonb default '{"h2h":0,"group":0,"trial":0,"drag":0}'::jsonb;
