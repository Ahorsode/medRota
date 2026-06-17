# MedRota — Staff Portal & HOD Dashboard Build Prompt
### New Role-Based Interfaces: Staff, Department Head (HOD)

---

## OVERVIEW

MedRota currently has one interface designed for HR/Admin. This phase splits the experience into **three distinct portals** based on the authenticated user's role:

| Role | Portal | Access |
|------|--------|--------|
| `admin` / `hr_officer` | **HR Dashboard** (current) | All departments, all staff, full control |
| `department_head` | **HOD Dashboard** (new) | Own department only, first-level approvals |
| `doctor` / `nurse` / `staff` | **Staff Portal** (new) | Own data only, self-service |
| `medical_director` | **Director View** (new) | Read-only hospital-wide, countersign rosters |

---

## PART 1 — ROLE DETECTION ARCHITECTURE

### 1. Create a role resolver at `/src/lib/auth/getSessionUser.ts`

This is a server-side helper used by every layout and page to determine who is logged in and what they can see.

```ts
// src/lib/auth/getSessionUser.ts
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;            // auth.users UUID
  email: string;
  role: "admin" | "hr_officer" | "department_head" | "doctor" | "nurse" | "medical_director" | "staff";
  staffRecord: {
    id: string;
    full_name: string;
    rank: string | null;
    position: string | null;
    department_id: string;
    department_name: string;
    employment_type: string | null;
    phone: string | null;
    email: string | null;
    staff_number: string;
  } | null;
  departmentId: string | null;   // for HOD: the dept they manage
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch role from user_roles table
  const userRole = await prisma.userRole.findFirst({
    where: { user_id: user.id },
    include: { department: true },
    orderBy: { id: "asc" },
  });

  // Fetch staff record linked to this user
  const staffRecord = await prisma.staff.findFirst({
    where: { user_id: user.id },
    include: { department: true },
  });

  return {
    id: user.id,
    email: user.email ?? "",
    role: (userRole?.role ?? "staff") as SessionUser["role"],
    staffRecord: staffRecord
      ? {
          id: staffRecord.id,
          full_name: staffRecord.full_name,
          rank: staffRecord.rank,
          position: staffRecord.position,
          department_id: staffRecord.department_id,
          department_name: staffRecord.department.name,
          employment_type: staffRecord.employment_type,
          phone: staffRecord.phone,
          email: staffRecord.email,
          staff_number: staffRecord.staff_number,
        }
      : null,
    departmentId: userRole?.department_id ?? staffRecord?.department_id ?? null,
  };
}
```

### 2. Update Dashboard Root Layout `/src/app/dashboard/layout.tsx`

The layout must detect role and render the correct sidebar variant:

```tsx
// src/app/dashboard/layout.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { SidebarProvider } from "@/lib/context/sidebar";
import { HRSidebar } from "@/components/layout/HRSidebar";
import { HODSidebar } from "@/components/layout/HODSidebar";
import { StaffSidebar } from "@/components/layout/StaffSidebar";
import { Header } from "@/components/layout/Header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const SidebarComponent =
    user.role === "department_head"
      ? HODSidebar
      : user.role === "doctor" || user.role === "nurse" || user.role === "staff"
      ? StaffSidebar
      : HRSidebar;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <SidebarComponent user={user} />
        <div className="flex flex-1 flex-col">
          <Header user={user} />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
```

### 3. Rename current Sidebar to `HRSidebar`

Rename `/src/components/layout/Sidebar.tsx` → `/src/components/layout/HRSidebar.tsx`. Keep all existing nav items exactly as they are. Update all imports.

---

## PART 2 — HOD (DEPARTMENT HEAD) DASHBOARD

### HOD Sidebar — `/src/components/layout/HODSidebar.tsx`

Same structure as `HRSidebar` but with a filtered nav. HOD only sees their own department data:

