# MedRota — Enterprise Features Build Prompt
### Phase 4: Audit Trail · Payroll/Allowances · Escalation Engine · Locum Board · E-Signature · Notifications · Analytics · PWA

---

## CONTEXT & RULES

You are continuing work on MedRota. The existing stack is:
- **Next.js 14 App Router** with TypeScript strict mode
- **Supabase** (PostgreSQL, Auth, Realtime, Storage, Edge Functions)
- **Prisma ORM** with generated client at `src/generated/prisma`
- **shadcn/ui + Tailwind CSS** with the existing luxe palette (`#1A2B4A`, `#2E86AB`, `#A8DADC`)

**Rules:**
- No `any` in TypeScript. Zero.
- Every new server action file starts with `"use server"` and wraps everything in `try/catch` returning `{ error: string }` on failure.
- Every new Prisma model gets a serializer function added to `src/lib/actions/serializers.ts` using the existing `dateTime()` / `dateOnly()` helpers.
- Every new table gets RLS enabled in the SQL migration.
- `npm run build` must pass with zero errors when done.
- Do not modify the existing serializers — only add to them.
- All new pages follow the existing page structure pattern (async RSC, `export const dynamic = "force-dynamic"`).

---

## FEATURE 1 — AUDIT TRAIL

### 1a. Migration: `supabase/migrations/007_audit_trail.sql`

```sql
create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  staff_id     uuid references public.staff(id) on delete set null,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  old_value    jsonb,
  new_value    jsonb,
  ip_address   text,
  created_at   timestamptz default now()
);

create index audit_log_user_idx       on public.audit_log(user_id);
create index audit_log_entity_idx     on public.audit_log(entity_type, entity_id);
create index audit_log_created_at_idx on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;

-- Only admins and hr_officers can read audit logs
create policy "Admins read audit log"
  on public.audit_log for select to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
      and role in ('admin', 'hr_officer', 'medical_director')
    )
  );

-- System writes audit log (service role only, no user insert policy)
```

### 1b. Prisma Model — add to `prisma/schema.prisma`

```prisma
model AuditLog {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id     String?  @db.Uuid
  staff_id    String?  @db.Uuid
  action      String
  entity_type String
  entity_id   String?  @db.Uuid
  old_value   Json?
  new_value   Json?
  ip_address  String?
  created_at  DateTime @default(now()) @db.Timestamptz(6)

  @@map("audit_log")
  @@schema("public")
}
```

Run `npx prisma db push` then `npx prisma generate`.

### 1c. New Type — add to `src/lib/types/index.ts`

```ts
export interface AuditLog {
  id: UUID;
  user_id: UUID | null;
  staff_id: UUID | null;
  action: string;
  entity_type: string;
  entity_id: UUID | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}
```

### 1d. Serializer — add to `src/lib/actions/serializers.ts`

```ts
type DbAuditLog = Omit<AuditLog, "created_at"> & { created_at: Dateish };

export function serializeAuditLog(log: DbAuditLog): AuditLog {
  return {
    ...log,
    old_value: (log.old_value as Record<string, unknown>) ?? null,
    new_value: (log.new_value as Record<string, unknown>) ?? null,
    created_at: dateTime(log.created_at) ?? "",
  };
}
```

### 1e. Server Action — create `src/lib/actions/audit.ts`

```ts
"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { serializeAuditLog } from "@/lib/actions/serializers";

export async function logAudit(data: {
  user_id?: string;
  staff_id?: string;
  action: string;             // e.g. "roster_published", "leave_approved", "staff_created"
  entity_type: string;        // e.g. "roster", "leave_request", "staff"
  entity_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
}) {
  try {
    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await prisma.auditLog.create({
      data: {
        ...data,
        ip_address: ip,
        old_value: data.old_value ?? undefined,
        new_value: data.new_value ?? undefined,
      },
    });
  } catch {
    // Audit logging must never crash the calling action — silently swallow errors
  }
}

export async function getAuditLogs(filters?: {
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(filters?.entity_type ? { entity_type: filters.entity_type } : {}),
        ...(filters?.entity_id ? { entity_id: filters.entity_id } : {}),
        ...(filters?.user_id ? { user_id: filters.user_id } : {}),
        ...(filters?.from || filters?.to
          ? {
              created_at: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { created_at: "desc" },
      take: filters?.limit ?? 100,
    });
    return logs.map(serializeAuditLog);
  } catch {
    return [];
  }
}
```

### 1f. Wire `logAudit` into existing server actions

Add `logAudit` calls in these existing actions (import from `@/lib/actions/audit`):

**`src/lib/actions/rosters.ts`** — after `updateRosterStatus`:
```ts
await logAudit({
  action: `roster_${status}`,
  entity_type: "roster",
  entity_id: id,
  old_value: { status: existing?.status },
  new_value: { status },
});
```

**`src/lib/actions/leave.ts`** — after `reviewLeaveRequest`:
```ts
await logAudit({
  action: `leave_${status}`,
  entity_type: "leave_request",
  entity_id: id,
  new_value: { status, reviewed_by: reviewedBy },
});
```

**`src/lib/actions/staff.ts`** — after `createStaff` and `updateStaff`:
```ts
// createStaff
await logAudit({ action: "staff_created", entity_type: "staff", entity_id: staff.id, new_value: { full_name: staff.full_name, department_id: staff.department_id } });

// updateStaff
await logAudit({ action: "staff_updated", entity_type: "staff", entity_id: id, new_value: data });
```

**`src/lib/actions/rosters.ts`** — after `updateRosterEntry` (only for non-O codes to avoid noise):
```ts
if (shiftCode !== "O") {
  await logAudit({
    action: "roster_entry_updated",
    entity_type: "roster_entry",
    entity_id: entry.id,
    new_value: { staff_id: staffId, shift_date: shiftDate, shift_code: shiftCode },
  });
}
```

### 1g. Audit Log Page — `src/app/dashboard/audit/page.tsx`

