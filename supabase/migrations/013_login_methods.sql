-- Track the contact method used for HR-issued login (email or phone)
alter table public.staff
  add column if not exists login_identifier_type text default 'email'
    check (login_identifier_type in ('email', 'phone')),
  add column if not exists access_requests_email text;

-- Table to log "Request Access" attempts from unregistered Google sign-ins
create table if not exists public.access_requests (
  id              uuid primary key default gen_random_uuid(),
  attempted_email text not null,
  google_name     text,
  status          text default 'pending'
    check (status in ('pending', 'resolved', 'dismissed')),
  resolved_by     uuid,
  resolved_at     timestamptz,
  created_at      timestamptz default now()
);

create index access_requests_status_idx on public.access_requests(status);

alter table public.access_requests enable row level security;

create policy "Admins and HR read access requests"
  on public.access_requests for select to authenticated
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'hr_officer')
  ));

create policy "Admins and HR manage access requests"
  on public.access_requests for update to authenticated
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'hr_officer')
  ));

-- Realtime so HR sees new access requests live
alter publication supabase_realtime add table public.access_requests;