```ts
const hodNavItems = [
  { href: "/dashboard", label: "My Department", icon: LayoutDashboard },
  { href: "/dashboard/rosters", label: "Duty Roster", icon: CalendarDays },
  { href: "/dashboard/staff", label: "My Staff", icon: Users },
  { href: "/dashboard/leave", label: "Leave Requests", icon: CalendarOff },
  { href: "/dashboard/swaps", label: "Shift Swaps", icon: ArrowLeftRight },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  { href: "/dashboard/handover", label: "Handover Reports", icon: BookOpenCheck },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/reports", label: "Department Reports", icon: BarChart3 },
];
```

Add the user's department name as a badge below the MedRota logo: `"Managing: OPD"` etc.

---

### HOD Dashboard Page — `/src/app/dashboard/page.tsx`

The existing dashboard page must branch based on role. Refactor it:

```tsx
// src/app/dashboard/page.tsx
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { HRDashboard } from "@/components/dashboard/HRDashboard";
import { HODDashboard } from "@/components/dashboard/HODDashboard";
import { StaffDashboard } from "@/components/dashboard/StaffDashboard";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;

  if (user.role === "department_head" || user.role === "medical_director") {
    return <HODDashboard user={user} />;
  }
  if (user.role === "doctor" || user.role === "nurse" || user.role === "staff") {
    return <StaffDashboard user={user} />;
  }
  return <HRDashboard user={user} />;
}
```

---

### HOD Dashboard Component — `/src/components/dashboard/HODDashboard.tsx`

```tsx
"use server"; // can be async RSC

import { getStaff } from "@/lib/actions/staff";
import { getLeaveRequests } from "@/lib/actions/leave";
import { getRosters } from "@/lib/actions/rosters";
import { getAttendanceRecords } from "@/lib/actions/attendance";
import type { SessionUser } from "@/lib/auth/getSessionUser";
```