```tsx
import { getAuditLogs } from "@/lib/actions/audit";
import { PageHeader } from "@/components/layout/PageHeader";
import { Shield } from "lucide-react";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  roster_published:    { label: "Roster Published",    color: "bg-emerald-100 text-emerald-700" },
  roster_approved:     { label: "Roster Approved",     color: "bg-blue-100 text-blue-700" },
  roster_submitted:    { label: "Roster Submitted",    color: "bg-amber-100 text-amber-700" },
  roster_entry_updated:{ label: "Entry Updated",       color: "bg-slate-100 text-slate-600" },
  leave_approved:      { label: "Leave Approved",      color: "bg-emerald-100 text-emerald-700" },
  leave_rejected:      { label: "Leave Rejected",      color: "bg-red-100 text-red-700" },
  staff_created:       { label: "Staff Created",       color: "bg-purple-100 text-purple-700" },
  staff_updated:       { label: "Staff Updated",       color: "bg-indigo-100 text-indigo-700" },
};

export default async function AuditPage() {
  const logs = await getAuditLogs({ limit: 200 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Complete log of all actions taken in the system"
        icon={<Shield className="h-5 w-5 text-[#2E86AB]" />}
      />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Recent Actions</h2>
          <span className="text-sm text-slate-400">{logs.length} entries</span>
        </div>
        <div className="divide-y divide-slate-50">
          {logs.map((log) => {
            const config = ACTION_LABELS[log.action] ?? { label: log.action, color: "bg-slate-100 text-slate-600" };
            return (
              <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50">
                <div className="mt-0.5 shrink-0">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium capitalize">{log.entity_type}</span>
                    {log.entity_id && (
                      <span className="ml-1 font-mono text-xs text-slate-400">
                        {log.entity_id.slice(0, 8)}…
                      </span>
                    )}
                  </p>
                  {log.new_value && (
                    <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">
                      {JSON.stringify(log.new_value)}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-500">
                    {new Date(log.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(log.created_at).toLocaleTimeString("en-GB", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  {log.ip_address && (
                    <p className="text-xs text-slate-300 font-mono">{log.ip_address}</p>
                  )}
                </div>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              No audit entries yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

Add to `HRSidebar.tsx` nav items:
```ts
{ href: "/dashboard/audit", label: "Audit Trail", icon: Shield },
```

---

## FEATURE 2 — PAYROLL & SHIFT ALLOWANCES

### 2a. Migration: `supabase/migrations/008_payroll.sql`

```sql
-- Configurable allowance rates per hospital
create table if not exists public.allowance_rates (
  id             uuid primary key default gen_random_uuid(),
  hospital_id    uuid references public.hospitals(id) on delete cascade,
  shift_code     text not null,
  rate_ghs       numeric(10,2) not null default 0,
  description    text,
  effective_from date not null default current_date,
  is_active      boolean default true,
  created_at     timestamptz default now(),
  unique(hospital_id, shift_code, effective_from)
);

-- Payroll summary snapshots (generated monthly, exportable)
create table if not exists public.payroll_summaries (
  id                  uuid primary key default gen_random_uuid(),
  staff_id            uuid references public.staff(id) on delete cascade,
  month               integer not null,
  year                integer not null,
  morning_shifts      integer default 0,
  afternoon_shifts    integer default 0,
  night_shifts        integer default 0,
  weekend_shifts      integer default 0,
  holiday_shifts      integer default 0,
  on_call_shifts      integer default 0,
  total_shifts        integer default 0,
  leave_days          integer default 0,
  absent_days         integer default 0,
  night_allowance     numeric(10,2) default 0,
  weekend_allowance   numeric(10,2) default 0,
  holiday_allowance   numeric(10,2) default 0,
  on_call_allowance   numeric(10,2) default 0,
  total_allowance     numeric(10,2) default 0,
  generated_at        timestamptz default now(),
  unique(staff_id, month, year)
);

alter table public.allowance_rates enable row level security;
alter table public.payroll_summaries enable row level security;

create policy "HR and admin read allowance rates"
  on public.allowance_rates for select to authenticated
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin','hr_officer','medical_director')
  ));

create policy "Admin manage allowance rates"
  on public.allowance_rates for all to authenticated
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  ));

create policy "Staff read own payroll summary"
  on public.payroll_summaries for select to authenticated
  using (
    staff_id in (select id from public.staff where user_id = auth.uid())
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role in ('admin','hr_officer','department_head')
    )
  );

-- Seed default rates for SDA Hospital
-- Replace the UUID with your actual hospital ID from the hospitals table
insert into public.allowance_rates (hospital_id, shift_code, rate_ghs, description, effective_from)
select
  h.id, r.shift_code, r.rate_ghs, r.description, '2026-01-01'
from public.hospitals h
cross join (values
  ('N',       50.00, 'Night shift allowance'),
  ('H',       80.00, 'Public holiday shift allowance'),
  ('ON_CALL', 40.00, 'On-call duty allowance')
) as r(shift_code, rate_ghs, description)
on conflict do nothing;
```

### 2b. Prisma Models — add to `prisma/schema.prisma`

```prisma
model AllowanceRate {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  hospital_id    String?   @db.Uuid
  shift_code     String
  rate_ghs       Decimal   @db.Decimal(10, 2)
  description    String?
  effective_from DateTime  @db.Date
  is_active      Boolean   @default(true)
  created_at     DateTime  @default(now()) @db.Timestamptz(6)

  @@unique([hospital_id, shift_code, effective_from])
  @@map("allowance_rates")
  @@schema("public")
}

model PayrollSummary {
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  staff_id           String?  @db.Uuid
  month              Int
  year               Int
  morning_shifts     Int      @default(0)
  afternoon_shifts   Int      @default(0)
  night_shifts       Int      @default(0)
  weekend_shifts     Int      @default(0)
  holiday_shifts     Int      @default(0)
  on_call_shifts     Int      @default(0)
  total_shifts       Int      @default(0)
  leave_days         Int      @default(0)
  absent_days        Int      @default(0)
  night_allowance    Decimal  @default(0) @db.Decimal(10, 2)
  weekend_allowance  Decimal  @default(0) @db.Decimal(10, 2)
  holiday_allowance  Decimal  @default(0) @db.Decimal(10, 2)
  on_call_allowance  Decimal  @default(0) @db.Decimal(10, 2)
  total_allowance    Decimal  @default(0) @db.Decimal(10, 2)
  generated_at       DateTime @default(now()) @db.Timestamptz(6)
  staff              Staff?   @relation(fields: [staff_id], references: [id], onDelete: Cascade)

  @@unique([staff_id, month, year])
  @@map("payroll_summaries")
  @@schema("public")
}
```

Also add `payroll_summaries PayrollSummary[]` to the `Staff` model relations.

### 2c. New Types — add to `src/lib/types/index.ts`

```ts
export interface AllowanceRate {
  id: UUID;
  hospital_id: UUID | null;
  shift_code: string;
  rate_ghs: number;
  description: string | null;
  effective_from: string;
  is_active: boolean;
  created_at: string;
}

