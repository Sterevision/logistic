-- Обновление базы для версии с редактированием клиентов и сохранёнными рейсами.
-- Выполнить один раз: Supabase -> SQL Editor -> New query -> Run

alter table public.trip_stops
  add column if not exists name text,
  add column if not exists address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- Чтобы клиента можно было удалить, а старые рейсы остались
alter table public.trip_stops drop constraint if exists trip_stops_client_id_fkey;
alter table public.trip_stops
  add constraint trip_stops_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete set null;
