create table if not exists public.locum_shifts (
  id              uuid primary key default gen_random_uuid(),
  department_id   uuid references public.departments(id) on delete cascade,
  shift_date      date not null,
  shift_code      text not null,
  requirements    text,
  status          text default 'open'
    check (status in ('open', 'filled', 'cancelled')),
  filled_by       uuid references public.staff(id) on delete set null,
  posted_by       uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now()
);

create index if not exists locum_shifts_dept_date_idx on public.locum_shifts(department_id, shift_date);
create index if not exists locum_shifts_status_idx on public.locum_shifts(status);

alter table public.locum_shifts enable row level security;

drop policy if exists "Auth users read open locum shifts" on public.locum_shifts;
create policy "Auth users read open locum shifts"
  on public.locum_shifts for select to authenticated
  using (
    status = 'open'
    or posted_by = auth.uid()
    or filled_by in (select id from public.staff where user_id = auth.uid())
    or exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role in ('admin', 'hr_officer', 'department_head', 'medical_director')
    )
  );

drop policy if exists "HOD and admin post locum shifts" on public.locum_shifts;
create policy "HOD and admin post locum shifts"
  on public.locum_shifts for insert to authenticated
  with check (exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'hr_officer', 'department_head', 'medical_director')
  ));

drop policy if exists "HOD and admin manage locum shifts" on public.locum_shifts;
create policy "HOD and admin manage locum shifts"
  on public.locum_shifts for update to authenticated
  using (
    exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role in ('admin', 'hr_officer', 'department_head', 'medical_director')
    )
    or filled_by in (select id from public.staff where user_id = auth.uid())
  )
  with check (
    exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role in ('admin', 'hr_officer', 'department_head', 'medical_director')
    )
    or filled_by in (select id from public.staff where user_id = auth.uid())
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'locum_shifts'
  ) then
    alter publication supabase_realtime add table public.locum_shifts;
  end if;
end $$;