export interface PayrollSummary {
  id: UUID;
  staff_id: UUID | null;
  month: number;
  year: number;
  morning_shifts: number;
  afternoon_shifts: number;
  night_shifts: number;
  weekend_shifts: number;
  holiday_shifts: number;
  on_call_shifts: number;
  total_shifts: number;
  leave_days: number;
  absent_days: number;
  night_allowance: number;
  weekend_allowance: number;
  holiday_allowance: number;
  on_call_allowance: number;
  total_allowance: number;
  generated_at: string;
  staff?: Staff | null;
}
```

### 2d. Serializers — add to `src/lib/actions/serializers.ts`

```ts
type DbAllowanceRate = Omit<AllowanceRate, "rate_ghs" | "effective_from" | "created_at"> & {
  rate_ghs: Decimal | number;
  effective_from: Dateish;
  created_at: Dateish;
};
type DbPayrollSummary = Omit<PayrollSummary, | "night_allowance" | "weekend_allowance" | "holiday_allowance" | "on_call_allowance" | "total_allowance" | "generated_at" | "staff"> & {
  night_allowance: Decimal | number;
  weekend_allowance: Decimal | number;
  holiday_allowance: Decimal | number;
  on_call_allowance: Decimal | number;
  total_allowance: Decimal | number;
  generated_at: Dateish;
  staff?: DbStaff | null;
};

// Prisma Decimal → number helper
function toNumber(v: Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : parseFloat(v.toString());
}

export function serializeAllowanceRate(rate: DbAllowanceRate): AllowanceRate {
  return {
    ...rate,
    rate_ghs: toNumber(rate.rate_ghs),
    effective_from: dateOnly(rate.effective_from),
    created_at: dateTime(rate.created_at) ?? "",
  };
}

export function serializePayrollSummary(summary: DbPayrollSummary): PayrollSummary {
  return {
    ...summary,
    night_allowance:    toNumber(summary.night_allowance),
    weekend_allowance:  toNumber(summary.weekend_allowance),
    holiday_allowance:  toNumber(summary.holiday_allowance),
    on_call_allowance:  toNumber(summary.on_call_allowance),
    total_allowance:    toNumber(summary.total_allowance),
    generated_at: dateTime(summary.generated_at) ?? "",
    staff: summary.staff ? serializeStaff(summary.staff) : undefined,
  };
}
```

Add `import { Decimal } from "@prisma/client/runtime/library";` at the top of serializers.ts.

### 2e. Server Action — create `src/lib/actions/payroll.ts`

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializePayrollSummary, serializeAllowanceRate } from "@/lib/actions/serializers";

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function getAllowanceRates(hospitalId?: string) {
  try {
    const rates = await prisma.allowanceRate.findMany({
      where: { ...(hospitalId ? { hospital_id: hospitalId } : {}), is_active: true },
      orderBy: { shift_code: "asc" },
    });
    return rates.map(serializeAllowanceRate);
  } catch {
    return [];
  }
}

export async function updateAllowanceRate(id: string, rate_ghs: number) {
  try {
    const rate = await prisma.allowanceRate.update({
      where: { id },
      data: { rate_ghs },
    });
    revalidatePath("/dashboard/settings");
    return serializeAllowanceRate(rate);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update rate" };
  }
}

export async function generatePayrollSummary(
  staffId: string,
  year: number,
  month: number,
  hospitalId: string
) {
  try {
    const monthStart = toDate(`${year}-${String(month).padStart(2, "0")}-01`);
    const monthEnd = new Date(
      new Date(monthStart).setMonth(monthStart.getMonth() + 1) - 1
    );

    const [entries, absences, rates] = await Promise.all([
      prisma.rosterEntry.findMany({
        where: { staff_id: staffId, shift_date: { gte: monthStart, lte: monthEnd } },
      }),
      prisma.attendanceRecord.findMany({
        where: { staff_id: staffId, shift_date: { gte: monthStart, lte: monthEnd }, status: "absent" },
      }),
      prisma.allowanceRate.findMany({ where: { hospital_id: hospitalId, is_active: true } }),
    ]);

    const rateMap = new Map(rates.map((r) => [r.shift_code, parseFloat(r.rate_ghs.toString())]));

    const counts = { M: 0, A: 0, N: 0, H: 0, ON_CALL: 0, LEAVE: 0, weekend: 0 };
    for (const entry of entries) {
      const code = entry.shift_code as keyof typeof counts;
      if (code in counts) counts[code]++;
      const d = new Date(entry.shift_date);
      if ((d.getDay() === 0 || d.getDay() === 6) && entry.shift_code !== "O") {
        counts.weekend++;
      }
    }

    const nightAllowance   = counts.N       * (rateMap.get("N")       ?? 0);
    const holidayAllowance = counts.H       * (rateMap.get("H")       ?? 0);
    const onCallAllowance  = counts.ON_CALL * (rateMap.get("ON_CALL") ?? 0);
    const weekendAllowance = counts.weekend * (rateMap.get("weekend") ?? 0);
    const totalAllowance   = nightAllowance + holidayAllowance + onCallAllowance + weekendAllowance;

    const summary = await prisma.payrollSummary.upsert({
      where: { staff_id_month_year: { staff_id: staffId, month, year } },
      create: {
        staff_id: staffId, month, year,
        morning_shifts: counts.M, afternoon_shifts: counts.A,
        night_shifts: counts.N, weekend_shifts: counts.weekend,
        holiday_shifts: counts.H, on_call_shifts: counts.ON_CALL,
        total_shifts: counts.M + counts.A + counts.N,
        leave_days: counts.LEAVE, absent_days: absences.length,
        night_allowance: nightAllowance, weekend_allowance: weekendAllowance,
        holiday_allowance: holidayAllowance, on_call_allowance: onCallAllowance,
        total_allowance: totalAllowance,
      },
      update: {
        morning_shifts: counts.M, afternoon_shifts: counts.A,
        night_shifts: counts.N, weekend_shifts: counts.weekend,
        holiday_shifts: counts.H, on_call_shifts: counts.ON_CALL,
        total_shifts: counts.M + counts.A + counts.N,
        leave_days: counts.LEAVE, absent_days: absences.length,
        night_allowance: nightAllowance, weekend_allowance: weekendAllowance,
        holiday_allowance: holidayAllowance, on_call_allowance: onCallAllowance,
        total_allowance: totalAllowance, generated_at: new Date(),
      },
    });

    revalidatePath("/dashboard/reports");
    return serializePayrollSummary(summary);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to generate payroll summary" };
  }
}

export async function getDepartmentPayrollSummary(departmentId: string, year: number, month: number) {
  try {
    const summaries = await prisma.payrollSummary.findMany({
      where: {
        month, year,
        staff: { department_id: departmentId },
      },
      include: { staff: true },
      orderBy: { total_allowance: "desc" },
    });
    return summaries.map(serializePayrollSummary);
  } catch {
    return [];
  }
}

export async function getAllStaffPayrollSummary(year: number, month: number) {
  try {
    const summaries = await prisma.payrollSummary.findMany({
      where: { month, year },
      include: { staff: { include: { department: true } } },
      orderBy: { total_allowance: "desc" },
    });
    return summaries.map(serializePayrollSummary);
  } catch {
    return [];
  }
}
```

