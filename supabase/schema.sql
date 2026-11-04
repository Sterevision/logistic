-- Выполнить в Supabase: SQL Editor -> New query -> Run

create extension if not exists "pgcrypto";

-- Роли: driver (по умолчанию) и dispatcher (диспетчер/админ)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text not null default 'driver' check (role in ('driver','dispatcher')),
  created_at timestamptz default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function public.is_dispatcher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'dispatcher');
$$;

-- Клиенты (ООО и ИП)
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'ООО' check (kind in ('ООО','ИП')),
  inn text,
  address text not null,
  lat double precision,
  lng double precision,
  unload_minutes int default 15,
  work_from time,
  work_to time,
  phone text,
  notes text,
  created_at timestamptz default now()
);

-- Особые точки на карте: плохая дорога, весовой пост, платный участок
create table if not exists hazards (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bad_road','weigh_post','toll')),
  title text not null,
  lat double precision not null,
  lng double precision not null,
  radius_m int not null default 150,
  severity int default 2 check (severity between 1 and 3),
  toll_price_rub numeric,
  active boolean not null default true,
  confirmations int not null default 0,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz default now()
);

-- Рейсы на конкретный день
create table if not exists trip_plans (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references auth.users default auth.uid(),
  plan_date date not null default (current_date + 1),
  depot jsonb not null,
  settings jsonb,
  result jsonb,
  status text not null default 'planned' check (status in ('planned','in_progress','done')),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists trip_stops (
  plan_id uuid references trip_plans on delete cascade,
  client_id uuid references clients on delete set null,
  seq int not null,
  name text,       -- снимок клиента на момент рейса
  address text,
  lat double precision,
  lng double precision,
  phone text,
  work_from time,
  work_to time,
  unload_min int,
  eta_min int,     -- плановое прибытие, минут от полуночи
  wait_min int,
  late_min int,
  skipped_at timestamptz,
  done_at timestamptz,
  primary key (plan_id, seq)
);

-- RLS
alter table profiles   enable row level security;
alter table clients    enable row level security;
alter table hazards    enable row level security;
alter table trip_plans enable row level security;
alter table trip_stops enable row level security;

create policy "profiles: читать свой" on profiles for select using (id = auth.uid() or is_dispatcher());

create policy "clients: читают все вошедшие" on clients for select to authenticated using (true);
create policy "clients: пишет диспетчер"    on clients for all to authenticated using (is_dispatcher()) with check (is_dispatcher());

create policy "hazards: читают все вошедшие"   on hazards for select to authenticated using (true);
create policy "hazards: добавляет любой водитель" on hazards for insert to authenticated with check (created_by = auth.uid());
create policy "hazards: правит автор или диспетчер" on hazards for update to authenticated using (created_by = auth.uid() or is_dispatcher());
create policy "hazards: удаляет диспетчер"     on hazards for delete to authenticated using (is_dispatcher());
create policy "hazards: автор удаляет своё"    on hazards for delete to authenticated using (created_by = auth.uid());

create policy "plans: свои или диспетчер" on trip_plans for all to authenticated
  using (driver_id = auth.uid() or is_dispatcher()) with check (driver_id = auth.uid() or is_dispatcher());
create policy "stops: через свой план" on trip_stops for all to authenticated
  using (exists (select 1 from trip_plans p where p.id = plan_id and (p.driver_id = auth.uid() or is_dispatcher())))
  with check (exists (select 1 from trip_plans p where p.id = plan_id and (p.driver_id = auth.uid() or is_dispatcher())));

-- Подтверждение опасной точки другим водителем (+1)
create or replace function public.confirm_hazard(hid uuid) returns void
language sql security definer set search_path = public as $$
  update public.hazards set confirmations = confirmations + 1 where id = hid;
$$;

-- Первого диспетчера назначьте вручную:
-- update profiles set role = 'dispatcher' where id = '<uuid вашего пользователя>';
