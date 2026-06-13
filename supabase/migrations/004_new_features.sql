alter table public.departments
  add column if not exists department_type text default 'department'
    check (department_type in ('department', 'unit', 'special_clinic', 'autonomous_centre')),
  add column if not exists parent_id uuid references public.departments(id) on delete set null;

alter table public.shift_configurations
  drop constraint if exists shift_configurations_shift_code_check;
alter table public.shift_configurations
  add constraint shift_configurations_shift_code_check
  check (shift_code in ('M', 'A', 'N', 'O', 'H', '%', 'ON_CALL'));

alter table public.roster_entries
  drop constraint if exists roster_entries_shift_code_check;
alter table public.roster_entries
  add constraint roster_entries_shift_code_check
  check (shift_code in ('M', 'A', 'N', 'O', 'H', '%', 'LEAVE', 'ON_CALL'));

create table if not exists public.attendance_records (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references public.staff(id) on delete cascade,
  shift_date  date not null,
  clock_in    timestamptz,
  clock_out   timestamptz,
  status      text default 'present'
    check (status in ('present', 'absent', 'late', 'early_departure')),
  notes       text,
  created_at  timestamptz default now(),
  unique (staff_id, shift_date)
);

create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid references public.staff(id) on delete cascade,
  subject       text,
  body          text not null,
  message_type  text default 'direct'
    check (message_type in ('direct', 'broadcast', 'department')),
  department_id uuid references public.departments(id) on delete set null,
  created_at    timestamptz default now()
);

create table if not exists public.message_recipients (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid references public.messages(id) on delete cascade,
  staff_id    uuid references public.staff(id) on delete cascade,
  is_read     boolean default false,
  read_at     timestamptz,
  unique (message_id, staff_id)
);

create table if not exists public.handover_reports (
  id               uuid primary key default gen_random_uuid(),
  department_id    uuid references public.departments(id) on delete cascade,
  shift_date       date not null,
  shift_code       text not null,
  from_staff_id    uuid references public.staff(id),
  to_staff_id      uuid references public.staff(id),
  report_body      text not null,
  patients_count   integer,
  critical_notes   text,
  is_acknowledged  boolean default false,
  acknowledged_at  timestamptz,
  created_at       timestamptz default now()
);

create table if not exists public.staff_assessments (
  id                    uuid primary key default gen_random_uuid(),
  staff_id              uuid references public.staff(id) on delete cascade,
  assessed_by           uuid references auth.users(id) on delete set null,
  assessment_date       date not null,
  period                text not null,
  competency_score      integer check (competency_score between 1 and 5),
  efficiency_score      integer check (efficiency_score between 1 and 5),
  professionalism_score integer check (professionalism_score between 1 and 5),
  ethical_score         integer check (ethical_score between 1 and 5),
  overall_score         numeric(3,2),
  comments              text,
  created_at            timestamptz default now()
);

create table if not exists public.training_records (
  id              uuid primary key default gen_random_uuid(),
  staff_id        uuid references public.staff(id) on delete cascade,
  training_title  text not null,
  training_type   text not null check (training_type in ('given', 'attended')),
  provider        text,
  start_date      date not null,
  end_date        date not null,
  certificate_url text,
  notes           text,
  created_at      timestamptz default now()
);

create table if not exists public.login_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  staff_id         uuid references public.staff(id) on delete set null,
  login_at         timestamptz default now(),
  logout_at        timestamptz,
  duration_minutes integer,
  ip_address       text,
  device           text
);

create index if not exists attendance_staff_date_idx on public.attendance_records(staff_id, shift_date);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists messages_department_idx on public.messages(department_id);
create index if not exists message_recipients_staff_idx on public.message_recipients(staff_id);
create index if not exists handover_department_date_idx on public.handover_reports(department_id, shift_date);
create index if not exists staff_assessments_staff_idx on public.staff_assessments(staff_id);
create index if not exists training_records_staff_idx on public.training_records(staff_id);
create index if not exists login_sessions_user_idx on public.login_sessions(user_id);

alter table public.attendance_records enable row level security;
alter table public.messages enable row level security;
alter table public.message_recipients enable row level security;
alter table public.handover_reports enable row level security;
alter table public.staff_assessments enable row level security;
alter table public.training_records enable row level security;
alter table public.login_sessions enable row level security;

create policy "Staff view own attendance, managers view department"
  on public.attendance_records for select to authenticated
  using (app_private.is_own_staff(staff_id) or app_private.can_manage_department(
    (select department_id from public.staff where id = staff_id)
  ));

create policy "Managers write attendance"
  on public.attendance_records for all to authenticated
  using (app_private.can_manage_department(
    (select department_id from public.staff where id = staff_id)
  ))
  with check (app_private.can_manage_department(
    (select department_id from public.staff where id = staff_id)
  ));

create policy "Staff see messages they sent or received"
  on public.messages for select to authenticated
  using (app_private.is_own_staff(sender_id) or
    exists (select 1 from public.message_recipients mr
      join public.staff s on s.id = mr.staff_id
      where mr.message_id = id and s.user_id = auth.uid()));

create policy "Staff send messages"
  on public.messages for insert to authenticated
  with check (app_private.is_own_staff(sender_id));

create policy "Recipients read their message records"
  on public.message_recipients for select to authenticated
  using (app_private.is_own_staff(staff_id));

create policy "Recipients mark as read"
  on public.message_recipients for update to authenticated
  using (app_private.is_own_staff(staff_id))
  with check (app_private.is_own_staff(staff_id));

create policy "Dept members view handover reports"
  on public.handover_reports for select to authenticated
  using (app_private.can_manage_department(department_id) or
    app_private.is_own_staff(from_staff_id) or app_private.is_own_staff(to_staff_id));

create policy "Staff write handover reports"
  on public.handover_reports for insert to authenticated
  with check (app_private.is_own_staff(from_staff_id));

create policy "Receiving staff acknowledges handover"
  on public.handover_reports for update to authenticated
  using (app_private.is_own_staff(to_staff_id) or app_private.can_manage_department(department_id))
  with check (app_private.is_own_staff(to_staff_id) or app_private.can_manage_department(department_id));

create policy "Staff view own assessments, managers view dept"
  on public.staff_assessments for select to authenticated
  using (app_private.is_own_staff(staff_id) or app_private.can_manage_department(
    (select department_id from public.staff where id = staff_id)
  ));

create policy "Managers write assessments"
  on public.staff_assessments for all to authenticated
  using (app_private.has_any_role(array['admin', 'medical_director', 'department_head', 'hr_officer']))
  with check (app_private.has_any_role(array['admin', 'medical_director', 'department_head', 'hr_officer']));

create policy "Staff view own training, managers view dept"
  on public.training_records for select to authenticated
  using (app_private.is_own_staff(staff_id) or app_private.can_manage_department(
    (select department_id from public.staff where id = staff_id)
  ));

create policy "Managers write training records"
  on public.training_records for all to authenticated
  using (app_private.can_manage_department(
    (select department_id from public.staff where id = staff_id)
  ))
  with check (app_private.can_manage_department(
    (select department_id from public.staff where id = staff_id)
  ));

create policy "Users see own login sessions"
  on public.login_sessions for select to authenticated
  using (user_id = auth.uid() or app_private.has_role('admin'));

create policy "Users create own login sessions"
  on public.login_sessions for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users update own login sessions"
  on public.login_sessions for update to authenticated
  using (user_id = auth.uid() or app_private.has_role('admin'))
  with check (user_id = auth.uid() or app_private.has_role('admin'));

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_recipients;
alter publication supabase_realtime add table public.handover_reports;
