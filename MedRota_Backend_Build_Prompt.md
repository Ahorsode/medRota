# MedRota — Backend, Database & New Features Build Prompt
### Phase 2: Supabase + Prisma Integration & Feature Expansion

---

## CONTEXT

You are continuing work on **MedRota**, a hospital shift scheduling system for SDA Hospital, Koforidua, Ghana. The frontend is built and working with mock data. Your job in this phase is to:

1. Replace all mock data with real **Supabase + Prisma** database calls
2. Extend the database schema with **new tables** for the additional features described below
3. Wire every hook, page, and server action to real data
4. Fix the **missing root middleware** (critical auth bug)
5. Build **new feature modules** based on your team's research document

The `.env` file already has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set. Do not hardcode these values anywhere.

---

## TECH STACK (do not change)

- **Next.js 14** — App Router, Server Components, Server Actions
- **Supabase** — PostgreSQL database, Auth, Realtime, Storage
- **Prisma** — ORM for all database queries (use `@prisma/client`)
- **TypeScript** — strict mode, no `any`
- **Existing packages** — All packages already installed; do not add new ones unless absolutely necessary

---

## PART 1 — CRITICAL FIX FIRST (do this before anything else)

### Create `/src/middleware.ts` at the project root

Next.js only reads middleware from this exact path. The existing file at `/src/lib/supabase/middleware.ts` contains the correct `updateSession` logic but is in the wrong place. Without this fix, all routes are unprotected.

```ts
// src/middleware.ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
```

---

## PART 2 — PRISMA SETUP

### 1. Install and initialise Prisma

```bash
npm install prisma @prisma/client
npx prisma init --datasource-provider postgresql
```

### 2. Set the database URL in `.env`

