-- Seed MedRota team users: 2 HR, 2 HOD (OPD + Emergency), 2 staff (OPD + Maternity)
-- Password for each account = their staff_number (must change on first login)
-- Safe to re-run: upserts on staff_number and auth email

create extension if not exists pgcrypto;

-- Fixed auth user IDs
-- HR
--   spaatlov@gmail.com              -> a1000001-0001-4001-8001-000000000001 / HR001
--   ahorsodedelali@gmail.com        -> a1000002-0001-4001-8001-000000000002 / HR002
-- HOD
--   lazatrain@gmail.com             -> a1000003-0001-4001-8001-000000000003 / HOD001 (OPD)
--   benjamindelali23@gmail.com      -> a1000004-0001-4001-8001-000000000004 / HOD002 (Emergency)
-- Staff
--   acheampongvida286@gmail.com    -> a1000005-0001-4001-8001-000000000005 / STF001 (OPD)
--   ahorsode@gmail.com              -> a1000006-0001-4001-8001-000000000006 / STF002 (Maternity)

create or replace function app_private.seed_team_auth_user(
  p_user_id uuid,
  p_email text,
  p_password text,
  p_full_name text
) returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    p_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_full_name, 'provisioned_by', 'seed_team_users'),
    false,
    '',
    '',
    '',
    ''
  )
  on conflict (id) do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
    updated_at = now(),
    raw_user_meta_data = excluded.raw_user_meta_data;

  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    p_user_id::text,
    p_user_id,
    jsonb_build_object(
      'sub', p_user_id::text,
      'email', p_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do update set
    identity_data = excluded.identity_data,
    updated_at = now();
end;
$$;

select app_private.seed_team_auth_user(
  'a1000001-0001-4001-8001-000000000001'::uuid,
  'spaatlov@gmail.com',
  'HR001',
  'Lov Spaat'
);
select app_private.seed_team_auth_user(
  'a1000002-0001-4001-8001-000000000002'::uuid,
  'ahorsodedelali@gmail.com',
  'HR002',
  'Delali Ahorsode'
);
select app_private.seed_team_auth_user(
  'a1000003-0001-4001-8001-000000000003'::uuid,
  'lazatrain@gmail.com',
  'HOD001',
  'Lazarus A. Train'
);
select app_private.seed_team_auth_user(
  'a1000004-0001-4001-8001-000000000004'::uuid,
  'benjamindelali23@gmail.com',
  'HOD002',
  'Benjamin Delali'
);
select app_private.seed_team_auth_user(
  'a1000005-0001-4001-8001-000000000005'::uuid,
  'acheampongvida286@gmail.com',
  'STF001',
  'Vida Acheampong'
);
select app_private.seed_team_auth_user(
  'a1000006-0001-4001-8001-000000000006'::uuid,
  'ahorsode@gmail.com',
  'STF002',
  'Delali Ahorsode'
);

insert into public.staff (
  id,
  hospital_id,
  department_id,
  user_id,
  staff_number,
  full_name,
  rank,
  position,
  employment_type,
  phone,
  email,
  must_change_password,
  allow_staff_id_login,
  has_logged_in,
  login_identifier_type,
  invited_at
)
values
  (
    'c1000001-0001-4001-8001-000000000001',
    '11111111-1111-4111-8111-111111111111',
    coalesce(
      (select id from public.departments where name = 'Nursing Administration' limit 1),
      (select id from public.departments where name = 'Health Records / Information Department' limit 1)
    ),
    'a1000001-0001-4001-8001-000000000001',
    'HR001',
    'Lov Spaat',
    'Admin Officer',
    'HR Officer',
    'Full-time',
    '+233241112001',
    'spaatlov@gmail.com',
    true,
    true,
    false,
    'email',
    now()
  ),
  (
    'c1000002-0001-4001-8001-000000000002',
    '11111111-1111-4111-8111-111111111111',
    coalesce(
      (select id from public.departments where name = 'Nursing Administration' limit 1),
      (select id from public.departments where name = 'Health Records / Information Department' limit 1)
    ),
    'a1000002-0001-4001-8001-000000000002',
    'HR002',
    'Delali Ahorsode',
    'Admin Officer',
    'HR Officer',
    'Full-time',
    '+233241112002',
    'ahorsodedelali@gmail.com',
    true,
    true,
    false,
    'email',
    now()
  ),
  (
    'c1000003-0001-4001-8001-000000000003',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222202',
    'a1000003-0001-4001-8001-000000000003',
    'HOD001',
    'Lazarus A. Train',
    'SNO',
    'Head of OPD',
    'Full-time',
    '+233241112003',
    'lazatrain@gmail.com',
    true,
    true,
    false,
    'email',
    now()
  ),
  (
    'c1000004-0001-4001-8001-000000000004',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222207',
    'a1000004-0001-4001-8001-000000000004',
    'HOD002',
    'Benjamin Delali',
    'SNO',
    'Head of Emergency',
    'Full-time',
    '+233241112004',
    'benjamindelali23@gmail.com',
    true,
    true,
    false,
    'email',
    now()
  ),
  (
    'c1000005-0001-4001-8001-000000000005',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222202',
    'a1000005-0001-4001-8001-000000000005',
    'STF001',
    'Vida Acheampong',
    'NO',
    'Nursing Officer',
    'Full-time',
    '+233241112005',
    'acheampongvida286@gmail.com',
    true,
    true,
    false,
    'email',
    now()
  ),
  (
    'c1000006-0001-4001-8001-000000000006',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222206',
    'a1000006-0001-4001-8001-000000000006',
    'STF002',
    'Delali Ahorsode',
    'NO',
    'Nursing Officer',
    'Full-time',
    '+233241112006',
    'ahorsode@gmail.com',
    true,
    true,
    false,
    'email',
    now()
  )
on conflict (staff_number) do update set
  full_name = excluded.full_name,
  department_id = excluded.department_id,
  user_id = excluded.user_id,
  rank = excluded.rank,
  position = excluded.position,
  employment_type = excluded.employment_type,
  phone = excluded.phone,
  email = excluded.email,
  must_change_password = excluded.must_change_password,
  allow_staff_id_login = excluded.allow_staff_id_login,
  login_identifier_type = excluded.login_identifier_type,
  invited_at = coalesce(public.staff.invited_at, excluded.invited_at);

insert into public.user_roles (user_id, role, department_id)
values
  (
    'a1000001-0001-4001-8001-000000000001',
    'hr_officer',
    coalesce(
      (select id from public.departments where name = 'Nursing Administration' limit 1),
      (select id from public.departments where name = 'Health Records / Information Department' limit 1)
    )
  ),
  (
    'a1000002-0001-4001-8001-000000000002',
    'hr_officer',
    coalesce(
      (select id from public.departments where name = 'Nursing Administration' limit 1),
      (select id from public.departments where name = 'Health Records / Information Department' limit 1)
    )
  ),
  (
    'a1000003-0001-4001-8001-000000000003',
    'department_head',
    '22222222-2222-4222-8222-222222222202'
  ),
  (
    'a1000004-0001-4001-8001-000000000004',
    'department_head',
    '22222222-2222-4222-8222-222222222207'
  ),
  (
    'a1000005-0001-4001-8001-000000000005',
    'staff',
    '22222222-2222-4222-8222-222222222202'
  ),
  (
    'a1000006-0001-4001-8001-000000000006',
    'staff',
    '22222222-2222-4222-8222-222222222206'
  )
on conflict (user_id, role, department_id) do nothing;

drop function if exists app_private.seed_team_auth_user(uuid, text, text, text);
