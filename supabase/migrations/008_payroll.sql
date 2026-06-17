alter table public.allowance_rates
  add column if not exists description text,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now();

create table if not exists public.payroll_summaries (
  id                  uuid primary key default gen_random_uuid(),
  staff_id            uuid references public.staff(id) on delete cascade,
  month               integer not null,
  year                integer not null,
  morning_shifts      integer default 0,
  afternoon_shifts    integer default 0,
  night_shifts        integer default 0,
  weekend_shifts      integer default 0,
  holiday_shifts      integer default 0,
  on_call_shifts      integer default 0,
  total_shifts        integer default 0,
  leave_days          integer default 0,
  absent_days         integer default 0,
  night_allowance     numeric(10,2) default 0,
  weekend_allowance   numeric(10,2) default 0,
  holiday_allowance   numeric(10,2) default 0,
  on_call_allowance   numeric(10,2) default 0,
  total_allowance     numeric(10,2) default 0,
  generated_at        timestamptz default now(),
  unique(staff_id, month, year)
);

create index if not exists allowance_rates_hospital_idx on public.allowance_rates(hospital_id);
create index if not exists payroll_summaries_staff_month_idx on public.payroll_summaries(staff_id, year, month);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'allowance_rates_hospital_id_shift_code_effective_from_key'
  ) then
    alter table public.allowance_rates
      add constraint allowance_rates_hospital_id_shift_code_effective_from_key
      unique (hospital_id, shift_code, effective_from);
  end if;
end $$;

alter table public.allowance_rates enable row level security;
alter table public.payroll_summaries enable row level security;

drop policy if exists "HR and admin read allowance rates" on public.allowance_rates;
create policy "HR and admin read allowance rates"
  on public.allowance_rates for select to authenticated
  using (exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'hr_officer', 'medical_director')
  ));

drop policy if exists "Admin manage allowance rates" on public.allowance_rates;
create policy "Admin manage allowance rates"
  on public.allowance_rates for all to authenticated
  using (exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  ))
  with check (exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  ));

drop policy if exists "Staff read own payroll summary" on public.payroll_summaries;
create policy "Staff read own payroll summary"
  on public.payroll_summaries for select to authenticated
  using (
    staff_id in (select id from public.staff where user_id = auth.uid())
    or exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role in ('admin', 'hr_officer', 'department_head', 'medical_director')
    )
  );

insert into public.allowance_rates (hospital_id, shift_code, rate_ghs, description, effective_from)
select h.id, r.shift_code, r.rate_ghs, r.description, '2026-01-01'
from public.hospitals h
cross join (values
  ('N', 50.00, 'Night shift allowance'),
  ('H', 80.00, 'Public holiday shift allowance'),
  ('ON_CALL', 40.00, 'On-call duty allowance'),
  ('weekend', 30.00, 'Weekend shift allowance')
) as r(shift_code, rate_ghs, description)
on conflict do nothing;