```
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

Note: For Supabase with connection pooling, use:
- `DATABASE_URL` → Transaction pooler URL (port 6543) with `?pgbouncer=true`
- `DIRECT_URL` → Direct connection URL (port 5432)

Update `prisma/schema.prisma` datasource block:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 3. Create the full Prisma schema at `prisma/schema.prisma`

Map exactly to the existing Supabase tables (already created via migrations). Add all new tables described in Part 3.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Hospital {
  id          String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String
  location    String?
  created_at  DateTime     @default(now()) @db.Timestamptz(6)
  departments Department[]
  staff       Staff[]

  @@map("hospitals")
}

model Department {
  id                  String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  hospital_id         String              @db.Uuid
  name                String
  description         String?
  is_active           Boolean             @default(true)
  department_type     String              @default("department") // "department", "unit", "special_clinic"
  parent_id           String?             @db.Uuid
  created_at          DateTime            @default(now()) @db.Timestamptz(6)
  hospital            Hospital            @relation(fields: [hospital_id], references: [id], onDelete: Cascade)
  parent              Department?         @relation("DepartmentHierarchy", fields: [parent_id], references: [id])
  children            Department[]        @relation("DepartmentHierarchy")
  shift_configurations ShiftConfiguration[]
  staff               Staff[]
  rosters             Roster[]
  user_roles          UserRole[]

  @@map("departments")
}

model ShiftConfiguration {
  id            String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  department_id String         @db.Uuid
  shift_code    String         // M, A, N, O, H, %, ON_CALL
  shift_name    String
  start_time    String?        @db.Time
  end_time      String?        @db.Time
  color_class   String?
  is_active     Boolean        @default(true)
  department    Department     @relation(fields: [department_id], references: [id], onDelete: Cascade)
  roster_entries RosterEntry[]

  @@map("shift_configurations")
}

model Staff {
  id                  String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  hospital_id         String         @db.Uuid
  department_id       String         @db.Uuid
  user_id             String?        @db.Uuid
  staff_number        String         @unique
  full_name           String
  rank                String?
  position            String?
  employment_type     String?        // Full-time, Part-time, Locum
  phone               String?
  email               String?
  is_active           Boolean        @default(true)
  created_at          DateTime       @default(now()) @db.Timestamptz(6)
  hospital            Hospital       @relation(fields: [hospital_id], references: [id], onDelete: Cascade)
  department          Department     @relation(fields: [department_id], references: [id], onDelete: SetNull)
  roster_entries      RosterEntry[]
  leave_requests      LeaveRequest[]
  swap_requests       ShiftSwap[]    @relation("SwapRequester")
  swap_replacements   ShiftSwap[]    @relation("SwapReplacement")
  attendance_records  AttendanceRecord[]
  messages_sent       Message[]      @relation("MessageSender")
  messages_received   MessageRecipient[]
  handover_reports_from HandoverReport[] @relation("HandoverFrom")
  handover_reports_to   HandoverReport[] @relation("HandoverTo")
  assessments         StaffAssessment[]
  training_records    TrainingRecord[]

  @@map("staff")
}

model Roster {
  id            String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  department_id String        @db.Uuid
  month         Int
  year          Int
  status        String        @default("draft") // draft, submitted, approved, published
  created_by    String?       @db.Uuid
  approved_by   String?       @db.Uuid
  created_at    DateTime      @default(now()) @db.Timestamptz(6)
  published_at  DateTime?     @db.Timestamptz(6)
  department    Department    @relation(fields: [department_id], references: [id], onDelete: Cascade)
  entries       RosterEntry[]

  @@unique([department_id, month, year])
  @@map("rosters")
}

model RosterEntry {
  id               String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  roster_id        String              @db.Uuid
  staff_id         String              @db.Uuid
  shift_date       DateTime            @db.Date
  shift_code       String              // M, A, N, O, H, %, LEAVE, ON_CALL
  shift_config_id  String?             @db.Uuid
  notes            String?
  is_leave         Boolean             @default(false)
  leave_type       String?
  created_at       DateTime            @default(now()) @db.Timestamptz(6)
  updated_at       DateTime            @default(now()) @updatedAt @db.Timestamptz(6)
  roster           Roster              @relation(fields: [roster_id], references: [id], onDelete: Cascade)
  staff            Staff               @relation(fields: [staff_id], references: [id], onDelete: Cascade)
  shift_config     ShiftConfiguration? @relation(fields: [shift_config_id], references: [id], onDelete: SetNull)
  swap_as_requester ShiftSwap[]        @relation("SwapRequesterEntry")
  swap_as_replacement ShiftSwap[]      @relation("SwapReplacementEntry")

  @@unique([roster_id, staff_id, shift_date])
  @@map("roster_entries")
}

model LeaveRequest {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  staff_id     String    @db.Uuid
  leave_type   String    // Annual, Sick, Study, Maternity, Paternity, Compassionate, Emergency
  start_date   DateTime  @db.Date
  end_date     DateTime  @db.Date
  reason       String?
  status       String    @default("pending") // pending, approved, rejected
  requested_at DateTime  @default(now()) @db.Timestamptz(6)
  reviewed_by  String?   @db.Uuid
  reviewed_at  DateTime? @db.Timestamptz(6)
  notes        String?
  staff        Staff     @relation(fields: [staff_id], references: [id], onDelete: Cascade)

  @@map("leave_requests")
}

model ShiftSwap {
  id                    String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  requester_id          String      @db.Uuid
  replacement_id        String      @db.Uuid
  requester_entry_id    String      @db.Uuid
  replacement_entry_id  String      @db.Uuid
  status                String      @default("pending") // pending, approved, rejected
  requested_at          DateTime    @default(now()) @db.Timestamptz(6)
  reviewed_by           String?     @db.Uuid
  requester             Staff       @relation("SwapRequester", fields: [requester_id], references: [id], onDelete: Cascade)
  replacement           Staff       @relation("SwapReplacement", fields: [replacement_id], references: [id], onDelete: Cascade)
  requester_entry       RosterEntry @relation("SwapRequesterEntry", fields: [requester_entry_id], references: [id], onDelete: Cascade)
  replacement_entry     RosterEntry @relation("SwapReplacementEntry", fields: [replacement_entry_id], references: [id], onDelete: Cascade)

  @@map("shift_swaps")
}

model UserRole {
  id            String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id       String     @db.Uuid
  role          String     // admin, medical_director, department_head, doctor, nurse, hr_officer
  department_id String?    @db.Uuid
  department    Department? @relation(fields: [department_id], references: [id], onDelete: SetNull)

  @@unique([user_id, role, department_id])
  @@map("user_roles")
}

// ── NEW TABLES ────────────────────────────────────────────────────────────────

model AttendanceRecord {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  staff_id    String    @db.Uuid
  shift_date  DateTime  @db.Date
  clock_in    DateTime? @db.Timestamptz(6)
  clock_out   DateTime? @db.Timestamptz(6)
  status      String    @default("present") // present, absent, late, early_departure
  notes       String?
  created_at  DateTime  @default(now()) @db.Timestamptz(6)
  staff       Staff     @relation(fields: [staff_id], references: [id], onDelete: Cascade)

  @@unique([staff_id, shift_date])
  @@map("attendance_records")
}

model Message {
  id           String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sender_id    String             @db.Uuid
  subject      String?
  body         String
  message_type String             @default("direct") // direct, broadcast, department
  department_id String?           @db.Uuid
  created_at   DateTime           @default(now()) @db.Timestamptz(6)
  sender       Staff              @relation("MessageSender", fields: [sender_id], references: [id], onDelete: Cascade)
  recipients   MessageRecipient[]

  @@map("messages")
}

model MessageRecipient {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  message_id  String   @db.Uuid
  staff_id    String   @db.Uuid
  is_read     Boolean  @default(false)
  read_at     DateTime? @db.Timestamptz(6)
  message     Message  @relation(fields: [message_id], references: [id], onDelete: Cascade)
  staff       Staff    @relation(fields: [staff_id], references: [id], onDelete: Cascade)

  @@unique([message_id, staff_id])
  @@map("message_recipients")
}

model HandoverReport {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  department_id   String   @db.Uuid
  shift_date      DateTime @db.Date
  shift_code      String   // M, A, N — which shift is being handed over FROM
  from_staff_id   String   @db.Uuid
  to_staff_id     String   @db.Uuid
  report_body     String   // Rich text / markdown content
  patients_count  Int?
  critical_notes  String?
  is_acknowledged Boolean  @default(false)
  acknowledged_at DateTime? @db.Timestamptz(6)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  from_staff      Staff    @relation("HandoverFrom", fields: [from_staff_id], references: [id])
  to_staff        Staff    @relation("HandoverTo", fields: [to_staff_id], references: [id])

  @@map("handover_reports")
}

model StaffAssessment {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  staff_id         String   @db.Uuid
  assessed_by      String   @db.Uuid
  assessment_date  DateTime @db.Date
  period           String   // e.g. "Q1 2026", "Annual 2025"
  competency_score Int?     // 1–5
  efficiency_score Int?     // 1–5
  professionalism_score Int? // 1–5
  ethical_score    Int?     // 1–5
  overall_score    Float?
  comments         String?
  created_at       DateTime @default(now()) @db.Timestamptz(6)
  staff            Staff    @relation(fields: [staff_id], references: [id], onDelete: Cascade)

  @@map("staff_assessments")
}

model TrainingRecord {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  staff_id        String   @db.Uuid
  training_title  String
  training_type   String   // given, attended
  provider        String?
  start_date      DateTime @db.Date
  end_date        DateTime @db.Date
  certificate_url String?
  notes           String?
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  staff           Staff    @relation(fields: [staff_id], references: [id], onDelete: Cascade)

  @@map("training_records")
}

model LoginSession {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id     String   @db.Uuid
  staff_id    String?  @db.Uuid
  login_at    DateTime @default(now()) @db.Timestamptz(6)
  logout_at   DateTime? @db.Timestamptz(6)
  duration_minutes Int?
  ip_address  String?
  device      String?

  @@map("login_sessions")
}
```