### 2f. Payroll Page — `src/app/dashboard/payroll/page.tsx`

```tsx
import { getAllStaffPayrollSummary, getAllowanceRates } from "@/lib/actions/payroll";
import { getDepartments } from "@/lib/actions/departments";
import { PageHeader } from "@/components/layout/PageHeader";
import { DollarSign } from "lucide-react";
import { PayrollTable } from "@/components/payroll/PayrollTable";

export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const now = new Date();
  const month = Number(searchParams.month ?? now.getMonth() + 1);
  const year  = Number(searchParams.year  ?? now.getFullYear());

  const [summaries, departments, rates] = await Promise.all([
    getAllStaffPayrollSummary(year, month),
    getDepartments(),
    getAllowanceRates(),
  ]);

  const totalNight   = summaries.reduce((s, r) => s + r.night_allowance,   0);
  const totalHoliday = summaries.reduce((s, r) => s + r.holiday_allowance, 0);
  const totalOnCall  = summaries.reduce((s, r) => s + r.on_call_allowance, 0);
  const grandTotal   = summaries.reduce((s, r) => s + r.total_allowance,   0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll & Allowances"
        description={`Shift allowance summary — ${new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
        icon={<DollarSign className="h-5 w-5 text-[#2E86AB]" />}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Night Allowance",   value: totalNight,   color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
          { label: "Holiday Allowance", value: totalHoliday, color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
          { label: "On-Call Allowance", value: totalOnCall,  color: "text-rose-700",   bg: "bg-rose-50 border-rose-200" },
          { label: "Total Payable",     value: grandTotal,   color: "text-emerald-700",bg: "bg-emerald-50 border-emerald-200" },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.color}`}>
              GHS {card.value.toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      {/* Rates config (read-only display) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Current Allowance Rates</h3>
        <div className="flex flex-wrap gap-3">
          {rates.map((r) => (
            <span key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
              <span className="font-mono font-bold text-[#1A2B4A]">{r.shift_code}</span>
              <span className="ml-2 text-slate-600">GHS {r.rate_ghs.toFixed(2)}</span>
              {r.description && <span className="ml-1 text-slate-400">· {r.description}</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Staff payroll table */}
      <PayrollTable summaries={summaries} month={month} year={year} />
    </div>
  );
}
```

### 2g. PayrollTable Component — `src/components/payroll/PayrollTable.tsx`

```tsx
"use client";

import { useState } from "react";
import { generatePayrollSummary } from "@/lib/actions/payroll";
import type { PayrollSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export function PayrollTable({
  summaries,
  month,
  year,
}: {
  summaries: PayrollSummary[];
  month: number;
  year: number;
}) {
  const [generating, setGenerating] = useState<string | null>(null);

  async function handleExportExcel() {
    const rows = summaries.map((s) => ({
      "Staff Name": s.staff?.full_name ?? "—",
      "Department": s.staff?.department?.name ?? "—",
      "Morning": s.morning_shifts,
      "Afternoon": s.afternoon_shifts,
      "Night": s.night_shifts,
      "Weekend": s.weekend_shifts,
      "Holiday": s.holiday_shifts,
      "On-Call": s.on_call_shifts,
      "Total Shifts": s.total_shifts,
      "Leave Days": s.leave_days,
      "Absent Days": s.absent_days,
      "Night Allow (GHS)": s.night_allowance.toFixed(2),
      "Holiday Allow (GHS)": s.holiday_allowance.toFixed(2),
      "On-Call Allow (GHS)": s.on_call_allowance.toFixed(2),
      "Total Allow (GHS)": s.total_allowance.toFixed(2),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    XLSX.writeFile(wb, `SDA_Hospital_Payroll_${month}_${year}.xlsx`);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="font-semibold text-slate-700">Staff Allowance Breakdown</h2>
        <Button size="sm" variant="outline" onClick={handleExportExcel}>
          Export Excel
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Staff","Dept","M","A","N","WE","H","OC","Shifts","Leave","Night GHS","Holiday GHS","On-Call GHS","Total GHS"].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {summaries.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/50">
                <td className="px-3 py-3 font-medium text-slate-800">{s.staff?.full_name ?? "—"}</td>
                <td className="px-3 py-3 text-slate-500 text-xs">{s.staff?.department?.name ?? "—"}</td>
                <td className="px-3 py-3 text-center">{s.morning_shifts}</td>
                <td className="px-3 py-3 text-center">{s.afternoon_shifts}</td>
                <td className="px-3 py-3 text-center text-indigo-600 font-medium">{s.night_shifts}</td>
                <td className="px-3 py-3 text-center">{s.weekend_shifts}</td>
                <td className="px-3 py-3 text-center text-orange-600 font-medium">{s.holiday_shifts}</td>
                <td className="px-3 py-3 text-center text-rose-600 font-medium">{s.on_call_shifts}</td>
                <td className="px-3 py-3 text-center font-semibold">{s.total_shifts}</td>
                <td className="px-3 py-3 text-center text-purple-600">{s.leave_days}</td>
                <td className="px-3 py-3 text-right">{s.night_allowance.toFixed(2)}</td>
                <td className="px-3 py-3 text-right">{s.holiday_allowance.toFixed(2)}</td>
                <td className="px-3 py-3 text-right">{s.on_call_allowance.toFixed(2)}</td>
                <td className="px-3 py-3 text-right font-bold text-emerald-700">
                  {s.total_allowance.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={13} className="px-3 py-3 font-semibold text-slate-700">Grand Total</td>
              <td className="px-3 py-3 text-right font-bold text-emerald-700 text-base">
                GHS {summaries.reduce((s, r) => s + r.total_allowance, 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
```

Add to `HRSidebar.tsx`:
```ts
{ href: "/dashboard/payroll", label: "Payroll & Allowances", icon: DollarSign },
```

---

## FEATURE 3 — ESCALATION ENGINE (Supabase Edge Function + Cron)

### 3a. Edge Function — `supabase/functions/escalate-leaves/index.ts`

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STALE_HOURS = 48;

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  // Find leave requests stuck at pending for > 48 hours
  const { data: staleLeaves } = await supabase
    .from("leave_requests")
    .select("id, staff_id, leave_type, start_date, requested_at, staff(full_name, department_id)")
    .eq("status", "pending")
    .lt("requested_at", cutoff);

  if (!staleLeaves?.length) {
    return new Response(JSON.stringify({ escalated: 0, message: "No stale requests" }));
  }

  let escalated = 0;
  for (const req of staleLeaves) {
    const staff = req.staff as { full_name: string; department_id: string } | null;
    if (!staff?.department_id) continue;

    // Find the HOD for this department
    const { data: hodRole } = await supabase
      .from("user_roles")
      .select("*, staff!inner(id, full_name)")
      .eq("role", "department_head")
      .eq("department_id", staff.department_id)
      .limit(1)
      .single();

    if (!hodRole?.staff) continue;

    // Post a message to the HOD
    const { data: message } = await supabase.from("messages").insert({
      sender_id: req.staff_id,
      subject: `⏰ Leave request pending 48hrs — action required`,
      body: `A leave request from ${staff.full_name} for ${req.leave_type} (from ${req.start_date}) has been awaiting your approval for over ${STALE_HOURS} hours. Please review it immediately in the MedRota leave dashboard.`,
      message_type: "direct",
    }).select().single();

    if (message) {
      await supabase.from("message_recipients").insert({
        message_id: message.id,
        staff_id: hodRole.staff.id,
      });
    }

    // Log the escalation in audit_log
    await supabase.from("audit_log").insert({
      action: "leave_escalated",
      entity_type: "leave_request",
      entity_id: req.id,
      new_value: { escalated_after_hours: STALE_HOURS, hod_staff_id: hodRole.staff.id },
    });

    escalated++;
  }

  return new Response(JSON.stringify({ escalated, total_stale: staleLeaves.length }));
});
```

### 3b. Cron Schedule — add to `supabase/config.toml`

```toml
[functions.escalate-leaves]
verify_jwt = false

