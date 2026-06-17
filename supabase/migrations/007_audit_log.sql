create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  staff_id    uuid references public.staff(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  old_value   jsonb,
  new_value   jsonb,
  ip_address  text,
  created_at  timestamptz default now()
);

create index if not exists audit_log_user_idx on public.audit_log(user_id);
create index if not exists audit_log_entity_idx on public.audit_log(entity_type, entity_id);
create index if not exists audit_log_created_at_idx on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins read audit log"
  on public.audit_log for select to authenticated
  using (
    exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role in ('admin', 'hr_officer', 'medical_director')
    )
  );