### 4. Run Prisma introspect (since tables already exist in Supabase)

```bash
npx prisma db pull     # pulls existing schema from Supabase
npx prisma generate    # generates the Prisma client
```

For the NEW tables not yet in Supabase, run:
```bash
npx prisma db push     # pushes only the new tables to Supabase
```

### 5. Create a singleton Prisma client at `/src/lib/prisma.ts`

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

---

## PART 3 — NEW DATABASE TABLES (Supabase SQL Migrations)

Create a new migration file `supabase/migrations/004_new_features.sql` with the following:

```sql
-- Department hierarchy: units and special clinics sit under departments
alter table public.departments
  add column if not exists department_type text default 'department'
    check (department_type in ('department', 'unit', 'special_clinic', 'autonomous_centre')),
  add column if not exists parent_id uuid references public.departments(id) on delete set null;

-- Locum / On-Call shift code support
alter table public.shift_configurations
  drop constraint if exists shift_configurations_shift_code_check;
alter table public.shift_configurations
  add constraint shift_configurations_shift_code_check
  check (shift_code in ('M', 'A', 'N', 'O', 'H', '%', 'ON_CALL'));

alter table public.roster_entries
  drop constraint if exists roster_entries_shift_code_check;
alter table public.roster_entries
  add constraint roster_entries_shift_code_check
  check (shift_code in ('M', 'A', 'N', 'O', 'H', '%', 'LEAVE', 'ON_CALL'));

-- Attendance tracking
create table if not exists public.attendance_records (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references public.staff(id) on delete cascade,
  shift_date  date not null,
  clock_in    timestamptz,
  clock_out   timestamptz,
  status      text default 'present'
    check (status in ('present', 'absent', 'late', 'early_departure')),
  notes       text,
  created_at  timestamptz default now(),
  unique (staff_id, shift_date)
);

-- Internal messaging
create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid references public.staff(id) on delete cascade,
  subject       text,
  body          text not null,
  message_type  text default 'direct'
    check (message_type in ('direct', 'broadcast', 'department')),
  department_id uuid references public.departments(id) on delete set null,
  created_at    timestamptz default now()
);

create table if not exists public.message_recipients (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid references public.messages(id) on delete cascade,
  staff_id    uuid references public.staff(id) on delete cascade,
  is_read     boolean default false,
  read_at     timestamptz,
  unique (message_id, staff_id)
);

-- Handover reports
create table if not exists public.handover_reports (
  id               uuid primary key default gen_random_uuid(),
  department_id    uuid references public.departments(id) on delete cascade,
  shift_date       date not null,
  shift_code       text not null,
  from_staff_id    uuid references public.staff(id),
  to_staff_id      uuid references public.staff(id),
  report_body      text not null,
  patients_count   integer,
  critical_notes   text,
  is_acknowledged  boolean default false,
  acknowledged_at  timestamptz,
  created_at       timestamptz default now()
);

-- Staff assessments
create table if not exists public.staff_assessments (
  id                    uuid primary key default gen_random_uuid(),
  staff_id              uuid references public.staff(id) on delete cascade,
  assessed_by           uuid references auth.users(id) on delete set null,
  assessment_date       date not null,
  period                text not null,
  competency_score      integer check (competency_score between 1 and 5),
  efficiency_score      integer check (efficiency_score between 1 and 5),
  professionalism_score integer check (professionalism_score between 1 and 5),
  ethical_score         integer check (ethical_score between 1 and 5),
  overall_score         numeric(3,2),
  comments              text,
  created_at            timestamptz default now()
);

-- Training records
create table if not exists public.training_records (
  id              uuid primary key default gen_random_uuid(),
  staff_id        uuid references public.staff(id) on delete cascade,
  training_title  text not null,
  training_type   text not null check (training_type in ('given', 'attended')),
  provider        text,
  start_date      date not null,
  end_date        date not null,
  certificate_url text,
  notes           text,
  created_at      timestamptz default now()
);

-- Login session timer
create table if not exists public.login_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  staff_id         uuid references public.staff(id) on delete set null,
  login_at         timestamptz default now(),
  logout_at        timestamptz,
  duration_minutes integer,
  ip_address       text,
  device           text
);

-- Indexes for new tables
create index if not exists attendance_staff_date_idx on public.attendance_records(staff_id, shift_date);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists message_recipients_staff_idx on public.message_recipients(staff_id);
create index if not exists handover_dept_date_idx on public.handover_reports(department_id, shift_date);
create index if not exists assessments_staff_idx on public.staff_assessments(staff_id);
create index if not exists training_staff_idx on public.training_records(staff_id);
create index if not exists login_sessions_user_idx on public.login_sessions(user_id);

-- Enable RLS on all new tables
alter table public.attendance_records enable row level security;
alter table public.messages enable row level security;
alter table public.message_recipients enable row level security;
alter table public.handover_reports enable row level security;
alter table public.staff_assessments enable row level security;
alter table public.training_records enable row level security;
alter table public.login_sessions enable row level security;

-- RLS Policies for new tables
create policy "Staff view own attendance, managers view department"
  on public.attendance_records for select to authenticated
  using (app_private.is_own_staff(staff_id) or app_private.can_manage_department(
    (select department_id from public.staff where id = staff_id)
  ));

create policy "Managers write attendance"
  on public.attendance_records for all to authenticated
  using (app_private.can_manage_department(
    (select department_id from public.staff where id = staff_id)
  ));

create policy "Staff see messages they sent or received"
  on public.messages for select to authenticated
  using (app_private.is_own_staff(sender_id) or
    exists (select 1 from public.message_recipients mr
      join public.staff s on s.id = mr.staff_id
      where mr.message_id = id and s.user_id = auth.uid()));

create policy "Staff send messages"
  on public.messages for insert to authenticated
  with check (app_private.is_own_staff(sender_id));

create policy "Recipients read their message records"
  on public.message_recipients for select to authenticated
  using (app_private.is_own_staff(staff_id));

create policy "Recipients mark as read"
  on public.message_recipients for update to authenticated
  using (app_private.is_own_staff(staff_id));

create policy "Dept members view handover reports"
  on public.handover_reports for select to authenticated
  using (app_private.can_manage_department(department_id) or
    app_private.is_own_staff(from_staff_id) or app_private.is_own_staff(to_staff_id));

create policy "Staff write handover reports"
  on public.handover_reports for insert to authenticated
  with check (app_private.is_own_staff(from_staff_id));

create policy "Receiving staff acknowledges handover"
  on public.handover_reports for update to authenticated
  using (app_private.is_own_staff(to_staff_id) or
    app_private.can_manage_department(department_id));

create policy "Staff view own assessments, managers view dept"
  on public.staff_assessments for select to authenticated
  using (app_private.is_own_staff(staff_id) or app_private.can_manage_department(
    (select department_id from public.staff where id = staff_id)
  ));

create policy "Managers write assessments"
  on public.staff_assessments for all to authenticated
  using (app_private.has_any_role(array['admin', 'medical_director', 'department_head', 'hr_officer']));

create policy "Staff view own training, managers view dept"
  on public.training_records for select to authenticated
  using (app_private.is_own_staff(staff_id) or app_private.can_manage_department(
    (select department_id from public.staff where id = staff_id)
  ));

create policy "Managers write training records"
  on public.training_records for all to authenticated
  using (app_private.can_manage_department(
    (select department_id from public.staff where id = staff_id)
  ));

create policy "Users see own login sessions"
  on public.login_sessions for select to authenticated
  using (user_id = auth.uid() or app_private.has_role('admin'));

-- Realtime on messages
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_recipients;
alter publication supabase_realtime add table public.handover_reports;
```