[functions.escalate-leaves.cron]
schedule = "0 */6 * * *"
```

### 3c. Deploy instructions (add to README.md)

```md
## Deploying Edge Functions

```bash
npx supabase functions deploy escalate-leaves
```

To test locally:
```bash
npx supabase functions serve escalate-leaves
curl http://localhost:54321/functions/v1/escalate-leaves
```
```

---

## FEATURE 4 — LOCUM SHIFT REQUEST BOARD

### 4a. Migration: `supabase/migrations/009_locum_board.sql`

```sql
create table if not exists public.locum_shifts (
  id              uuid primary key default gen_random_uuid(),
  department_id   uuid references public.departments(id) on delete cascade,
  shift_date      date not null,
  shift_code      text not null,
  requirements    text,
  status          text default 'open'
    check (status in ('open', 'filled', 'cancelled')),
  filled_by       uuid references public.staff(id) on delete set null,
  posted_by       uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now()
);

create index locum_shifts_dept_date_idx on public.locum_shifts(department_id, shift_date);
create index locum_shifts_status_idx    on public.locum_shifts(status);

alter table public.locum_shifts enable row level security;

-- All authenticated users can see open shifts
create policy "Auth users read open locum shifts"
  on public.locum_shifts for select to authenticated
  using (status = 'open' or posted_by = auth.uid() or
    exists (select 1 from public.user_roles where user_id = auth.uid()
            and role in ('admin','hr_officer','department_head')));

-- HOD/Admin can post shifts
create policy "HOD and admin post locum shifts"
  on public.locum_shifts for insert to authenticated
  with check (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin','hr_officer','department_head')
  ));

-- HOD/Admin can update (cancel, fill)
create policy "HOD and admin manage locum shifts"
  on public.locum_shifts for update to authenticated
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin','hr_officer','department_head')
  ) or filled_by in (select id from public.staff where user_id = auth.uid()));
