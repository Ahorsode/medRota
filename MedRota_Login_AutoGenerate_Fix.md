# MedRota — Fix Prompt: Login Redirect + Auto-Generate + Leave Configuration

Work through every fix in the exact order listed. Do not skip any item.

---

## FIX 1 — Login Does Not Redirect Without Page Refresh (CRITICAL)

### Root Cause
The login page calls `router.push("/dashboard")` followed by `router.refresh()`. In Next.js App Router, `router.push` is a client-side navigation that checks the middleware session cookie **before** Supabase has finished writing it to the browser. The session cookie is set asynchronously by the `@supabase/ssr` library, and `router.push` fires before the cookie is available, so the middleware sees no session and silently allows the navigation to stall. A manual page refresh re-reads the cookie from scratch, which is why it works only on refresh.

### Fix A — Create the missing root middleware (fixes the session check)

Create `/src/middleware.ts` at the project root `src/` folder. This file has been missing since day one and is the primary reason the redirect doesn't work — without it, session management is broken:

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

### Fix B — Replace `router.push` with `window.location.href` in login page

In `/src/app/login/page.tsx`, replace the navigation block after successful login:

**Remove:**
```ts
router.push("/dashboard");
router.refresh();
```

**Replace with:**
```ts
window.location.href = "/dashboard";
```

`window.location.href` causes a full browser navigation (not a client-side push), which re-reads all cookies from scratch. By the time the browser navigates, Supabase has written the session cookie, so the middleware sees a valid session and allows the request through.

The full corrected `handleSubmit` function:

```ts
async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setLoading(true);
  setError(null);

  try {
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message || "Invalid email or password.");
      setLoading(false);
      return;
    }

    if (data.user) {
      try {
        const loginSession = await createLoginSession({ user_id: data.user.id });
        if ("id" in loginSession) {
          window.localStorage.setItem("medrota_login_session_id", loginSession.id);
        }
      } catch {
        // session logging failure should not block login
      }
    }

    // Full page navigation — ensures session cookie is read fresh by middleware
    window.location.href = "/dashboard";
  } catch {
    setError(
      "Unable to connect. Check that Supabase environment keys are set in .env.local."
    );
    setLoading(false);
  }
}
```

Note: Remove `setLoading(false)` from the `finally` block — because `window.location.href` navigates away, calling `setLoading(false)` after it would cause a React state update on an unmounted component. Only call it in the error paths.

---

## FIX 2 — Auto-Generate Schedule (Full Implementation)

### Current State
The "Auto-Generate" button in `RosterToolbar.tsx` only shows a toast: `"Auto-generation preview applied"`. No actual schedule is generated. There is no algorithm anywhere in the codebase.

### What to Build

You need three things:
1. A **scheduling algorithm** in `/src/lib/utils/autoGenerate.ts`
2. A **server action** `autoGenerateRoster` in `/src/lib/actions/rosters.ts`
3. A **configuration dialog** in `RosterWorkspace.tsx` that opens before generating, letting the scheduler set options

---

### Step 1 — Create `/src/lib/utils/autoGenerate.ts`

