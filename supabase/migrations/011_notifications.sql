create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid references public.staff(id) on delete cascade,
  title        text not null,
  body         text,
  type         text default 'info'
    check (type in ('info','success','warning','error','leave','roster','swap','message')),
  is_read      boolean default false,
  read_at      timestamptz,
  link         text,
  created_at   timestamptz default now()
);

create index if not exists notifications_staff_unread_idx on public.notifications(staff_id, is_read);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Staff read own notifications" on public.notifications;
create policy "Staff read own notifications"
  on public.notifications for select to authenticated
  using (staff_id in (select id from public.staff where user_id = auth.uid()));

drop policy if exists "Staff mark own notifications read" on public.notifications;
create policy "Staff mark own notifications read"
  on public.notifications for update to authenticated
  using (staff_id in (select id from public.staff where user_id = auth.uid()))
  with check (staff_id in (select id from public.staff where user_id = auth.uid()));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
