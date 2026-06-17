-- Two-stage leave approval and enterprise roster extensions.

alter table public.leave_requests
  add column if not exists hod_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists hod_reviewed_at timestamptz,
  add column if not exists hod_notes text;

alter table public.leave_requests
  drop constraint if exists leave_requests_status_check;

alter table public.leave_requests
  add constraint leave_requests_status_check
  check (status in (
    'pending_hod',
    'pending_hr',
    'approved',
    'rejected_hod',
    'rejected_hr'
  ));

update public.leave_requests set status = 'pending_hod' where status = 'pending';

create table if not exists public.allowance_rates (
  id                uuid primary key default gen_random_uuid(),
  hospital_id       uuid references public.hospitals(id),
  shift_code        text not null,
  rate_ghs          numeric(10,2) not null,
  effective_from    date not null,
  notes             text
);

insert into public.allowance_rates (hospital_id, shift_code, rate_ghs, effective_from)
values
  ('11111111-1111-4111-8111-111111111111', 'N', 50.00, '2026-01-01'),
  ('11111111-1111-4111-8111-111111111111', 'H', 80.00, '2026-01-01')
on conflict do nothing;

alter table public.rosters
  add column if not exists signatures jsonb default '[]'::jsonb,
  add column if not exists hod_signed_at timestamptz,
  add column if not exists director_signed_at timestamptz;

create table if not exists public.locum_shifts (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid references public.departments(id) on delete cascade,
  shift_date     date not null,
  shift_code     text not null,
  requirements   text,
  status         text default 'open' check (status in ('open', 'filled', 'cancelled')),
  filled_by      uuid references public.staff(id) on delete set null,
  posted_by      uuid references auth.users(id) on delete set null,
  created_at     timestamptz default now()
);
