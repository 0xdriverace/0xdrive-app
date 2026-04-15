-- Per-car stats: times, wins, races stored on each car record
alter table user_cars
  add column if not exists times jsonb default '{}'::jsonb,
  add column if not exists wins  jsonb default '{"h2h":0,"group":0,"trial":0,"drag":0}'::jsonb,
  add column if not exists races jsonb default '{"h2h":0,"group":0,"trial":0,"drag":0}'::jsonb;