```ts
import { getMonthDays, getIsoDate } from "@/lib/utils/dates";
import type { Staff, RosterEntry, ShiftCode, LeaveRequest } from "@/lib/types";

export interface AutoGenerateConfig {
  // How many morning shifts each staff member should work per month (default: 16)
  morningDaysPerStaff: number;
  // How many afternoon shifts per staff member per month (default: 8)
  afternoonDaysPerStaff: number;
  // How many night shifts per staff member per month (default: 4)
  nightDaysPerStaff: number;
  // Maximum consecutive night shifts before forced rest (default: 3)
  maxConsecutiveNights: number;
  // Whether to enforce at least one senior staff per shift (default: true)
  enforceSeniorCoverage: boolean;
  // Minimum staff per shift type (default: { M: 2, A: 2, N: 1 })
  minCoveragePerShift: { M: number; A: number; N: number };
}

export const defaultAutoGenerateConfig: AutoGenerateConfig = {
  morningDaysPerStaff: 16,
  afternoonDaysPerStaff: 8,
  nightDaysPerStaff: 4,
  maxConsecutiveNights: 3,
  enforceSeniorCoverage: true,
  minCoveragePerShift: { M: 2, A: 2, N: 1 },
};

const SENIOR_RANKS = new Set(["SNO", "SEN", "Doctor", "MO", "Specialist", "NO"]);

export function autoGenerateEntries(
  rosterId: string,
  departmentId: string,
  staff: Staff[],
  year: number,
  month: number,
  approvedLeaves: LeaveRequest[],
  config: AutoGenerateConfig = defaultAutoGenerateConfig
): Omit<RosterEntry, "id" | "created_at" | "updated_at">[] {
  const days = getMonthDays(year, month);
  const activeStaff = staff.filter(
    (s) => s.department_id === departmentId && s.is_active
  );

  if (activeStaff.length === 0) return [];

  // Build a set of leave dates per staff member
  const leaveDates = new Map<string, Set<string>>();
  for (const leave of approvedLeaves) {
    if (leave.status !== "approved") continue;
    const start = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    const set = leaveDates.get(leave.staff_id) ?? new Set();
    const cursor = new Date(start);
    while (cursor <= end) {
      set.add(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    leaveDates.set(leave.staff_id, set);
  }

  // Track how many of each shift type each staff member has been assigned
  const shiftCount = new Map<string, Record<ShiftCode, number>>();
  const consecutiveNights = new Map<string, number>();
  const lastShiftCode = new Map<string, ShiftCode | null>();

  for (const s of activeStaff) {
    shiftCount.set(s.id, { M: 0, A: 0, N: 0, O: 0, H: 0, "%": 0, LEAVE: 0, ON_CALL: 0 });
    consecutiveNights.set(s.id, 0);
    lastShiftCode.set(s.id, null);
  }

  const entries: Omit<RosterEntry, "id" | "created_at" | "updated_at">[] = [];

  for (const day of days) {
    const date = day.iso;
    const isWeekend = day.isWeekend;
    const isHoliday = day.isHoliday;

    // Separate staff into pools: available vs on leave
    const available = activeStaff.filter(
      (s) => !leaveDates.get(s.id)?.has(date)
    );
    const onLeave = activeStaff.filter((s) =>
      leaveDates.get(s.id)?.has(date)
    );

    // Mark leave entries first
    for (const s of onLeave) {
      const leaveRecord = approvedLeaves.find(
        (l) =>
          l.staff_id === s.id &&
          l.status === "approved" &&
          date >= l.start_date &&
          date <= l.end_date
      );
      entries.push({
        roster_id: rosterId,
        staff_id: s.id,
        shift_date: date,
        shift_code: "LEAVE",
        is_leave: true,
        leave_type: leaveRecord?.leave_type ?? "Annual",
        notes: null,
        shift_config_id: null,
      });
      shiftCount.get(s.id)!.LEAVE += 1;
    }

    if (isHoliday) {
      // On public holidays assign H to everyone available
      for (const s of available) {
        entries.push({
          roster_id: rosterId,
          staff_id: s.id,
          shift_date: date,
          shift_code: "H",
          is_leave: false,
          leave_type: null,
          notes: null,
          shift_config_id: null,
        });
        shiftCount.get(s.id)!.H += 1;
        consecutiveNights.set(s.id, 0);
        lastShiftCode.set(s.id, "H");
      }
      continue;
    }

    // Sort staff by who needs the most shifts assigned (fairness)
    const sortedByNeed = [...available].sort((a, b) => {
      const aTotals = shiftCount.get(a.id)!;
      const bTotals = shiftCount.get(b.id)!;
      const aWorked = aTotals.M + aTotals.A + aTotals.N;
      const bWorked = bTotals.M + bTotals.A + bTotals.N;
      return aWorked - bWorked; // those with fewer shifts go first
    });

    const assignedToday = new Map<string, ShiftCode>();

    function pickForShift(
      shiftCode: "M" | "A" | "N",
      targetPerStaff: number,
      count: number
    ): Staff[] {
      const pool = sortedByNeed.filter((s) => {
        if (assignedToday.has(s.id)) return false;
        const counts = shiftCount.get(s.id)!;
        const last = lastShiftCode.get(s.id);
        const consec = consecutiveNights.get(s.id) ?? 0;

        // Can't do morning right after night (rest period violation)
        if (shiftCode === "M" && last === "N") return false;
        // Can't exceed max consecutive nights
        if (shiftCode === "N" && consec >= config.maxConsecutiveNights) return false;
        // Prefer staff who still need this shift type
        if (counts[shiftCode] >= targetPerStaff && available.length > count) return false;

        return true;
      });

      // Prefer seniors if enforceSeniorCoverage
      const seniors = pool.filter((s) => SENIOR_RANKS.has(s.rank ?? ""));
      const nonSeniors = pool.filter((s) => !SENIOR_RANKS.has(s.rank ?? ""));

      const ordered =
        config.enforceSeniorCoverage && seniors.length > 0
          ? [...seniors, ...nonSeniors]
          : pool;

      return ordered.slice(0, count);
    }

    // Determine how many of each shift to fill today
    // On weekends, reduce staffing slightly but keep minimum coverage
    const mCount = isWeekend
      ? config.minCoveragePerShift.M
      : Math.max(config.minCoveragePerShift.M, Math.ceil(available.length * 0.5));
    const aCount = isWeekend
      ? config.minCoveragePerShift.A
      : Math.max(config.minCoveragePerShift.A, Math.ceil(available.length * 0.25));
    const nCount = Math.max(
      config.minCoveragePerShift.N,
      Math.ceil(available.length * 0.15)
    );

    const morningStaff = pickForShift("M", config.morningDaysPerStaff, mCount);
    for (const s of morningStaff) assignedToday.set(s.id, "M");

    const afternoonStaff = pickForShift("A", config.afternoonDaysPerStaff, aCount);
    for (const s of afternoonStaff) assignedToday.set(s.id, "A");

    const nightStaff = pickForShift("N", config.nightDaysPerStaff, nCount);
    for (const s of nightStaff) assignedToday.set(s.id, "N");

    // Everyone else gets O (off day)
    for (const s of available) {
      if (!assignedToday.has(s.id)) assignedToday.set(s.id, "O");
    }

    // Write entries and update counters
    for (const [staffId, code] of assignedToday.entries()) {
      entries.push({
        roster_id: rosterId,
        staff_id: staffId,
        shift_date: date,
        shift_code: code,
        is_leave: false,
        leave_type: null,
        notes: null,
        shift_config_id: null,
      });
      shiftCount.get(staffId)![code] += 1;
      consecutiveNights.set(
        staffId,
        code === "N" ? (consecutiveNights.get(staffId) ?? 0) + 1 : 0
      );
      lastShiftCode.set(staffId, code);
    }
  }

  return entries;
}
```

