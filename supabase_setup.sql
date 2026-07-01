-- Supabase SQL Editor에서 그대로 실행하세요.
-- 당장 빠르게 쓰기 위한 임시 구조입니다. 모든 자료를 app_state 1행에 저장합니다.
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "temporary read app_state" on public.app_state;
drop policy if exists "temporary write app_state" on public.app_state;

-- 빠른 현장 사용용: anon 접속자가 읽기/쓰기 가능.
-- 정식 제작 시 반드시 로그인 기반 정책으로 바꾸세요.
create policy "temporary read app_state" on public.app_state for select using (true);
create policy "temporary write app_state" on public.app_state for all using (true) with check (true);

alter publication supabase_realtime add table public.app_state;