**Widgets to show (all filtered to HOD's department):**

| Widget | Data | Visual |
|--------|------|--------|
| **Active Staff** | Count from `getStaff(departmentId)` | Number card with dept name |
| **On Duty Today** | Count of entries with today's date and code M/A/N | Number card, green |
| **On Leave Today** | Count of LEAVE entries for today | Number card, purple |
| **Pending Leave Requests** | `getLeaveRequests` filtered to dept + `status: "pending_hod"` | Amber card with count, clickable |
| **This Month's Roster** | Status badge for current month's roster | Card with Draft/Submitted/Approved/Published badge |
| **Absent Today** | Attendance records with `status: "absent"` | Red card with count |
| **Pending Shift Swaps** | Count of pending swaps involving dept staff | Number card |
| **Upcoming Night Shifts** | Staff assigned N shift in next 7 days | Small list |

**Quick Actions panel (below widgets):**
- "Create/Edit Roster" → navigates to `/dashboard/rosters`
- "Approve Pending Leaves" → navigates to `/dashboard/leave`
- "Write Handover Report" → navigates to `/dashboard/handover`
- "Broadcast Message to Dept" → opens compose message dialog inline

---

### Department-Scoped Data Filtering

Every existing page must filter data by department when the logged-in user is a HOD. The cleanest way is to pass `departmentId` from the server layout or page into the server actions.

**Update each page to accept a dept filter from session:**

```tsx
// Example: src/app/dashboard/staff/page.tsx
export default async function StaffPage() {
  const user = await getSessionUser();
  const deptFilter = user?.role === "department_head" ? user.departmentId ?? undefined : undefined;
  const staff = await getStaff(deptFilter);
  // ...
}
```

Apply the same `deptFilter` pattern to: `leave/page.tsx`, `swaps/page.tsx`, `attendance/page.tsx`, `handover/page.tsx`, `rosters/page.tsx`, `reports/page.tsx`.

---

## PART 3 — LEAVE APPROVAL: TWO-STAGE WORKFLOW

The current system has one approval step. The new flow is:

```
Staff submits → status: "pending_hod"
HOD approves  → status: "pending_hr"
HR confirms   → status: "approved"
              OR
HOD rejects   → status: "rejected_hod"
HR rejects    → status: "rejected_hr"
```

### 3a. Update the database

Add a migration `supabase/migrations/006_two_stage_leave.sql`:

```sql
-- Extend leave status to support two-stage approval
alter table public.leave_requests
  add column if not exists hod_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists hod_reviewed_at timestamptz,
  add column if not exists hod_notes text;

-- Drop old status constraint and add new one
alter table public.leave_requests
  drop constraint if exists leave_requests_status_check;

alter table public.leave_requests
  add constraint leave_requests_status_check
  check (status in (
    'pending_hod',
    'pending_hr',
    'approved',
    'rejected_hod',
    'rejected_hr'
  ));

-- Update existing pending records to new status name
update public.leave_requests set status = 'pending_hod' where status = 'pending';
```

Update Prisma schema — in the `LeaveRequest` model comment update the status field:
```prisma
// status: pending_hod | pending_hr | approved | rejected_hod | rejected_hr
status  String  @default("pending_hod")
```

### 3b. Update `/src/lib/actions/leave.ts`

Add an HOD review action:

```ts
export async function hodReviewLeave(
  id: string,
  decision: "approve" | "reject",
  hodUserId: string,
  notes?: string
) {
  try {
    const newStatus = decision === "approve" ? "pending_hr" : "rejected_hod";
    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: newStatus,
        hod_reviewed_by: hodUserId,
        hod_reviewed_at: new Date(),
        hod_notes: notes ?? null,
      },
    });
    revalidatePath("/dashboard/leave");
    return serializeLeaveRequest(leave);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "HOD review failed" };
  }
}
```

Update `reviewLeaveRequest` (HR action) to only allow confirmation of `pending_hr` status:

```ts
export async function reviewLeaveRequest(
  id: string,
  status: "approved" | "rejected_hr",
  reviewedBy: string,
  notes?: string
) {
  // Guard: HR can only act on requests already approved by HOD
  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing) return { error: "Leave request not found" };
  if (existing.status !== "pending_hr" && status === "approved") {
    return { error: "This request must be reviewed by the department head first" };
  }
  // ... rest of update
}
```

### 3c. Update Leave Page for HOD view

When the user is a HOD, the Leave page must show requests with `status: "pending_hod"` prominently (top of list, highlighted amber). Show two action buttons: **"Approve → HR"** (calls `hodReviewLeave(id, "approve", userId)`) and **"Reject"** (calls `hodReviewLeave(id, "reject", userId, notes)`).

When the user is HR, show requests with `status: "pending_hr"` at the top for final confirmation.

Show the approval trail in a timeline below each leave card:
```
● Staff submitted         [June 12, 2026 09:14]
● HOD approved (pending HR confirmation) [June 12, 2026 11:30]
○ HR confirmation         [pending]
```

---

## PART 4 — STAFF PORTAL

### Staff Sidebar — `/src/components/layout/StaffSidebar.tsx`

Minimal navigation — staff only see their own data:

```ts
const staffNavItems = [
  { href: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/my-schedule", label: "My Schedule", icon: CalendarDays },
  { href: "/dashboard/my-leave", label: "My Leave", icon: CalendarOff },
  { href: "/dashboard/my-swaps", label: "Shift Swaps", icon: ArrowLeftRight },
  { href: "/dashboard/my-attendance", label: "My Attendance", icon: Clock },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/my-profile", label: "My Profile", icon: UserCircle },
];
```

---

### Staff Dashboard — `/src/components/dashboard/StaffDashboard.tsx`

A clean, mobile-first dashboard showing only the current staff member's data.

**Top section — Identity card:**
```
┌─────────────────────────────────────────────┐
│  👤  Rosemond Opoku                          │
│  SNO · OPD Department                        │
│  Staff No. 0042 · Full-time                  │
│  📅 Today: MORNING SHIFT  07:30 – 14:00      │
└─────────────────────────────────────────────┘
```

**Widget row:**
| Widget | Data |
|--------|------|
| **Shifts This Month** | Count of M + A + N entries for current month |
| **Days Off This Month** | Count of O entries |
| **Leave Balance** | `annualLeaveEntitlement - leaveUsedThisYear` |
| **Pending Requests** | Count of their own pending leave/swap requests |

**This Week's Schedule** (below widgets):
A horizontal 7-day strip showing Mon–Sun with the shift badge for each day:
```
MON    TUE    WED    THU    FRI    SAT    SUN
[M]    [M]    [A]    [O]    [M]    [O]    [O]
07:30  07:30  14:00         07:30
```

**Recent Notifications** (bottom):
- "Your leave request was approved by HOD — awaiting HR confirmation"
- "New roster published for July 2026"
- "Shift swap request from Alice Amo-Nuadu"

---

### Staff Schedule Page — `/src/app/dashboard/my-schedule/page.tsx`

A **read-only** monthly roster view showing only the logged-in staff member's entries.

Layout: Full-width calendar grid for the current month (default) with a month navigator (prev/next arrows).

Each day cell shows:
- The shift code badge (M/A/N/O/H/LEAVE) with full colour coding
- The shift hours below the badge (e.g. "07:30 – 14:00")
- If LEAVE: the leave type ("Annual Leave", "Sick Leave") in purple

Month summary strip at the bottom:
```
Morning: 16   Afternoon: 8   Night: 4   Off: 2   Leave: 0
```

```tsx
// src/app/dashboard/my-schedule/page.tsx
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { redirect } from "next/navigation";
import { getRosterEntriesForStaff } from "@/lib/actions/rosters";
import { MyScheduleCalendar } from "@/components/staff/MyScheduleCalendar";

export default async function MySchedulePage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const user = await getSessionUser();
  if (!user?.staffRecord) redirect("/dashboard");

  const now = new Date();
  const month = Number(searchParams.month ?? now.getMonth() + 1);
  const year = Number(searchParams.year ?? now.getFullYear());

  const entries = await getRosterEntriesForStaff(user.staffRecord.id, year, month);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">My Schedule</h1>
        <p className="text-sm text-slate-500">Your duty roster for {monthNames[month - 1]} {year}</p>
      </div>
      <MyScheduleCalendar entries={entries} month={month} year={year} staffId={user.staffRecord.id} />
    </div>
  );
}
```

Add the server action `getRosterEntriesForStaff` to `/src/lib/actions/rosters.ts`:
```ts
export async function getRosterEntriesForStaff(staffId: string, year: number, month: number) {
  try {
    const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`);
    const monthEnd = new Date(new Date(monthStart).setMonth(monthStart.getMonth() + 1) - 1);
    const entries = await prisma.rosterEntry.findMany({
      where: {
        staff_id: staffId,
        shift_date: { gte: monthStart, lte: monthEnd },
      },
      include: { shift_config: true },
      orderBy: { shift_date: "asc" },
    });
    return entries.map(serializeRosterEntry);
  } catch {
    return [];
  }
}
```

---

### MyScheduleCalendar Component — `/src/components/staff/MyScheduleCalendar.tsx`

```tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMonthDays } from "@/lib/utils/dates";
import type { RosterEntry } from "@/lib/types";

