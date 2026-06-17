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