```

### 4b. Prisma Model — add to `prisma/schema.prisma`

```prisma
model LocumShift {
  id            String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  department_id String?     @db.Uuid
  shift_date    DateTime    @db.Date
  shift_code    String
  requirements  String?
  status        String      @default("open")
  filled_by     String?     @db.Uuid
  posted_by     String?     @db.Uuid
  created_at    DateTime    @default(now()) @db.Timestamptz(6)
  department    Department? @relation(fields: [department_id], references: [id], onDelete: Cascade)
  filled_staff  Staff?      @relation("LocumFilled", fields: [filled_by], references: [id])

  @@map("locum_shifts")
  @@schema("public")
}
```

Add `locum_shifts_filled LocumShift[] @relation("LocumFilled")` to the `Staff` model.
Add `locum_shifts LocumShift[]` to the `Department` model.

### 4c. New Type — add to `src/lib/types/index.ts`

```ts
export interface LocumShift {
  id: UUID;
  department_id: UUID | null;
  shift_date: string;
  shift_code: string;
  requirements: string | null;
  status: "open" | "filled" | "cancelled";
  filled_by: UUID | null;
  posted_by: UUID | null;
  created_at: string;
  department?: Department | null;
  filled_staff?: Staff | null;
}
```

### 4d. Serializer — add to `src/lib/actions/serializers.ts`

```ts
type DbLocumShift = Omit<LocumShift, "status" | "shift_date" | "created_at" | "department" | "filled_staff"> & {
  status: string;
  shift_date: Dateish;
  created_at: Dateish;
  department?: DbDepartment | null;
  filled_staff?: DbStaff | null;
};

export function serializeLocumShift(shift: DbLocumShift): LocumShift {
  return {
    ...shift,
    status: shift.status as LocumShift["status"],
    shift_date: dateOnly(shift.shift_date),
    created_at: dateTime(shift.created_at) ?? "",
    department: shift.department ? serializeDepartment(shift.department) : undefined,
    filled_staff: shift.filled_staff ? serializeStaff(shift.filled_staff) : undefined,
  };
}
```

### 4e. Server Action — create `src/lib/actions/locum.ts`

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeLocumShift } from "@/lib/actions/serializers";
import { logAudit } from "@/lib/actions/audit";

function toDate(v: string) { return new Date(`${v}T00:00:00.000Z`); }

export async function getLocumShifts(status?: "open" | "filled" | "cancelled") {
  try {
    const shifts = await prisma.locumShift.findMany({
      where: { ...(status ? { status } : {}) },
      include: { department: true, filled_staff: true },
      orderBy: { shift_date: "asc" },
    });
    return shifts.map(serializeLocumShift);
  } catch { return []; }
}

export async function postLocumShift(data: {
  department_id: string;
  shift_date: string;
  shift_code: string;
  requirements?: string;
  posted_by: string;
}) {
  try {
    const shift = await prisma.locumShift.create({
      data: { ...data, shift_date: toDate(data.shift_date) },
      include: { department: true },
    });
    await logAudit({ action: "locum_shift_posted", entity_type: "locum_shift", entity_id: shift.id });
    revalidatePath("/dashboard/locum-board");
    return serializeLocumShift(shift);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to post shift" };
  }
}

export async function acceptLocumShift(shiftId: string, staffId: string) {
  try {
    const shift = await prisma.locumShift.update({
      where: { id: shiftId },
      data: { status: "filled", filled_by: staffId },
      include: { department: true, filled_staff: true },
    });
    await logAudit({
      action: "locum_shift_accepted",
      entity_type: "locum_shift",
      entity_id: shiftId,
      new_value: { staff_id: staffId },
    });
    revalidatePath("/dashboard/locum-board");
    return serializeLocumShift(shift);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to accept shift" };
  }
}

export async function cancelLocumShift(id: string) {
  try {
    const shift = await prisma.locumShift.update({
      where: { id },
      data: { status: "cancelled" },
      include: { department: true },
    });
    revalidatePath("/dashboard/locum-board");
    return serializeLocumShift(shift);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to cancel shift" };
  }
}
```

### 4f. Locum Board Page — `src/app/dashboard/locum-board/page.tsx`

Build a two-panel page:
- **Left panel:** "Open Shifts" — cards showing dept, date, shift type, requirements, "Accept" button (for locum staff) or "Cancel" button (for HOD/Admin). Use Realtime subscription to auto-update when shifts are accepted.
- **Right panel (HOD/Admin only):** "Post New Shift" form — department select, date, shift type, requirements textarea, Post button.
- A "Filled" tab showing recently filled locum shifts with who filled them.

Add to both `HRSidebar.tsx` and `HODSidebar.tsx` (from the previous portal prompt):
```ts
{ href: "/dashboard/locum-board", label: "Locum Board", icon: UserCheck },
```

---

## FEATURE 5 — ROSTER E-SIGNATURE WORKFLOW

### 5a. Migration: `supabase/migrations/010_esignature.sql`

```sql
alter table public.rosters
  add column if not exists signatures   jsonb    default '[]'::jsonb,
  add column if not exists hod_signed_at       timestamptz,
  add column if not exists hod_signed_by       uuid references auth.users(id) on delete set null,
  add column if not exists director_signed_at  timestamptz,
  add column if not exists director_signed_by  uuid references auth.users(id) on delete set null;

-- New status values including signature steps
-- Extend: draft → submitted → hod_signed → director_signed → published
```

Update the `Roster` type status union in `src/lib/types/index.ts`:
```ts
export type RosterStatus =
  | "draft"
  | "submitted"
  | "hod_signed"
  | "director_signed"
  | "published";
```

### 5b. Prisma Schema Update

In the `Roster` model, add:
```prisma
signatures          Json?     @default("[]")
hod_signed_at       DateTime? @db.Timestamptz(6)
hod_signed_by       String?   @db.Uuid
director_signed_at  DateTime? @db.Timestamptz(6)
director_signed_by  String?   @db.Uuid
```

### 5c. New Server Action — add to `src/lib/actions/rosters.ts`

```ts
export async function signRoster(
  id: string,
  signerRole: "hod" | "director",
  signerUserId: string,
  signerName: string
) {
  try {
    const existing = await prisma.roster.findUnique({ where: { id } });
    if (!existing) return { error: "Roster not found" };

    const validTransitions: Record<string, string> = {
      hod:      "hod_signed",
      director: "director_signed",
    };

    const newStatus = validTransitions[signerRole];
    if (!newStatus) return { error: "Invalid signer role" };

    const existingSigs = (existing.signatures as SignatureEntry[] | null) ?? [];
    const newSig: SignatureEntry = {
      role: signerRole,
      name: signerName,
      user_id: signerUserId,
      signed_at: new Date().toISOString(),
    };

    const roster = await prisma.roster.update({
      where: { id },
      data: {
        status: newStatus,
        signatures: [...existingSigs, newSig],
        ...(signerRole === "hod"
          ? { hod_signed_at: new Date(), hod_signed_by: signerUserId }
          : { director_signed_at: new Date(), director_signed_by: signerUserId }),
      },
    });

    await logAudit({
      action: `roster_${newStatus}`,
      entity_type: "roster",
      entity_id: id,
      new_value: { signed_by: signerName, role: signerRole },
    });

    revalidatePath("/dashboard/rosters");
    return serializeRoster(roster);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to sign roster" };
  }
}

interface SignatureEntry {
  role: string;
  name: string;
  user_id: string;
  signed_at: string;
}
```

