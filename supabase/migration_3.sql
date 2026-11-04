-- Обновление базы: окна приёмки, телефоны, режим «Еду», быстрые отметки на дороге.
-- Выполнить один раз: Supabase -> SQL Editor -> New query -> Run
-- (migration_2.sql должен быть выполнен раньше)

alter table public.clients
  add column if not exists phone text;

alter table public.trip_stops
  add column if not exists phone text,
  add column if not exists work_from time,
  add column if not exists work_to time,
  add column if not exists unload_min int,
  add column if not exists eta_min int,      -- плановое прибытие, минут от полуночи
  add column if not exists wait_min int,
  add column if not exists late_min int,
  add column if not exists skipped_at timestamptz;

alter table public.trip_plans
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

-- Водитель может удалить свою отметку (кнопка «Отменить» после быстрой отметки)
drop policy if exists "hazards: автор удаляет своё" on public.hazards;
create policy "hazards: автор удаляет своё" on public.hazards
  for delete to authenticated using (created_by = auth.uid());
