alter table public.rosters
  add column if not exists signatures jsonb default '[]'::jsonb,
  add column if not exists hod_signed_at timestamptz,
  add column if not exists hod_signed_by uuid references auth.users(id) on delete set null,
  add column if not exists director_signed_at timestamptz,
  add column if not exists director_signed_by uuid references auth.users(id) on delete set null;

alter table public.rosters
  drop constraint if exists rosters_status_check;

alter table public.rosters
  add constraint rosters_status_check
  check (status in ('draft', 'submitted', 'approved', 'hod_signed', 'director_signed', 'published'));
