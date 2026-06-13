update public.departments
set department_type = 'department'
where name in (
  'Health Records / Information Department',
  'OPD',
  'Prescribers',
  'Security',
  'ICU',
  'Maternity',
  'Emergency',
  'Pharmacy',
  'Lab'
);

insert into public.departments (hospital_id, name, description, department_type, parent_id)
select
  '11111111-1111-4111-8111-111111111111',
  unit_name,
  unit_desc,
  unit_type,
  (select id from public.departments where name = parent_name limit 1)
from (values
  ('A&E Triage Unit', 'Initial patient triage and assessment', 'unit', 'Emergency'),
  ('Resuscitation Bay', '24/7 critical resuscitation bay', 'unit', 'Emergency'),
  ('Antenatal Clinic', 'Routine antenatal checkups', 'special_clinic', 'Maternity'),
  ('Postnatal Ward', 'Post-delivery monitoring', 'unit', 'Maternity'),
  ('Labour Ward', 'Active labour and delivery unit', 'unit', 'Maternity'),
  ('Microbiology & Parasitology', 'Microbiology and parasite diagnostics', 'unit', 'Lab'),
  ('Chemical Pathology', 'Biochemistry and chemical pathology tests', 'unit', 'Lab'),
  ('Haematology & Blood Bank', 'Blood typing, banking, and haematology', 'unit', 'Lab'),
  ('Emergency Pharmacy', 'A&E satellite dispensing', 'unit', 'Pharmacy'),
  ('Inpatient Dispensary', 'Ward-level medication dispensing', 'unit', 'Pharmacy'),
  ('Medical Records', 'Patient file and records management', 'department', null),
  ('Nursing Administration', 'Nursing management and coordination', 'department', null),
  ('Physiotherapy', 'Physiotherapy and occupational therapy services', 'department', null),
  ('Radiology & Imaging', 'X-Ray, Ultrasound, and CT scanning', 'department', null),
  ('Surgery', 'General and specialist surgical services', 'department', null),
  ('Paediatrics (Child Health)', 'Paediatric wards and child health clinics', 'department', null),
  ('NICU', 'Neonatal Intensive Care Unit', 'unit', 'Paediatrics (Child Health)'),
  ('PICU', 'Paediatric Intensive Care Unit', 'unit', 'Paediatrics (Child Health)'),
  ('Nutrition & Dietetics', 'Clinical nutrition services', 'department', null),
  ('Social Welfare', 'Patient social support services', 'department', null),
  ('Dental & Oral Health', 'Dental clinic and oral surgery', 'department', null)
) as t(unit_name, unit_desc, unit_type, parent_name)
where not exists (
  select 1
  from public.departments existing
  where existing.name = unit_name
);

insert into public.shift_configurations
  (department_id, shift_code, shift_name, start_time, end_time, color_class)
select
  d.id,
  'ON_CALL',
  'On Call',
  null,
  null,
  'bg-rose-100 text-rose-700 border-rose-200'
from public.departments d
where not exists (
  select 1
  from public.shift_configurations sc
  where sc.department_id = d.id
    and sc.shift_code = 'ON_CALL'
);