const SHIFT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  M:     { bg: "bg-blue-100",   text: "text-blue-700",   label: "Morning" },
  A:     { bg: "bg-amber-100",  text: "text-amber-700",  label: "Afternoon" },
  N:     { bg: "bg-indigo-100", text: "text-indigo-700", label: "Night" },
  O:     { bg: "bg-slate-100",  text: "text-slate-500",  label: "Off Day" },
  H:     { bg: "bg-orange-100", text: "text-orange-700", label: "Holiday" },
  LEAVE: { bg: "bg-purple-100", text: "text-purple-700", label: "Leave" },
  "%":   { bg: "bg-slate-100",  text: "text-slate-400",  label: "Off" },
};

export function MyScheduleCalendar({ entries, month, year }: {
  entries: RosterEntry[]; month: number; year: number; staffId: string;
}) {
  const router = useRouter();
  const days = getMonthDays(year, month);
  const entryMap = new Map(entries.map((e) => [e.shift_date.slice(0, 10), e]));

  const counts = { M: 0, A: 0, N: 0, O: 0, LEAVE: 0 };
  for (const e of entries) {
    if (e.shift_code in counts) counts[e.shift_code as keyof typeof counts]++;
  }

  function navigate(dir: -1 | 1) {
    let m = month + dir;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    router.push(`/dashboard/my-schedule?month=${m}&year=${y}`);
  }

  const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const firstDayOfWeek = new Date(`${year}-${String(month).padStart(2, "0")}-01`).getDay();

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-[#0F172A]">
          {new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h2>
        <Button variant="outline" size="sm" onClick={() => navigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Day of week headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAYS_OF_WEEK.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {/* Empty cells for first week offset */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24 border-b border-r border-slate-50" />
          ))}

          {days.map((day) => {
            const entry = entryMap.get(day.iso);
            const code = entry?.shift_code ?? "O";
            const style = SHIFT_STYLES[code] ?? SHIFT_STYLES.O;
            const isToday = day.iso === new Date().toISOString().slice(0, 10);

            return (
              <div
                key={day.iso}
                className={`h-24 border-b border-r border-slate-100 p-2 flex flex-col ${
                  day.isWeekend ? "bg-slate-50/60" : "bg-white"
                }`}
              >
                <span className={`text-sm font-semibold mb-1 flex h-6 w-6 items-center justify-center rounded-full ${
                  isToday ? "bg-[#1A2B4A] text-white" : "text-slate-700"
                }`}>
                  {day.dayNumber}
                </span>
                {entry ? (
                  <div className={`flex-1 rounded-md px-2 py-1 ${style.bg}`}>
                    <div className={`text-xs font-bold ${style.text}`}>{code}</div>
                    {entry.is_leave ? (
                      <div className={`text-xs ${style.text}`}>{entry.leave_type ?? "Leave"}</div>
                    ) : entry.shift_config ? (
                      <div className={`text-xs ${style.text}`}>
                        {entry.shift_config.start_time} – {entry.shift_config.end_time}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex-1 rounded-md bg-slate-50 px-2 py-1">
                    <div className="text-xs text-slate-400">O</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(counts).map(([code, count]) => {
          const style = SHIFT_STYLES[code] ?? SHIFT_STYLES.O;
          return (
            <div key={code} className={`rounded-lg border px-3 py-3 text-center ${style.bg}`}>
              <div className={`text-xl font-bold ${style.text}`}>{count}</div>
              <div className={`text-xs ${style.text}`}>{style.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### Staff Leave Page — `/src/app/dashboard/my-leave/page.tsx`

Staff see only their own leave requests and can submit new ones.

```tsx
export default async function MyLeavePage() {
  const user = await getSessionUser();
  if (!user?.staffRecord) redirect("/dashboard");

  const myLeaves = await getLeaveRequests(user.staffRecord.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">My Leave Requests</h1>
          <p className="text-sm text-slate-500">Submit and track your leave applications</p>
        </div>
        {/* Leave balance card */}
        <div className="rounded-xl border border-purple-200 bg-purple-50 px-6 py-3 text-center">
          <div className="text-2xl font-bold text-purple-700">
            {30 - myLeaves.filter(l => l.status === "approved").length}
          </div>
          <div className="text-xs text-purple-600">Leave days remaining</div>
        </div>
      </div>

      {/* Submit new leave button + drawer/dialog */}
      <StaffLeaveForm staffId={user.staffRecord.id} />

      {/* Leave history table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-700">Leave History</h2>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">From</th>
              <th className="px-4 py-3 text-left">To</th>
              <th className="px-4 py-3 text-left">Days</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">HOD Review</th>
              <th className="px-4 py-3 text-left">HR Review</th>
            </tr>
          </thead>
          <tbody>
            {myLeaves.map((leave) => {
              const days = Math.ceil(
                (new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) /
                  (1000 * 60 * 60 * 24)
              ) + 1;
              return (
                <tr key={leave.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-sm font-medium">{leave.leave_type}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(leave.start_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(leave.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">{days}</td>
                  <td className="px-4 py-3">
                    <LeaveStatusBadge status={leave.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {leave.hod_reviewed_at
                      ? new Date(leave.hod_reviewed_at).toLocaleDateString()
                      : "Awaiting"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {leave.status === "approved"
                      ? new Date(leave.reviewed_at ?? "").toLocaleDateString()
                      : leave.status === "pending_hr"
                      ? "Awaiting HR"
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### `<LeaveStatusBadge />` component

Create `/src/components/staff/LeaveStatusBadge.tsx`:

```tsx
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending_hod:  { label: "Awaiting HOD",  className: "bg-amber-100 text-amber-700" },
  pending_hr:   { label: "Awaiting HR",   className: "bg-blue-100 text-blue-700" },
  approved:     { label: "Approved",      className: "bg-emerald-100 text-emerald-700" },
  rejected_hod: { label: "Rejected by HOD", className: "bg-red-100 text-red-700" },
  rejected_hr:  { label: "Rejected by HR",  className: "bg-red-100 text-red-700" },
};

export function LeaveStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
```

---

### Staff Swap Page — `/src/app/dashboard/my-swaps/page.tsx`

Staff can see their swap requests and initiate new ones.

- List: shows swaps where they are the requester OR the replacement, with status badge
- "Request a Swap" button → opens dialog:
  - Their shift to swap (date picker from their own schedule)
  - Search for a colleague (staff autocomplete, filtered to same department)
  - The colleague's shift to swap with (auto-loaded based on their schedule for that date)
  - Reason (optional)
- If a swap is requested FROM them (they are the replacement): show "Accept" / "Decline" buttons

---

### Staff Attendance Page — `/src/app/dashboard/my-attendance/page.tsx`

Staff see their own attendance records:
- Monthly table: Date | Scheduled Shift | Clock In | Clock Out | Duration | Status
- Summary stats at top: Present X / Absent X / Late X this month
- Their own Clock In / Clock Out buttons for today's shift

---

### Staff Profile Page — `/src/app/dashboard/my-profile/page.tsx`

```tsx
export default async function MyProfilePage() {
  const user = await getSessionUser();
  if (!user?.staffRecord) redirect("/dashboard");
  const staff = await getStaffById(user.staffRecord.id);
  // ...
}
```

Sections:
1. **Personal Info** — editable fields: phone, email (self-service update via `updateStaff`)
2. **Employment Info** — read-only: rank, position, department, employment type, staff number
3. **My Qualifications / Training** — training records table (view only)
4. **My Assessments** — assessment history (view only, cannot edit own assessments)
5. **Change Password** — calls Supabase `supabase.auth.updateUser({ password: newPassword })`

---

### `StaffLeaveForm` Component — `/src/components/staff/StaffLeaveForm.tsx`

```tsx
"use client";
import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createLeaveRequest } from "@/lib/actions/leave";
import { toast } from "sonner";

const LEAVE_TYPES = [
  "Annual Leave", "Sick Leave", "Study Leave",
  "Maternity Leave", "Paternity Leave", "Compassionate Leave", "Emergency Leave"
];

export function StaffLeaveForm({ staffId }: { staffId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await createLeaveRequest({
      staff_id: staffId,
      leave_type: String(formData.get("leave_type")),
      start_date: String(formData.get("start_date")),
      end_date: String(formData.get("end_date")),
      reason: String(formData.get("reason") ?? "") || undefined,
    });
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Leave request submitted — awaiting HOD approval.");
      setOpen(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-[#1A2B4A]">
        <PlusCircle className="mr-2 h-4 w-4" />
        Request Leave
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Leave Request</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Leave Type</label>
              <select name="leave_type" required
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Start Date</label>
                <input name="start_date" type="date" required
                  className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">End Date</label>
                <input name="end_date" type="date" required
                  className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Reason (optional)</label>
              <textarea name="reason" rows={3}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Brief reason for leave..." />
            </div>
            <Button type="submit" className="w-full bg-[#1A2B4A]" disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

## PART 5 — ENTERPRISE FEATURE RECOMMENDATIONS

Build these as well — they are what separate a basic roster tool from an enterprise hospital management platform:

### 5a. Escalation Timer (Auto-escalate stale leave requests)

Create a Supabase Edge Function at `supabase/functions/escalate-leaves/index.ts`:

```ts
// Runs on a cron schedule (every 6 hours via Supabase cron)
// Finds leave requests stuck at "pending_hod" for > 48 hours
// and sends a reminder notification to the HOD

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: stale } = await supabase
    .from("leave_requests")
    .select("*, staff(full_name, department_id)")
    .eq("status", "pending_hod")
    .lt("requested_at", cutoff);

  for (const req of stale ?? []) {
    // Insert a message to the HOD of that department
    await supabase.from("messages").insert({
      sender_id: req.staff_id,
      subject: `⏰ Leave request pending for 48hrs — ${req.staff.full_name}`,
      body: `A leave request from ${req.staff.full_name} has been awaiting your approval for over 48 hours. Please review it in the MedRota leave dashboard.`,
      message_type: "department",
      department_id: req.staff.department_id,
    });
  }

  return new Response(JSON.stringify({ escalated: stale?.length ?? 0 }));
});
```

Add the cron schedule in `supabase/config.toml`:
```toml
[functions.escalate-leaves]
schedule = "0 */6 * * *"
```

### 5b. Shift Allowance Calculator

Add a `getShiftAllowanceSummary` server action:

```ts
// src/lib/actions/payroll.ts
export async function getShiftAllowanceSummary(staffId: string, year: number, month: number) {
  const ALLOWANCES = {
    N: 50,      // GHS 50 per night shift
    weekend: 30, // GHS 30 per weekend shift
    H: 80,      // GHS 80 per public holiday shift
  };

  const entries = await getRosterEntriesForStaff(staffId, year, month);

  const nightShifts = entries.filter(e => e.shift_code === "N").length;
  const holidayShifts = entries.filter(e => e.shift_code === "H").length;
  const weekendShifts = entries.filter(e => {
    const d = new Date(e.shift_date);
    return (d.getDay() === 0 || d.getDay() === 6) && e.shift_code !== "O";
  }).length;

  return {
    nightShifts,
    holidayShifts,
    weekendShifts,
    nightAllowance: nightShifts * ALLOWANCES.N,
    holidayAllowance: holidayShifts * ALLOWANCES.H,
    weekendAllowance: weekendShifts * ALLOWANCES.weekend,
    total: (nightShifts * ALLOWANCES.N) + (holidayShifts * ALLOWANCES.H) + (weekendShifts * ALLOWANCES.weekend),
  };
}
```

Show this on the Staff Dashboard as a "This Month's Allowances" card. Show it on the HOD dashboard as a department total. Add it to Reports for HR payroll export.

### 5c. Audit Trail

Add migration `supabase/migrations/007_audit_log.sql`:
```sql
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  staff_id    uuid references public.staff(id) on delete set null,
  action      text not null,  -- 'roster_entry_updated', 'leave_approved', 'staff_created', etc.
  entity_type text not null,  -- 'roster_entry', 'leave_request', 'staff', etc.
  entity_id   uuid,
  old_value   jsonb,
  new_value   jsonb,
  ip_address  text,
  created_at  timestamptz default now()
);
create index audit_log_user_idx on public.audit_log(user_id);
create index audit_log_entity_idx on public.audit_log(entity_type, entity_id);
```

Add a `logAudit` helper to server actions and call it after every significant mutation (roster publish, leave approval, staff update, etc.).

### 5d. Locum Request Board

New page `/dashboard/locum-board`:
- HODs post open shifts (date, shift type, department, requirements)
- Locum staff (employment_type = "Locum") see the board and click "Accept"
- Accepting creates a roster entry automatically
- HOD gets notified when a locum accepts

### 5e. Roster E-Signature Workflow

Extend the roster status model:
```
draft → submitted → hod_signed → director_signed → published
```

When HOD clicks "Sign & Submit", store their name + timestamp in a `signatures` JSON field on the roster. When Medical Director countersigns, the roster auto-publishes. Show a signature block at the bottom of the PDF export.

---

## PART 6 — NEW DATABASE FIELDS NEEDED

Migration `supabase/migrations/006_two_stage_leave.sql` already covers leave. Also add:

```sql
-- Payroll/allowance config per department
create table if not exists public.allowance_rates (
  id                uuid primary key default gen_random_uuid(),
  hospital_id       uuid references public.hospitals(id),
  shift_code        text not null,
  rate_ghs          numeric(10,2) not null,
  effective_from    date not null,
  notes             text
);

-- Insert default SDA Hospital rates
insert into public.allowance_rates (hospital_id, shift_code, rate_ghs, effective_from)
values
  ('11111111-1111-4111-8111-111111111111', 'N', 50.00, '2026-01-01'),
  ('11111111-1111-4111-8111-111111111111', 'H', 80.00, '2026-01-01');

-- Roster e-signature support
alter table public.rosters
  add column if not exists signatures jsonb default '[]'::jsonb,
  add column if not exists hod_signed_at timestamptz,
  add column if not exists director_signed_at timestamptz;

-- Locum open shifts board
create table if not exists public.locum_shifts (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete cascade,
  shift_date    date not null,
  shift_code    text not null,
  requirements  text,
  status        text default 'open' check (status in ('open', 'filled', 'cancelled')),
  filled_by     uuid references public.staff(id) on delete set null,
  posted_by     uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now()
);
```

---

## PART 7 — FULL CHECKLIST FOR AGENT

### Role Architecture
- [ ] `getSessionUser()` helper created at `/src/lib/auth/getSessionUser.ts`
- [ ] Dashboard layout branches by role into HR/HOD/Staff sidebars
- [ ] `Sidebar.tsx` renamed to `HRSidebar.tsx`, all imports updated
- [ ] `HODSidebar.tsx` created with dept-filtered nav
- [ ] `StaffSidebar.tsx` created with personal nav
- [ ] Dashboard `page.tsx` renders correct dashboard component by role
- [ ] `HRDashboard`, `HODDashboard`, `StaffDashboard` components all created

### HOD Features
- [ ] HOD dashboard widgets all pulling real dept-filtered data
- [ ] All existing pages filter by `departmentId` when role is `department_head`
- [ ] HOD leave page shows `pending_hod` requests prominently with Approve/Reject
- [ ] `hodReviewLeave` action created in `/src/lib/actions/leave.ts`

### Two-Stage Leave Workflow
- [ ] Migration `006_two_stage_leave.sql` written with new columns and status values
- [ ] Prisma schema updated with new leave fields
- [ ] `hodReviewLeave` server action added
- [ ] `reviewLeaveRequest` (HR) guards against acting on `pending_hod` requests
- [ ] `createLeaveRequest` sets initial status to `pending_hod`
- [ ] `LeaveStatusBadge` component created with all 5 status variants
- [ ] Leave timeline/approval trail shown on leave detail view

### Staff Portal
- [ ] `StaffSidebar.tsx` created
- [ ] `StaffDashboard.tsx` created with identity card, 4 widgets, week strip, notifications
- [ ] `/dashboard/my-schedule` page with month navigator and calendar grid
- [ ] `MyScheduleCalendar` client component with colour-coded day cells and monthly summary
- [ ] `getRosterEntriesForStaff` action added to rosters actions
- [ ] `/dashboard/my-leave` page with leave balance, history table, submit form
- [ ] `StaffLeaveForm` client component with dialog and all leave types
- [ ] `LeaveStatusBadge` component (used by both staff and HOD views)
- [ ] `/dashboard/my-swaps` page (view own swaps + initiate new + accept/decline)
- [ ] `/dashboard/my-attendance` page (own records + clock in/out for today)
- [ ] `/dashboard/my-profile` page with editable contact info + change password

### Enterprise Features
- [ ] Escalation edge function created at `supabase/functions/escalate-leaves/index.ts`
- [ ] `getShiftAllowanceSummary` action in `/src/lib/actions/payroll.ts`
- [ ] Allowance summary card on StaffDashboard
- [ ] Allowance summary on HOD dashboard (department total)
- [ ] Audit log migration `007_audit_log.sql`
- [ ] `logAudit` helper called in key server actions
- [ ] Locum Request Board page `/dashboard/locum-board`
- [ ] `locum_shifts` table migration and actions
- [ ] Migration `006_two_stage_leave.sql` runs `npx prisma db push` successfully
- [ ] `npm run build` passes with zero TypeScript errors