---

## PART 4 — SEED EXPANDED DEPARTMENTS (Migration 005)

Create `supabase/migrations/005_expanded_departments.sql`:

Based on the real hospital structure from KBTH and UGMC research, seed a full department hierarchy for SDA Hospital:

```sql
-- Add department hierarchy support to existing departments
-- Mark existing departments correctly
update public.departments set department_type = 'department' where name in
  ('Health Records / Information Department', 'OPD', 'Prescribers', 'Security',
   'ICU', 'Maternity', 'Emergency', 'Pharmacy', 'Lab');

-- Add new units/clinics under existing departments
insert into public.departments (hospital_id, name, description, department_type, parent_id)
select
  '11111111-1111-4111-8111-111111111111',
  unit_name, unit_desc, unit_type,
  (select id from public.departments where name = parent_name limit 1)
from (values
  -- Under Emergency
  ('A&E Triage Unit', 'Initial patient triage and assessment', 'unit', 'Emergency'),
  ('Resuscitation Bay', '24/7 critical resuscitation bay', 'unit', 'Emergency'),
  -- Under Maternity
  ('Antenatal Clinic', 'Routine antenatal checkups', 'special_clinic', 'Maternity'),
  ('Postnatal Ward', 'Post-delivery monitoring', 'unit', 'Maternity'),
  ('Labour Ward', 'Active labour and delivery unit', 'unit', 'Maternity'),
  -- Under Lab
  ('Microbiology & Parasitology', 'Microbiology and parasite diagnostics', 'unit', 'Lab'),
  ('Chemical Pathology', 'Biochemistry and chemical pathology tests', 'unit', 'Lab'),
  ('Haematology & Blood Bank', 'Blood typing, banking, and haematology', 'unit', 'Lab'),
  -- Under Pharmacy
  ('Emergency Pharmacy', 'A&E satellite dispensing', 'unit', 'Pharmacy'),
  ('Inpatient Dispensary', 'Ward-level medication dispensing', 'unit', 'Pharmacy'),
  -- Standalone new departments
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
on conflict do nothing;

-- Add Locum shift configuration to all departments
insert into public.shift_configurations
  (department_id, shift_code, shift_name, start_time, end_time, color_class)
select
  d.id, 'ON_CALL', 'On Call', null, null,
  'bg-rose-100 text-rose-700 border-rose-200'
from public.departments d
on conflict do nothing;

-- Add On-Call shift for Doctors/Prescribers specifically
insert into public.shift_configurations
  (department_id, shift_code, shift_name, start_time, end_time, color_class)
select
  d.id, 'ON_CALL', 'Weekend Call (24hr)', null, null,
  'bg-rose-100 text-rose-700 border-rose-200'
from public.departments d
where d.name = 'Prescribers'
on conflict do nothing;
```

