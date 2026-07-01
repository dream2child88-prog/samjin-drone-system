-- Supabase SQL Editor에서 한 번만 실행하세요.
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "temporary read app_state" on public.app_state;
drop policy if exists "temporary write app_state" on public.app_state;

create policy "temporary read app_state" on public.app_state for select using (true);
create policy "temporary write_app_state" on public.app_state for all using (true) with check (true);

-- 이미 등록되어 있다는 오류가 나면 이 줄은 무시해도 됩니다.
alter publication supabase_realtime add table public.app_state;