### 5d. Signature Block in PDF Export

In `src/lib/utils/export.ts`, after the shift legend at the bottom of the PDF, add a signature block:

```ts
// After autoTable call, add signature block
const sigY = (doc as any).lastAutoTable.finalY + 15;
doc.setFontSize(9);
doc.setFont("helvetica", "bold");
doc.text("AUTHORISATION", 14, sigY);

const signatures = (roster.signatures ?? []) as { role: string; name: string; signed_at: string }[];

const hodSig = signatures.find(s => s.role === "hod");
const dirSig = signatures.find(s => s.role === "director");

doc.setFont("helvetica", "normal");
doc.setFontSize(8);

// HOD signature box
doc.rect(14, sigY + 5, 80, 20);
doc.text("Department Head:", 16, sigY + 12);
doc.setFont("helvetica", "bold");
doc.text(hodSig?.name ?? "___________________", 16, sigY + 18);
doc.setFont("helvetica", "normal");
doc.text(hodSig?.signed_at ? new Date(hodSig.signed_at).toLocaleDateString() : "Date: ___________", 16, sigY + 23);

// Director signature box
doc.rect(104, sigY + 5, 80, 20);
doc.text("Medical Director:", 106, sigY + 12);
doc.setFont("helvetica", "bold");
doc.text(dirSig?.name ?? "___________________", 106, sigY + 18);
doc.setFont("helvetica", "normal");
doc.text(dirSig?.signed_at ? new Date(dirSig.signed_at).toLocaleDateString() : "Date: ___________", 106, sigY + 23);
```

### 5e. Update RosterToolbar to show sign buttons

In `RosterWorkspace.tsx`, add `onSign` prop and pass it to the toolbar. In `RosterToolbar.tsx`, show contextual sign buttons based on status:

```tsx
{status === "submitted" && userRole === "department_head" && (
  <Button size="sm" onClick={() => onSign?.("hod")}
    className="bg-[#1A2B4A] text-white">
    <PenLine className="h-4 w-4 mr-1" /> Sign as HOD
  </Button>
)}
{status === "hod_signed" && userRole === "medical_director" && (
  <Button size="sm" onClick={() => onSign?.("director")}
    className="bg-[#1A2B4A] text-white">
    <PenLine className="h-4 w-4 mr-1" /> Director Sign-off
  </Button>
)}
{status === "director_signed" && (userRole === "admin" || userRole === "hr_officer") && (
  <Button size="sm" onClick={() => onStatusChange?.("published")}
    className="bg-emerald-600 text-white">
    <CheckCircle className="h-4 w-4 mr-1" /> Publish
  </Button>
)}
```

---

## FEATURE 6 — REAL-TIME NOTIFICATIONS (Supabase Realtime)

### 6a. Notification Table — `supabase/migrations/011_notifications.sql`

```sql
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

create index notifications_staff_unread_idx on public.notifications(staff_id, is_read);

alter table public.notifications enable row level security;

create policy "Staff read own notifications"
  on public.notifications for select to authenticated
  using (staff_id in (select id from public.staff where user_id = auth.uid()));

create policy "Staff mark own notifications read"
  on public.notifications for update to authenticated
  using (staff_id in (select id from public.staff where user_id = auth.uid()));

-- Enable realtime on notifications
alter publication supabase_realtime add table public.notifications;
```

### 6b. Prisma Model — add to `prisma/schema.prisma`

```prisma
model Notification {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  staff_id   String?   @db.Uuid
  title      String
  body       String?
  type       String    @default("info")
  is_read    Boolean   @default(false)
  read_at    DateTime? @db.Timestamptz(6)
  link       String?
  created_at DateTime  @default(now()) @db.Timestamptz(6)
  staff      Staff?    @relation(fields: [staff_id], references: [id], onDelete: Cascade)

  @@map("notifications")
  @@schema("public")
}
```

Add `notifications Notification[]` to the `Staff` model.

### 6c. New Type — add to `src/lib/types/index.ts`

```ts
export interface Notification {
  id: UUID;
  staff_id: UUID | null;
  title: string;
  body: string | null;
  type: "info" | "success" | "warning" | "error" | "leave" | "roster" | "swap" | "message";
  is_read: boolean;
  read_at: string | null;
  link: string | null;
  created_at: string;
}
```

### 6d. Server Action — create `src/lib/actions/notifications.ts`

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type DbNotif = Omit<import("@/lib/types").Notification, "type" | "created_at" | "read_at"> & {
  type: string; created_at: Date; read_at: Date | null;
};

function serializeNotification(n: DbNotif): import("@/lib/types").Notification {
  return {
    ...n,
    type: n.type as import("@/lib/types").Notification["type"],
    created_at: n.created_at.toISOString(),
    read_at: n.read_at?.toISOString() ?? null,
  };
}

export async function createNotification(data: {
  staff_id: string;
  title: string;
  body?: string;
  type?: string;
  link?: string;
}) {
  try {
    return await prisma.notification.create({ data });
  } catch { /* silent */ }
}

export async function getNotifications(staffId: string, unreadOnly = false) {
  try {
    const notifs = await prisma.notification.findMany({
      where: { staff_id: staffId, ...(unreadOnly ? { is_read: false } : {}) },
      orderBy: { created_at: "desc" },
      take: 50,
    });
    return notifs.map(serializeNotification);
  } catch { return []; }
}

export async function markNotificationRead(id: string) {
  try {
    await prisma.notification.update({
      where: { id },
      data: { is_read: true, read_at: new Date() },
    });
    revalidatePath("/dashboard");
  } catch { /* silent */ }
}