---

## PART 5 — SERVER ACTIONS (replace all mock data)

Create a `/src/lib/actions/` directory with one file per domain. All functions must be `"use server"` async functions using Prisma. Use Supabase server client for auth context only; use Prisma for all data queries.

### `/src/lib/actions/staff.ts`
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getStaff(departmentId?: string) {
  return prisma.staff.findMany({
    where: {
      ...(departmentId ? { department_id: departmentId } : {}),
      is_active: true,
    },
    include: { department: true },
    orderBy: { full_name: "asc" },
  });
}

export async function getStaffById(id: string) {
  return prisma.staff.findUnique({
    where: { id },
    include: {
      department: true,
      leave_requests: { orderBy: { requested_at: "desc" }, take: 10 },
      attendance_records: { orderBy: { shift_date: "desc" }, take: 30 },
      assessments: { orderBy: { assessment_date: "desc" } },
      training_records: { orderBy: { start_date: "desc" } },
    },
  });
}

export async function createStaff(data: {
  full_name: string;
  department_id: string;
  hospital_id: string;
  rank?: string;
  position?: string;
  employment_type?: string;
  phone?: string;
  email?: string;
  staff_number: string;
}) {
  const staff = await prisma.staff.create({ data });
  revalidatePath("/dashboard/staff");
  return staff;
}

export async function updateStaff(id: string, data: Partial<{
  full_name: string; rank: string; position: string;
  employment_type: string; phone: string; email: string;
  department_id: string; is_active: boolean;
}>) {
  const staff = await prisma.staff.update({ where: { id }, data });
  revalidatePath("/dashboard/staff");
  revalidatePath(`/dashboard/staff/${id}`);
  return staff;
}
```

### `/src/lib/actions/rosters.ts`
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getRosters(departmentId?: string) {
  return prisma.roster.findMany({
    where: departmentId ? { department_id: departmentId } : {},
    include: { department: true, entries: { select: { id: true, shift_code: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function getRosterWithEntries(departmentId: string, year: number, month: number) {
  const roster = await prisma.roster.findUnique({
    where: { department_id_month_year: { department_id: departmentId, month, year } },
    include: {
      department: true,
      entries: {
        include: { staff: true, shift_config: true },
        orderBy: { shift_date: "asc" },
      },
    },
  });
  return roster;
}

export async function createRoster(data: {
  department_id: string; month: number; year: number; created_by?: string;
}) {
  const roster = await prisma.roster.create({ data });
  revalidatePath("/dashboard/rosters");
  return roster;
}

export async function updateRosterEntry(
  rosterId: string, staffId: string, shiftDate: string, shiftCode: string, opts?: {
    isLeave?: boolean; leaveType?: string; notes?: string; shiftConfigId?: string;
  }
) {
  const entry = await prisma.rosterEntry.upsert({
    where: { roster_id_staff_id_shift_date: { roster_id: rosterId, staff_id: staffId, shift_date: new Date(shiftDate) } },
    create: {
      roster_id: rosterId, staff_id: staffId,
      shift_date: new Date(shiftDate), shift_code: shiftCode,
      is_leave: opts?.isLeave ?? false,
      leave_type: opts?.leaveType ?? null,
      notes: opts?.notes ?? null,
      shift_config_id: opts?.shiftConfigId ?? null,
    },
    update: {
      shift_code: shiftCode,
      is_leave: opts?.isLeave ?? false,
      leave_type: opts?.leaveType ?? null,
      notes: opts?.notes ?? null,
      shift_config_id: opts?.shiftConfigId ?? null,
    },
  });
  revalidatePath("/dashboard/rosters");
  return entry;
}

export async function updateRosterStatus(
  id: string,
  status: "draft" | "submitted" | "approved" | "published",
  approvedBy?: string
) {
  const roster = await prisma.roster.update({
    where: { id },
    data: {
      status,
      ...(status === "approved" ? { approved_by: approvedBy } : {}),
      ...(status === "published" ? { published_at: new Date() } : {}),
    },
  });
  revalidatePath("/dashboard/rosters");
  return roster;
}
```

### `/src/lib/actions/leave.ts`
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getLeaveRequests(staffId?: string, departmentId?: string) {
  return prisma.leaveRequest.findMany({
    where: {
      ...(staffId ? { staff_id: staffId } : {}),
      ...(departmentId ? { staff: { department_id: departmentId } } : {}),
    },
    include: { staff: { include: { department: true } } },
    orderBy: { requested_at: "desc" },
  });
}

export async function createLeaveRequest(data: {
  staff_id: string; leave_type: string;
  start_date: string; end_date: string; reason?: string;
}) {
  const leave = await prisma.leaveRequest.create({
    data: { ...data, start_date: new Date(data.start_date), end_date: new Date(data.end_date) },
  });
  revalidatePath("/dashboard/leave");
  return leave;
}

export async function reviewLeaveRequest(
  id: string, status: "approved" | "rejected",
  reviewedBy: string, notes?: string
) {
  const leave = await prisma.leaveRequest.update({
    where: { id },
    data: { status, reviewed_by: reviewedBy, reviewed_at: new Date(), notes: notes ?? null },
  });
  revalidatePath("/dashboard/leave");
  return leave;
}
```

### `/src/lib/actions/swaps.ts`
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getShiftSwaps() {
  return prisma.shiftSwap.findMany({
    include: {
      requester: { include: { department: true } },
      replacement: { include: { department: true } },
      requester_entry: true,
      replacement_entry: true,
    },
    orderBy: { requested_at: "desc" },
  });
}

export async function reviewSwap(
  id: string, status: "approved" | "rejected", reviewedBy: string
) {
  const swap = await prisma.shiftSwap.update({
    where: { id },
    data: { status, reviewed_by: reviewedBy },
  });
  revalidatePath("/dashboard/swaps");
  return swap;
}
```

