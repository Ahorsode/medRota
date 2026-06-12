create schema if not exists app_private;

create or replace function app_private.has_role(required_role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = required_role
  );
$$;

create or replace function app_private.has_any_role(required_roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = any(required_roles)
  );
$$;

create or replace function app_private.can_manage_department(target_department uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select app_private.has_any_role(array['admin', 'medical_director', 'hr_officer'])
    or exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role = 'department_head'
        and department_id = target_department
    );
$$;

create or replace function app_private.is_own_staff(target_staff uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.staff
    where id = target_staff
      and user_id = auth.uid()
  );
$$;

alter table public.hospitals enable row level security;
alter table public.departments enable row level security;
alter table public.shift_configurations enable row level security;
alter table public.staff enable row level security;
alter table public.rosters enable row level security;
alter table public.roster_entries enable row level security;
alter table public.leave_requests enable row level security;
alter table public.shift_swaps enable row level security;
alter table public.user_roles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

create policy "Authenticated users read hospitals"
on public.hospitals for select
to authenticated
using (true);

create policy "Admins manage hospitals"
on public.hospitals for all
to authenticated
using (app_private.has_role('admin'))
with check (app_private.has_role('admin'));

create policy "Authenticated users read departments"
on public.departments for select
to authenticated
using (true);

create policy "Admins and HR manage departments"
on public.departments for all
to authenticated
using (app_private.has_any_role(array['admin', 'medical_director', 'hr_officer']))
with check (app_private.has_any_role(array['admin', 'medical_director', 'hr_officer']));

create policy "Authenticated users read shift configurations"
on public.shift_configurations for select
to authenticated
using (true);

create policy "Department managers edit shift configurations"
on public.shift_configurations for all
to authenticated
using (app_private.can_manage_department(department_id))
with check (app_private.can_manage_department(department_id));

create policy "Staff read self and department managers read teams"
on public.staff for select
to authenticated
using (
  user_id = auth.uid()
  or app_private.can_manage_department(department_id)
);

create policy "Department managers write staff"
on public.staff for all
to authenticated
using (app_private.can_manage_department(department_id))
with check (app_private.can_manage_department(department_id));

create policy "Published rosters readable by authenticated users"
on public.rosters for select
to authenticated
using (
  status = 'published'
  or app_private.can_manage_department(department_id)
);

create policy "Department managers write rosters"
on public.rosters for all
to authenticated
using (app_private.can_manage_department(department_id))
with check (app_private.can_manage_department(department_id));

create policy "Staff read own roster entries"
on public.roster_entries for select
to authenticated
using (
  app_private.is_own_staff(staff_id)
  or exists (
    select 1
    from public.rosters r
    where r.id = roster_id
      and (r.status = 'published' or app_private.can_manage_department(r.department_id))
  )
);

create policy "Department managers write roster entries"
on public.roster_entries for all
to authenticated
using (
  exists (
    select 1 from public.rosters r
    where r.id = roster_id
      and app_private.can_manage_department(r.department_id)
  )
)
with check (
  exists (
    select 1 from public.rosters r
    where r.id = roster_id
      and app_private.can_manage_department(r.department_id)
  )
);

create policy "Staff read own leave requests"
on public.leave_requests for select
to authenticated
using (
  app_private.is_own_staff(staff_id)
  or exists (
    select 1
    from public.staff s
    where s.id = staff_id
      and app_private.can_manage_department(s.department_id)
  )
);

create policy "Staff create own leave requests"
on public.leave_requests for insert
to authenticated
with check (app_private.is_own_staff(staff_id));

create policy "Department managers review leave requests"
on public.leave_requests for update
to authenticated
using (
  exists (
    select 1
    from public.staff s
    where s.id = staff_id
      and app_private.can_manage_department(s.department_id)
  )
)
with check (
  exists (
    select 1
    from public.staff s
    where s.id = staff_id
      and app_private.can_manage_department(s.department_id)
  )
);

create policy "Swap participants and managers read swaps"
on public.shift_swaps for select
to authenticated
using (
  app_private.is_own_staff(requester_id)
  or app_private.is_own_staff(replacement_id)
  or exists (
    select 1
    from public.staff s
    where s.id in (requester_id, replacement_id)
      and app_private.can_manage_department(s.department_id)
  )
);

create policy "Staff request swaps"
on public.shift_swaps for insert
to authenticated
with check (app_private.is_own_staff(requester_id));

create policy "Department managers review swaps"
on public.shift_swaps for update
to authenticated
using (
  exists (
    select 1
    from public.staff s
    where s.id in (requester_id, replacement_id)
      and app_private.can_manage_department(s.department_id)
  )
)
with check (
  exists (
    select 1
    from public.staff s
    where s.id in (requester_id, replacement_id)
      and app_private.can_manage_department(s.department_id)
  )
);

create policy "Users read own roles and admins read all roles"
on public.user_roles for select
to authenticated
using (user_id = auth.uid() or app_private.has_role('admin'));

create policy "Admins manage roles"
on public.user_roles for all
to authenticated
using (app_private.has_role('admin'))
with check (app_private.has_role('admin'));

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Authenticated users can read document metadata"
on storage.objects for select
to authenticated
using (bucket_id = 'documents');

create policy "Managers can upload roster documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'documents'
  and app_private.has_any_role(array['admin', 'medical_director', 'hr_officer', 'department_head'])
);