---

### Step 2 — Add `autoGenerateRoster` server action to `/src/lib/actions/rosters.ts`

Add this function at the bottom of the file:

```ts
export async function autoGenerateRoster(
  rosterId: string,
  departmentId: string,
  year: number,
  month: number,
  config: import("@/lib/utils/autoGenerate").AutoGenerateConfig
) {
  try {
    // Fetch all active staff in this department
    const staff = await prisma.staff.findMany({
      where: { department_id: departmentId, is_active: true },
    });

    // Fetch all approved leaves for staff in this dept for this month
    const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`);
    const monthEnd = new Date(new Date(monthStart).setMonth(monthStart.getMonth() + 1) - 1);

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        staff_id: { in: staff.map((s) => s.id) },
        status: "approved",
        OR: [
          { start_date: { lte: monthEnd }, end_date: { gte: monthStart } },
        ],
      },
    });

    // Serialize for the pure function
    const serializedStaff = staff.map(serializeStaff);
    const serializedLeaves = approvedLeaves.map((l) => ({
      ...l,
      start_date: l.start_date.toISOString().slice(0, 10),
      end_date: l.end_date.toISOString().slice(0, 10),
      requested_at: l.requested_at.toISOString(),
      reviewed_at: l.reviewed_at?.toISOString() ?? null,
    }));

    // Run the pure scheduling algorithm
    const { autoGenerateEntries } = await import("@/lib/utils/autoGenerate");
    const generated = autoGenerateEntries(
      rosterId,
      departmentId,
      serializedStaff,
      year,
      month,
      serializedLeaves,
      config
    );

    // Delete existing entries and replace with generated ones
    await prisma.$transaction([
      prisma.rosterEntry.deleteMany({ where: { roster_id: rosterId } }),
      prisma.rosterEntry.createMany({ data: generated.map((e) => ({
        ...e,
        shift_date: new Date(`${e.shift_date}T00:00:00.000Z`),
      })) }),
    ]);

    // Fetch and return the fresh entries
    const entries = await prisma.rosterEntry.findMany({
      where: { roster_id: rosterId },
      orderBy: { shift_date: "asc" },
    });

    revalidatePath("/dashboard/rosters");
    return { entries: entries.map(serializeRosterEntry) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Auto-generate failed" };
  }
}
```

---

### Step 3 — Build the Auto-Generate Config Dialog

Create `/src/components/roster/AutoGenerateDialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Sparkles, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultAutoGenerateConfig,
  type AutoGenerateConfig,
} from "@/lib/utils/autoGenerate";