export async function markAllNotificationsRead(staffId: string) {
  try {
    await prisma.notification.updateMany({
      where: { staff_id: staffId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
    revalidatePath("/dashboard");
  } catch { /* silent */ }
}
```

### 6e. Wire notifications into key actions

Call `createNotification` in:

- **`leave.ts` — `reviewLeaveRequest`:** notify the staff member their leave was approved/rejected
  ```ts
  if (staffRecord?.id) {
    await createNotification({
      staff_id: staffRecord.id,
      title: status === "approved" ? "Leave Approved ✅" : "Leave Rejected",
      body: `Your ${leave.leave_type} request has been ${status}.`,
      type: status === "approved" ? "success" : "error",
      link: "/dashboard/my-leave",
    });
  }
  ```

- **`rosters.ts` — `updateRosterStatus` when status = "published":** notify all staff in that department
  ```ts
  if (status === "published") {
    const deptStaff = await prisma.staff.findMany({ where: { department_id: roster.department_id ?? undefined } });
    await Promise.all(deptStaff.map(s => createNotification({
      staff_id: s.id,
      title: "New Roster Published 📅",
      body: `The ${roster.department?.name} roster for ${monthNames[roster.month - 1]} ${roster.year} is now available.`,
      type: "roster",
      link: `/dashboard/my-schedule`,
    })));
  }
  ```

- **`swaps.ts` — `reviewSwap`:** notify both parties of swap decision

### 6f. Notification Bell in Header — `src/components/layout/Header.tsx`

Add a real-time notification bell with unread count badge:

```tsx
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell } from "lucide-react";
import type { Notification } from "@/lib/types";

export function NotificationBell({ staffId }: { staffId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Initial fetch
    fetch(`/api/notifications?staffId=${staffId}`)
      .then(r => r.json())
      .then(setNotifications);

    // Realtime subscription
    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `staff_id=eq.${staffId}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [staffId]);

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative rounded-full p-2 hover:bg-slate-100">
        <Bell className="h-5 w-5 text-slate-600" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-700">Notifications</h3>
            {unread > 0 && (
              <button className="text-xs text-[#2E86AB] hover:underline"
                onClick={() => { /* markAllNotificationsRead(staffId) */ }}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 divide-y divide-slate-50 overflow-y-auto">
            {notifications.slice(0, 10).map((n) => (
              <div key={n.id}
                className={`flex gap-3 px-4 py-3 text-sm ${n.is_read ? "bg-white" : "bg-blue-50/40"}`}>
                <div className="flex-1">
                  <p className={`font-medium ${n.is_read ? "text-slate-600" : "text-slate-800"}`}>
                    {n.title}
                  </p>
                  {n.body && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="mt-1 text-xs text-slate-300">
                    {new Date(n.created_at).toLocaleTimeString()}
                  </p>
                </div>
                {!n.is_read && (
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2E86AB]" />
                )}
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No notifications
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

Also create `/src/app/api/notifications/route.ts` for the initial fetch:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getNotifications } from "@/lib/actions/notifications";

export async function GET(req: NextRequest) {
  const staffId = req.nextUrl.searchParams.get("staffId");
  if (!staffId) return NextResponse.json([]);
  const notifications = await getNotifications(staffId, false);
  return NextResponse.json(notifications);
}
```

---

## PART 8 — FINAL CHECKLIST

### Feature 1 — Audit Trail
- [ ] Migration `007_audit_trail.sql` written
- [ ] `AuditLog` Prisma model added
- [ ] `AuditLog` type added to `types/index.ts`
- [ ] `serializeAuditLog` added to `serializers.ts`
- [ ] `src/lib/actions/audit.ts` created (`logAudit`, `getAuditLogs`)
- [ ] `logAudit` called in: `updateRosterStatus`, `reviewLeaveRequest`, `createStaff`, `updateStaff`, `updateRosterEntry`
- [ ] `/dashboard/audit` page built with styled log table
- [ ] "Audit Trail" added to `HRSidebar` nav

### Feature 2 — Payroll & Allowances
- [ ] Migration `008_payroll.sql` written with seed rates
- [ ] `AllowanceRate` + `PayrollSummary` Prisma models added
- [ ] Types added to `types/index.ts`
- [ ] Serializers added (including `Decimal` import)
- [ ] `src/lib/actions/payroll.ts` created with all 5 functions
- [ ] `/dashboard/payroll` page built with summary cards + table
- [ ] `PayrollTable` component with Excel export
- [ ] "Payroll" added to `HRSidebar` nav

### Feature 3 — Escalation Engine
- [ ] `supabase/functions/escalate-leaves/index.ts` created
- [ ] Cron schedule added to `supabase/config.toml`
- [ ] Deploy instructions added to `README.md`

### Feature 4 — Locum Board
- [ ] Migration `009_locum_board.sql` written
- [ ] `LocumShift` Prisma model added + Staff/Department relations updated
- [ ] `LocumShift` type added
- [ ] `serializeLocumShift` added
- [ ] `src/lib/actions/locum.ts` created
- [ ] `/dashboard/locum-board` page built (open shifts + post shift form)
- [ ] "Locum Board" added to `HRSidebar` + `HODSidebar`

### Feature 5 — E-Signature
- [ ] Migration `010_esignature.sql` written
- [ ] Roster Prisma model updated with 4 new fields
- [ ] `RosterStatus` type updated with `hod_signed` + `director_signed`
- [ ] `signRoster` server action added to `rosters.ts`
- [ ] `RosterToolbar` shows contextual sign buttons by role/status
- [ ] Signature block added to PDF export

### Feature 6 — Real-Time Notifications
- [ ] Migration `011_notifications.sql` with Realtime enabled
- [ ] `Notification` Prisma model added + Staff relation updated
- [ ] `Notification` type added
- [ ] `src/lib/actions/notifications.ts` created
- [ ] `createNotification` called in `reviewLeaveRequest`, `updateRosterStatus`, `reviewSwap`
- [ ] `NotificationBell` client component built with Realtime subscription
- [ ] `/api/notifications` route created
- [ ] `NotificationBell` added to `Header.tsx`

### Final
- [ ] `npx prisma db push` runs successfully for all new models
- [ ] `npx prisma generate` runs successfully
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] No `any` types anywhere in new code
