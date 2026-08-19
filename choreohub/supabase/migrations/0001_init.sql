-- ChoreoHub Phase 6 — 초기 스키마
-- projects / versions / compare_runs 전부 user_id를 직접 들고 있게 비정규화해서
-- RLS 정책을 서브쿼리 없이 auth.uid() = user_id 로 단순하게 걸 수 있게 했다.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  song_name text not null default '',
  bpm integer,
  description text not null default '',
  status text not null default 'in_progress',
  member_count integer not null default 1,
  thumbnail_color text not null default '#7c3aed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects(user_id);

alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- versions
-- ---------------------------------------------------------------------------
create table if not exists public.versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  video_path text not null,
  duration_sec numeric not null default 0,
  pose_data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists versions_project_id_idx on public.versions(project_id);
create index if not exists versions_user_id_idx on public.versions(user_id);

alter table public.versions enable row level security;

create policy "versions_select_own" on public.versions
  for select using (auth.uid() = user_id);
create policy "versions_insert_own" on public.versions
  for insert with check (auth.uid() = user_id);
create policy "versions_update_own" on public.versions
  for update using (auth.uid() = user_id);
create policy "versions_delete_own" on public.versions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- compare_runs
-- ---------------------------------------------------------------------------
create table if not exists public.compare_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_version_id uuid not null references public.versions(id) on delete cascade,
  source jsonb not null,
  result jsonb,
  descriptive jsonb,
  advice jsonb,
  ref_video jsonb,
  range_pairs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists compare_runs_project_id_idx on public.compare_runs(project_id);
create index if not exists compare_runs_user_id_idx on public.compare_runs(user_id);
create index if not exists compare_runs_user_version_id_idx on public.compare_runs(user_version_id);

alter table public.compare_runs enable row level security;

create policy "compare_runs_select_own" on public.compare_runs
  for select using (auth.uid() = user_id);
create policy "compare_runs_insert_own" on public.compare_runs
  for insert with check (auth.uid() = user_id);
create policy "compare_runs_update_own" on public.compare_runs
  for update using (auth.uid() = user_id);
create policy "compare_runs_delete_own" on public.compare_runs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: videos 버킷 (비공개, 경로 규칙 {user_id}/{filename})
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

create policy "videos_select_own" on storage.objects
  for select using (
    bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "videos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "videos_update_own" on storage.objects
  for update using (
    bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "videos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text
  );
