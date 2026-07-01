-- HR-controlled staff number as temporary password + first-login lock
alter table public.staff
  add column if not exists allow_staff_id_login boolean not null default true,
  add column if not exists has_logged_in boolean not null default false,
  add column if not exists first_login_at timestamptz;

create index if not exists staff_allow_staff_id_login_idx
  on public.staff(allow_staff_id_login);

create index if not exists staff_has_logged_in_idx
  on public.staff(has_logged_in);