### `/src/lib/actions/departments.ts`
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getDepartments(hospitalId?: string) {
  return prisma.department.findMany({
    where: {
      ...(hospitalId ? { hospital_id: hospitalId } : {}),
      is_active: true,
    },
    include: {
      children: true,
      _count: { select: { staff: true, rosters: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createDepartment(data: {
  hospital_id: string; name: string; description?: string;
  department_type?: string; parent_id?: string;
}) {
  const dept = await prisma.department.create({ data });
  revalidatePath("/dashboard/departments");
  return dept;
}
```

### `/src/lib/actions/attendance.ts` (NEW)
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getAttendanceRecords(staffId?: string, departmentId?: string, date?: string) {
  return prisma.attendanceRecord.findMany({
    where: {
      ...(staffId ? { staff_id: staffId } : {}),
      ...(date ? { shift_date: new Date(date) } : {}),
      ...(departmentId ? { staff: { department_id: departmentId } } : {}),
    },
    include: { staff: true },
    orderBy: { shift_date: "desc" },
  });
}

export async function clockIn(staffId: string, shiftDate: string) {
  return prisma.attendanceRecord.upsert({
    where: { staff_id_shift_date: { staff_id: staffId, shift_date: new Date(shiftDate) } },
    create: { staff_id: staffId, shift_date: new Date(shiftDate), clock_in: new Date(), status: "present" },
    update: { clock_in: new Date() },
  });
}

export async function clockOut(staffId: string, shiftDate: string) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { staff_id_shift_date: { staff_id: staffId, shift_date: new Date(shiftDate) } },
  });
  const durationMinutes = record?.clock_in
    ? Math.floor((new Date().getTime() - record.clock_in.getTime()) / 60000)
    : null;
  return prisma.attendanceRecord.update({
    where: { staff_id_shift_date: { staff_id: staffId, shift_date: new Date(shiftDate) } },
    data: { clock_out: new Date(), ...(durationMinutes ? {} : {}) },
  });
}

export async function markAbsent(staffId: string, shiftDate: string, notes?: string) {
  return prisma.attendanceRecord.upsert({
    where: { staff_id_shift_date: { staff_id: staffId, shift_date: new Date(shiftDate) } },
    create: { staff_id: staffId, shift_date: new Date(shiftDate), status: "absent", notes },
    update: { status: "absent", notes },
  });
}
```

### `/src/lib/actions/messages.ts` (NEW)
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getMessages(staffId: string) {
  return prisma.message.findMany({
    where: {
      OR: [
        { sender_id: staffId },
        { recipients: { some: { staff_id: staffId } } },
      ],
    },
    include: {
      sender: true,
      recipients: { include: { staff: true } },
    },
    orderBy: { created_at: "desc" },
  });
}

export async function getUnreadCount(staffId: string) {
  return prisma.messageRecipient.count({
    where: { staff_id: staffId, is_read: false },
  });
}

export async function sendMessage(data: {
  sender_id: string; subject?: string; body: string;
  recipient_ids: string[]; message_type?: string; department_id?: string;
}) {
  const { recipient_ids, ...messageData } = data;
  const message = await prisma.message.create({
    data: {
      ...messageData,
      recipients: {
        create: recipient_ids.map((staff_id) => ({ staff_id })),
      },
    },
    include: { recipients: true },
  });
  revalidatePath("/dashboard/messages");
  return message;
}

export async function markMessageRead(messageId: string, staffId: string) {
  return prisma.messageRecipient.update({
    where: { message_id_staff_id: { message_id: messageId, staff_id: staffId } },
    data: { is_read: true, read_at: new Date() },
  });
}
```

### `/src/lib/actions/handover.ts` (NEW)
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getHandoverReports(departmentId: string, date?: string) {
  return prisma.handoverReport.findMany({
    where: {
      department_id: departmentId,
      ...(date ? { shift_date: new Date(date) } : {}),
    },
    include: { from_staff: true, to_staff: true },
    orderBy: [{ shift_date: "desc" }, { created_at: "desc" }],
  });
}

export async function createHandoverReport(data: {
  department_id: string; shift_date: string; shift_code: string;
  from_staff_id: string; to_staff_id: string; report_body: string;
  patients_count?: number; critical_notes?: string;
}) {
  const report = await prisma.handoverReport.create({
    data: { ...data, shift_date: new Date(data.shift_date) },
  });
  revalidatePath("/dashboard/handover");
  return report;
}

export async function acknowledgeHandover(id: string) {
  return prisma.handoverReport.update({
    where: { id },
    data: { is_acknowledged: true, acknowledged_at: new Date() },
  });
}
```

### `/src/lib/actions/assessments.ts` (NEW)
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getAssessments(staffId?: string, departmentId?: string) {
  return prisma.staffAssessment.findMany({
    where: {
      ...(staffId ? { staff_id: staffId } : {}),
      ...(departmentId ? { staff: { department_id: departmentId } } : {}),
    },
    include: { staff: true },
    orderBy: { assessment_date: "desc" },
  });
}

export async function createAssessment(data: {
  staff_id: string; assessed_by: string; assessment_date: string; period: string;
  competency_score?: number; efficiency_score?: number;
  professionalism_score?: number; ethical_score?: number; comments?: string;
}) {
  const scores = [data.competency_score, data.efficiency_score,
    data.professionalism_score, data.ethical_score].filter(Boolean) as number[];
  const overall_score = scores.length > 0
    ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
    : null;

  const assessment = await prisma.staffAssessment.create({
    data: { ...data, assessment_date: new Date(data.assessment_date), overall_score },
  });
  revalidatePath("/dashboard/staff");
  return assessment;
}
```

### `/src/lib/actions/training.ts` (NEW)
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getTrainingRecords(staffId?: string, departmentId?: string) {
  return prisma.trainingRecord.findMany({
    where: {
      ...(staffId ? { staff_id: staffId } : {}),
      ...(departmentId ? { staff: { department_id: departmentId } } : {}),
    },
    include: { staff: true },
    orderBy: { start_date: "desc" },
  });
}

export async function createTrainingRecord(data: {
  staff_id: string; training_title: string; training_type: string;
  provider?: string; start_date: string; end_date: string;
  certificate_url?: string; notes?: string;
}) {
  const record = await prisma.trainingRecord.create({
    data: { ...data, start_date: new Date(data.start_date), end_date: new Date(data.end_date) },
  });
  revalidatePath("/dashboard/staff");
  return record;
}
```

---

## PART 6 — UPDATE HOOKS TO USE SERVER ACTIONS

Replace all mock data imports in hooks with calls to the server actions:

### `/src/lib/hooks/useRoster.ts`
```ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRosterWithEntries, updateRosterEntry, updateRosterStatus } from "@/lib/actions/rosters";

export function useRoster(departmentId: string, year: number, month: number) {
  return useQuery({
    queryKey: ["roster", departmentId, year, month],
    queryFn: () => getRosterWithEntries(departmentId, year, month),
  });
}

export function useUpdateRosterEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rosterId, staffId, shiftDate, shiftCode, opts }: {
      rosterId: string; staffId: string; shiftDate: string;
      shiftCode: string; opts?: { isLeave?: boolean; leaveType?: string; notes?: string };
    }) => updateRosterEntry(rosterId, staffId, shiftDate, shiftCode, opts),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roster"] }),
  });
}
```

### `/src/lib/hooks/useStaff.ts`
```ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStaff, createStaff, updateStaff } from "@/lib/actions/staff";

export function useStaff(departmentId?: string) {
  return useQuery({
    queryKey: ["staff", departmentId ?? "all"],
    queryFn: () => getStaff(departmentId),
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createStaff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });
}
```

### `/src/lib/hooks/useLeave.ts`
```ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLeaveRequests, createLeaveRequest, reviewLeaveRequest } from "@/lib/actions/leave";

export function useLeave(staffId?: string, departmentId?: string) {
  return useQuery({
    queryKey: ["leave-requests", staffId, departmentId],
    queryFn: () => getLeaveRequests(staffId, departmentId),
  });
}

export function useReviewLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reviewedBy, notes }: {
      id: string; status: "approved" | "rejected"; reviewedBy: string; notes?: string;
    }) => reviewLeaveRequest(id, status, reviewedBy, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave-requests"] }),
  });
}
```

---

## PART 7 — NEW PAGES TO BUILD

### 1. `/dashboard/messages` — Internal Messaging
- **Inbox view**: list of received messages with sender avatar, subject, preview, timestamp, unread badge
- **Compose button**: opens a `<Dialog>` with: To (staff multi-select dropdown), Subject, Body (textarea), Send button
- **Message thread view**: click a message → shows full content + reply field
- **Unread count badge** on the sidebar "Messages" nav item (using Supabase Realtime subscription)
- **Broadcast tab**: send to entire department (admin/dept head only)
- Use `sendMessage`, `getMessages`, `markMessageRead` actions

### 2. `/dashboard/handover` — Handover Reports
- **Per-department view**: dropdown to select department, shows today's handover reports
- **Create Handover Report** form:
  - Department (select)
  - Shift date (date picker)
  - Shift being handed over (M / A / N select)
  - Handing over TO (staff select — filtered to next shift's staff)
  - Report body (rich textarea with placeholder: "Patient census, critical cases, pending tasks, equipment issues...")
  - Patient count (number input)
  - Critical Notes (separate highlighted textarea)
- **Acknowledge button** for the receiving staff
- Unacknowledged reports highlighted in amber
- Use `createHandoverReport`, `acknowledgeHandover`, `getHandoverReports` actions

### 3. `/dashboard/attendance` — Attendance Tracking
- Monthly calendar-style grid (same layout as the roster grid) but showing:
  - Clock-in time (green if on time, amber if late)
  - Clock-out time
  - Duration
  - Status badge (present / absent / late)
- **Mark Absent** button per staff per day
- **Export attendance report** for the month (PDF/Excel using existing export utility)
- Filter by department and date range
- Use `getAttendanceRecords`, `clockIn`, `clockOut`, `markAbsent` actions

### 4. Update `/dashboard/staff/[id]` — Add Assessments & Training tabs
Add two new tabs to the existing staff profile page:
- **Assessments tab**: table of past assessments with scores per category. "New Assessment" button opens form with: Period, Competency (1–5), Efficiency (1–5), Professionalism (1–5), Ethical Standards (1–5), Comments. Overall score auto-calculated.
- **Training tab**: table of training records (given and attended). "Add Training" button opens form with: Title, Type (given/attended), Provider, Dates, Certificate upload field.

### 5. Add Login Session Timer
- When a user successfully logs in (in `login/page.tsx`), create a `login_sessions` record via a server action:
  ```ts
  // In login page after successful signInWithPassword:
  await createLoginSession({ user_id: session.user.id, staff_id: ... });
  ```
- When they log out (in `Header.tsx`), update the session with `logout_at` and calculate `duration_minutes`
- In the admin dashboard, show a "Recent Logins" widget — last 10 sessions with staff name, login time, duration

---

## PART 8 — UPDATE TYPES

Update `/src/lib/types/index.ts` — add these new types to match the new Prisma models:

```ts
export type ShiftCode = "M" | "A" | "N" | "O" | "H" | "%" | "LEAVE" | "ON_CALL";

export type DepartmentType = "department" | "unit" | "special_clinic" | "autonomous_centre";

export interface Department {
  // existing fields...
  department_type: DepartmentType;
  parent_id: string | null;
  children?: Department[];
}

export interface AttendanceRecord {
  id: UUID;
  staff_id: UUID;
  shift_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: "present" | "absent" | "late" | "early_departure";
  notes: string | null;
  created_at: string;
}

export interface Message {
  id: UUID;
  sender_id: UUID;
  subject: string | null;
  body: string;
  message_type: "direct" | "broadcast" | "department";
  department_id: UUID | null;
  created_at: string;
  sender?: Staff;
  recipients?: MessageRecipient[];
}

export interface MessageRecipient {
  id: UUID;
  message_id: UUID;
  staff_id: UUID;
  is_read: boolean;
  read_at: string | null;
  staff?: Staff;
}

export interface HandoverReport {
  id: UUID;
  department_id: UUID;
  shift_date: string;
  shift_code: string;
  from_staff_id: UUID;
  to_staff_id: UUID;
  report_body: string;
  patients_count: number | null;
  critical_notes: string | null;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
  from_staff?: Staff;
  to_staff?: Staff;
}

export interface StaffAssessment {
  id: UUID;
  staff_id: UUID;
  assessed_by: UUID;
  assessment_date: string;
  period: string;
  competency_score: number | null;
  efficiency_score: number | null;
  professionalism_score: number | null;
  ethical_score: number | null;
  overall_score: number | null;
  comments: string | null;
  created_at: string;
}

export interface TrainingRecord {
  id: UUID;
  staff_id: UUID;
  training_title: string;
  training_type: "given" | "attended";
  provider: string | null;
  start_date: string;
  end_date: string;
  certificate_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface LoginSession {
  id: UUID;
  user_id: UUID;
  staff_id: UUID | null;
  login_at: string;
  logout_at: string | null;
  duration_minutes: number | null;
  ip_address: string | null;
  device: string | null;
}
```

---

## PART 9 — UPDATE SIDEBAR NAVIGATION

Add the new pages to `Sidebar.tsx` nav items:

```ts
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/departments", label: "Departments", icon: Building2 },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/rosters", label: "Duty Rosters", icon: CalendarDays },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },       // NEW
  { href: "/dashboard/leave", label: "Leave", icon: CalendarOff },
  { href: "/dashboard/swaps", label: "Shift Swaps", icon: ArrowLeftRight },
  { href: "/dashboard/handover", label: "Handover Reports", icon: ClipboardList }, // NEW
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },   // NEW (with unread badge)
  { href: "/dashboard/reports", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];
```

---

## PART 10 — LOCUM STAFF HANDLING

From the research document: *"There are other duties called 'locum'; they are not permanent staff, but they run special clinics. Sometimes they visit 3 times a week and other times in emergencies."*

### How to implement:
1. `employment_type = "Locum"` already exists on the `Staff` model — use it to filter locum staff
2. The `ON_CALL` shift code now exists — use it for locum/call shifts in the roster grid
3. In `StaffForm`, the Employment Type dropdown must include "Locum" as an option
4. In the roster grid, locum staff entries should visually differ — use a dashed border on their row
5. On the Departments page, add a "Locum Pool" tab that shows all staff with `employment_type = "Locum"` across all departments, with a button to quickly assign them to an open shift

---

## FINAL CHECKLIST FOR AGENT

- [ ] `/src/middleware.ts` created at project root
- [ ] Prisma installed, schema created, `prisma generate` run
- [ ] Migration `004_new_features.sql` written and ready to run
- [ ] Migration `005_expanded_departments.sql` written and ready to run
- [ ] All 9 server action files created under `/src/lib/actions/`
- [ ] All 3 hooks updated to use real server actions
- [ ] Existing pages (`staff`, `leave`, `swaps`, `rosters`, `departments`) updated to call server actions instead of importing from mock
- [ ] Mock data file kept but no longer imported by any page or hook
- [ ] 3 new pages: `/dashboard/messages`, `/dashboard/handover`, `/dashboard/attendance`
- [ ] Staff profile page updated with Assessments + Training tabs
- [ ] Login session tracking added to login/logout flow
- [ ] `ON_CALL` shift code supported in the roster grid with rose/red colouring
- [ ] Locum staff row styling in roster grid (dashed border)
- [ ] New types added to `/src/lib/types/index.ts`
- [ ] Sidebar updated with new nav items
- [ ] `npm run build` passes with zero TypeScript errors

---

## IMPORTANT NOTES

- **Do not remove mock data file** — keep it at `/src/lib/data/mock.ts` as a fallback reference
- **Prisma vs Supabase client** — use Prisma for ALL database queries; use Supabase client only for `auth.getUser()` and Realtime subscriptions
- **Server Actions in App Router** — all action files use `"use server"` directive; never call Prisma from a client component directly
- **Error handling** — wrap all Prisma calls in try/catch; return `{ error: string }` on failure so the UI can show a toast
- **No new dependencies** unless absolutely required — all necessary packages are already in `package.json`
- **TypeScript strict** — no `any`, all Prisma return types should be properly inferred