interface Props {
  open: boolean;
  onClose: () => void;
  onGenerate: (config: AutoGenerateConfig) => Promise<void>;
  staffCount: number;
  daysInMonth: number;
}

export function AutoGenerateDialog({
  open,
  onClose,
  onGenerate,
  staffCount,
  daysInMonth,
}: Props) {
  const [config, setConfig] = useState<AutoGenerateConfig>(
    defaultAutoGenerateConfig
  );
  const [loading, setLoading] = useState(false);

  function update<K extends keyof AutoGenerateConfig>(
    key: K,
    value: AutoGenerateConfig[K]
  ) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function updateCoverage(shift: "M" | "A" | "N", value: number) {
    setConfig((prev) => ({
      ...prev,
      minCoveragePerShift: { ...prev.minCoveragePerShift, [shift]: value },
    }));
  }

  async function handleGenerate() {
    setLoading(true);
    try {
      await onGenerate(config);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#2E86AB]" />
            Auto-Generate Roster
          </DialogTitle>
          <DialogDescription>
            Configure shift distribution rules. The scheduler will fill the
            entire month fairly based on these settings, respecting approved
            leaves and rest-period rules.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Staff info banner */}
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              <strong>{staffCount} active staff</strong> · {daysInMonth} days
              this month
            </span>
          </div>

          {/* Shifts per staff per month */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-700">
              Shifts per staff member per month
            </legend>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { key: "morningDaysPerStaff", label: "Morning (M)", default: 16 },
                  { key: "afternoonDaysPerStaff", label: "Afternoon (A)", default: 8 },
                  { key: "nightDaysPerStaff", label: "Night (N)", default: 4 },
                ] as const
              ).map(({ key, label, default: def }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-slate-600">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={daysInMonth}
                    value={config[key]}
                    onChange={(e) => update(key, Number(e.target.value))}
                    className="h-9 text-sm"
                  />
                  <p className="text-xs text-slate-400">default: {def}</p>
                </div>
              ))}
            </div>
          </fieldset>

          {/* Annual leave days */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-700">
              Annual leave entitlement (days per year)
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">
                  Full-time staff
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  defaultValue={30}
                  className="h-9 text-sm"
                  name="fulltime_leave"
                  onChange={(e) =>
                    update(
                      "annualLeaveEntitlementFullTime" as keyof AutoGenerateConfig,
                      Number(e.target.value) as never
                    )
                  }
                />
                <p className="text-xs text-slate-400">default: 30 days</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Part-time / Locum</Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  defaultValue={15}
                  className="h-9 text-sm"
                  name="parttime_leave"
                />
                <p className="text-xs text-slate-400">default: 15 days</p>
              </div>
            </div>
          </fieldset>

          {/* Minimum coverage per shift */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-700">
              Minimum staff per shift (coverage floor)
            </legend>
            <div className="grid grid-cols-3 gap-3">
              {(["M", "A", "N"] as const).map((shift) => (
                <div key={shift} className="space-y-1">
                  <Label className="text-xs text-slate-600">
                    {shift === "M" ? "Morning" : shift === "A" ? "Afternoon" : "Night"}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={config.minCoveragePerShift[shift]}
                    onChange={(e) => updateCoverage(shift, Number(e.target.value))}
                    className="h-9 text-sm"
                  />
                  <p className="text-xs text-slate-400">
                    default: {defaultAutoGenerateConfig.minCoveragePerShift[shift]}
                  </p>
                </div>
              ))}
            </div>
          </fieldset>

          {/* Rules */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-700">Rules</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">
                  Max consecutive nights
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={config.maxConsecutiveNights}
                  onChange={(e) =>
                    update("maxConsecutiveNights", Number(e.target.value))
                  }
                  className="h-9 text-sm"
                />
                <p className="text-xs text-slate-400">default: 3</p>
              </div>
              <div className="flex flex-col justify-center gap-1 pt-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.enforceSeniorCoverage}
                    onChange={(e) =>
                      update("enforceSeniorCoverage", e.target.checked)
                    }
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-slate-700">
                    Require senior per shift
                  </span>
                </label>
                <p className="pl-6 text-xs text-slate-400">default: on</p>
              </div>
            </div>
          </fieldset>

          {/* Warning */}
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ This will <strong>replace all existing entries</strong> for this
            month. Export a backup first if needed.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-[#1A2B4A] hover:bg-[#2E86AB]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Roster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Step 4 — Wire the Dialog into RosterWorkspace

In `/src/components/roster/RosterWorkspace.tsx`:

**Add imports:**
```ts
import { AutoGenerateDialog } from "@/components/roster/AutoGenerateDialog";
import { autoGenerateRoster } from "@/lib/actions/rosters";
import type { AutoGenerateConfig } from "@/lib/utils/autoGenerate";
import { toast } from "sonner";
```

**Add state inside the component:**
```ts
const [autoGenOpen, setAutoGenOpen] = useState(false);
```

**Add the handler:**
```ts
async function handleAutoGenerate(config: AutoGenerateConfig) {
  const result = await autoGenerateRoster(
    roster.id,
    department.id,
    roster.year,
    roster.month,
    config
  );

  if ("error" in result) {
    toast.error(`Auto-generate failed: ${result.error}`);
    return;
  }

  setEntries(result.entries);
  toast.success(
    `Roster generated — ${result.entries.length} entries created across ${days.length} days.`
  );
}
```

**Add the dialog to JSX** (anywhere inside the return, after the RosterToolbar div):
```tsx
<AutoGenerateDialog
  open={autoGenOpen}
  onClose={() => setAutoGenOpen(false)}
  onGenerate={handleAutoGenerate}
  staffCount={departmentStaff.length}
  daysInMonth={days.length}
/>
```

---

### Step 5 — Wire the toolbar button to open the dialog

In `/src/components/roster/RosterToolbar.tsx`, add `onAutoGenerate` prop:

```ts
export function RosterToolbar({
  ...,
  onAutoGenerate,   // ← add this
}: {
  ...,
  onAutoGenerate: () => void;   // ← add this
}) {
```

Change the Auto-Generate button:
```tsx
// Replace the toast-only onClick with:
<Button size="sm" variant="outline" onClick={onAutoGenerate}>
  <Sparkles className="h-4 w-4" />
  Auto-Generate
</Button>
```

In `RosterWorkspace.tsx`, pass the prop to `RosterToolbar`:
```tsx
<RosterToolbar
  ...
  onAutoGenerate={() => setAutoGenOpen(true)}
/>
```

---

## FIX 3 — Add `annualLeaveEntitlementFullTime` and `annualLeaveEntitlementPartTime` to the config type

In `/src/lib/utils/autoGenerate.ts`, extend the config interface and defaults:

```ts
export interface AutoGenerateConfig {
  morningDaysPerStaff: number;
  afternoonDaysPerStaff: number;
  nightDaysPerStaff: number;
  maxConsecutiveNights: number;
  enforceSeniorCoverage: boolean;
  minCoveragePerShift: { M: number; A: number; N: number };
  annualLeaveEntitlementFullTime: number;   // default: 30
  annualLeaveEntitlementPartTime: number;   // default: 15
}

export const defaultAutoGenerateConfig: AutoGenerateConfig = {
  morningDaysPerStaff: 16,
  afternoonDaysPerStaff: 8,
  nightDaysPerStaff: 4,
  maxConsecutiveNights: 3,
  enforceSeniorCoverage: true,
  minCoveragePerShift: { M: 2, A: 2, N: 1 },
  annualLeaveEntitlementFullTime: 30,
  annualLeaveEntitlementPartTime: 15,
};
```

The `annualLeaveEntitlementFullTime` and `annualLeaveEntitlementPartTime` values from the config should be used in the `autoGenerateRoster` server action to validate that a staff member's total LEAVE days in the roster does not exceed their entitlement (full-time vs part-time/locum). Add this check in the action after generation:

```ts
// After generating entries, validate leave entitlements
for (const s of staff) {
  const leaveEntries = generated.filter(
    (e) => e.staff_id === s.id && e.shift_code === "LEAVE"
  );
  const entitlement =
    s.employment_type === "Full-time"
      ? config.annualLeaveEntitlementFullTime
      : config.annualLeaveEntitlementPartTime;
  if (leaveEntries.length > entitlement) {
    // Trim excess leave days to O (off day) instead
    const excess = leaveEntries.slice(entitlement);
    for (const e of excess) {
      e.shift_code = "O";
      e.is_leave = false;
      e.leave_type = null;
    }
  }
}
```

---

## FIX 4 — Add `LeaveRequest` import to the autoGenerate utility

The `autoGenerateEntries` function uses `LeaveRequest` from types. Make sure the import at the top of `/src/lib/utils/autoGenerate.ts` includes it:

```ts
import type { Staff, RosterEntry, ShiftCode, LeaveRequest } from "@/lib/types";
```

If `LeaveRequest` does not exist in `/src/lib/types/index.ts`, add it:

```ts
export interface LeaveRequest {
  id: string;
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
}
```

---

## FINAL CHECKLIST

- [ ] `/src/middleware.ts` created at project root
- [ ] Login `handleSubmit` uses `window.location.href = "/dashboard"` (not `router.push`)
- [ ] `setLoading(false)` removed from `finally` block, only called in error paths
- [ ] `/src/lib/utils/autoGenerate.ts` created with full algorithm
- [ ] `autoGenerateRoster` server action added to `/src/lib/actions/rosters.ts`
- [ ] `/src/components/roster/AutoGenerateDialog.tsx` created
- [ ] `AutoGenerateDialog` imported and rendered inside `RosterWorkspace`
- [ ] `handleAutoGenerate` function added to `RosterWorkspace`
- [ ] `RosterToolbar` receives `onAutoGenerate` prop and button opens dialog
- [ ] `AutoGenerateConfig` type includes `annualLeaveEntitlementFullTime` and `annualLeaveEntitlementPartTime`
- [ ] `defaultAutoGenerateConfig` sets both to 30 and 15 respectively
- [ ] Leave entitlement validation in `autoGenerateRoster` action
- [ ] `LeaveRequest` type confirmed in `/src/lib/types/index.ts`
- [ ] `npm run build` passes with zero TypeScript errors
