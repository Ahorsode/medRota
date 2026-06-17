alter table public.staff
  add column if not exists must_change_password boolean not null default true,
  add column if not exists invited_at timestamptz,
  add column if not exists password_changed_at timestamptz;

create index if not exists staff_must_change_password_idx
  on public.staff(must_change_password) where must_change_password = true;

alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('admin', 'medical_director', 'department_head', 'doctor', 'nurse', 'hr_officer', 'staff'));
