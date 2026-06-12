create extension if not exists pgcrypto;

create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  created_at timestamptz default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references public.hospitals(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.shift_configurations (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete cascade,
  shift_code text not null check (shift_code in ('M', 'A', 'N', 'O', 'H', '%')),
  shift_name text not null,
  start_time time,
  end_time time,
  color_class text,
  is_active boolean default true
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references public.hospitals(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  staff_number text unique,
  full_name text not null,
  rank text,
  position text,
  employment_type text,
  phone text,
  email text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.rosters (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2000 and 2200),
  status text default 'draft' check (status in ('draft', 'submitted', 'approved', 'published')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  published_at timestamptz,
  unique (department_id, month, year)
);

create table public.roster_entries (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid references public.rosters(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  shift_date date not null,
  shift_code text not null check (shift_code in ('M', 'A', 'N', 'O', 'H', '%', 'LEAVE')),
  shift_config_id uuid references public.shift_configurations(id) on delete set null,
  notes text,
  is_leave boolean default false,
  leave_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (roster_id, staff_id, shift_date)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff(id) on delete cascade,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  reason text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  check (end_date >= start_date)
);

create table public.shift_swaps (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.staff(id) on delete cascade,
  replacement_id uuid references public.staff(id) on delete cascade,
  requester_entry_id uuid references public.roster_entries(id) on delete cascade,
  replacement_entry_id uuid references public.roster_entries(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz default now(),
  reviewed_by uuid references auth.users(id) on delete set null
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'medical_director', 'department_head', 'doctor', 'nurse', 'hr_officer')),
  department_id uuid references public.departments(id) on delete set null,
  unique (user_id, role, department_id)
);

create index departments_hospital_idx on public.departments(hospital_id);
create index staff_department_idx on public.staff(department_id);
create index staff_user_idx on public.staff(user_id);
create index rosters_department_month_idx on public.rosters(department_id, year, month);
create index roster_entries_roster_idx on public.roster_entries(roster_id);
create index roster_entries_staff_date_idx on public.roster_entries(staff_id, shift_date);
create index leave_requests_staff_idx on public.leave_requests(staff_id);
create index shift_swaps_requester_idx on public.shift_swaps(requester_id);
create index user_roles_user_idx on public.user_roles(user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_roster_entries_updated_at
before update on public.roster_entries
for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.roster_entries;
