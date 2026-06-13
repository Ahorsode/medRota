insert into public.hospitals (id, name, location)
values ('11111111-1111-4111-8111-111111111111', 'SDA Hospital, Koforidua', 'Koforidua, Eastern Region, Ghana')
on conflict (id) do nothing;

insert into public.departments (id, hospital_id, name, description)
values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111111', 'Health Records / Information Department', 'Patient records and information management'),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111111', 'OPD', 'Outpatient Department duty coverage'),
  ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111111', 'Prescribers', 'Doctors and prescriber roster'),
  ('22222222-2222-4222-8222-222222222204', '11111111-1111-4111-8111-111111111111', 'Security', 'Hospital gate and ward patrol coverage'),
  ('22222222-2222-4222-8222-222222222205', '11111111-1111-4111-8111-111111111111', 'ICU', 'Intensive care nursing'),
  ('22222222-2222-4222-8222-222222222206', '11111111-1111-4111-8111-111111111111', 'Maternity', 'Maternity and neonatal coverage'),
  ('22222222-2222-4222-8222-222222222207', '11111111-1111-4111-8111-111111111111', 'Emergency', 'Emergency unit'),
  ('22222222-2222-4222-8222-222222222208', '11111111-1111-4111-8111-111111111111', 'Pharmacy', 'Dispensing and inventory operations'),
  ('22222222-2222-4222-8222-222222222209', '11111111-1111-4111-8111-111111111111', 'Lab', 'Diagnostics and laboratory services')
on conflict (id) do nothing;

insert into public.shift_configurations (department_id, shift_code, shift_name, start_time, end_time, color_class)
select public.departments.id, code, shift_name, start_time::time, end_time::time, color_class
from public.departments
cross join (
  values
    ('M', 'Morning', '07:30', '14:00', 'bg-blue-100 text-blue-700 border-blue-200'),
    ('A', 'Afternoon', '14:00', '20:00', 'bg-amber-100 text-amber-700 border-amber-200'),
    ('N', 'Night', '20:00', '08:00', 'bg-indigo-100 text-indigo-700 border-indigo-200'),
    ('O', 'Off Day', null, null, 'bg-slate-100 text-slate-500 border-slate-200'),
    ('H', 'Holiday', null, null, 'bg-orange-100 text-orange-700 border-orange-200')
) as shifts(code, shift_name, start_time, end_time, color_class)
where public.departments.name <> 'Security';

insert into public.shift_configurations (department_id, shift_code, shift_name, start_time, end_time, color_class)
select public.departments.id, code, shift_name, start_time::time, end_time::time, color_class
from public.departments
cross join (
  values
    ('M', 'Day Security', '07:00', '18:30', 'bg-blue-100 text-blue-700 border-blue-200'),
    ('N', 'Night Security', '18:30', '07:00', 'bg-indigo-100 text-indigo-700 border-indigo-200'),
    ('%', 'Off Day', null, null, 'bg-slate-100 text-slate-400 border-slate-200'),
    ('H', 'Holiday', null, null, 'bg-orange-100 text-orange-700 border-orange-200')
) as shifts(code, shift_name, start_time, end_time, color_class)
where public.departments.name = 'Security';

insert into public.staff (hospital_id, department_id, staff_number, full_name, rank, position, employment_type, phone, email)
values
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222202', 'S001', 'R. Opoku', 'SNO', 'Senior Nursing Officer', 'Full-time', '+233 24 000 0001', 'r.opoku@sdahospital.example'),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222202', 'S002', 'A. Amo-Nuadu', 'NO', 'Nursing Officer', 'Full-time', '+233 24 000 0002', 'a.amo-nuadu@sdahospital.example'),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222202', 'S003', 'R. Agyekey', 'NO', 'Nursing Officer', 'Full-time', '+233 24 000 0003', 'r.agyekey@sdahospital.example'),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222202', 'S004', 'Sandra S.', 'SEN', 'Senior Enrolled Nurse', 'Full-time', '+233 24 000 0004', 'sandra.s@sdahospital.example'),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222203', 'S007', 'Dr. K. Mensah', 'MO', 'Medical Officer', 'Full-time', '+233 24 000 0007', 'k.mensah@sdahospital.example'),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222204', 'S010', 'Isaac Baah', 'SO', 'Security Officer', 'Full-time', '+233 24 000 0010', 'isaac.baah@sdahospital.example')
on conflict (staff_number) do nothing;

insert into public.rosters (department_id, month, year, status)
select id, 6, 2026,
  case name
    when 'Health Records / Information Department' then 'published'
    when 'OPD' then 'draft'
    when 'Prescribers' then 'submitted'
    else 'approved'
  end
from public.departments
where name in ('Health Records / Information Department', 'OPD', 'Prescribers', 'Security', 'ICU', 'Maternity')
on conflict (department_id, month, year) do nothing;
