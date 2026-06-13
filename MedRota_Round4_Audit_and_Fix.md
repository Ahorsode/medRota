# MedRota — Round 4 Audit Report & Fix Prompt
### Post-Backend Push Review

---

## PART 1: AUDIT REPORT

---

## SCORECARD

| Category | Round 3 | Round 4 |
|----------|---------|---------|
| Project structure & routing | 10/10 | 10/10 |
| Design & color palette | 9/10 | 9/10 |
| Roster grid (core feature) | 9/10 | 9/10 |
| Database / Prisma schema | — | 10/10 ✅ |
| Server actions (all domains) | — | 9/10 ✅ |
| Serializer layer | — | 10/10 ✅ |
| Hooks → real server actions | — | 10/10 ✅ |
| All pages → real data | — | 9/10 ✅ |
| New pages (attendance, messages, handover) | — | 8/10 ✅ |
| Staff profile (assessments + training tabs) | 7/10 | 10/10 ✅ |
| Login session tracking | — | 9/10 ✅ |
| Logout session close | — | 9/10 ✅ |
| Dashboard real widgets | — | 10/10 ✅ |
| Reports — real aggregated data | 9/10 | 10/10 ✅ |
| **Root middleware** | **0/10** | **0/10** ❌ STILL MISSING |
| **Prisma generated client** | — | **0/10** ❌ NOT GENERATED |
| Sidebar new nav items | — | 8/10 ✅ |
| Messages — real-time unread badge | — | 0/10 ❌ |
| Attendance — clock-in/clock-out UI | — | 4/10 ⚠️ |
| Handover — acknowledge button wired | — | 4/10 ⚠️ |
| **Overall** | **~88/100** | **~90/100** |

---

## ✅ WHAT WAS DONE WELL THIS ROUND

### 1. Prisma Schema — Excellent ✅
All 14 models correctly defined. Multi-schema support (`public` + `auth`). Proper use of `@db.Uuid`, `@db.Date`, `@db.Timestamptz(6)`. Self-referential department hierarchy. All new tables (attendance, messages, handover, assessments, training, login sessions) present with correct relationships.

### 2. Serializer Layer — Smart Architecture ✅
`/src/lib/actions/serializers.ts` is a well-designed layer that converts Prisma's `Date` objects to ISO strings before they cross the server/client boundary (Next.js Server Actions cannot serialize `Date` objects). This avoids a common crash pattern. All 14 models have serializers with proper type narrowing.

### 3. Server Actions — Complete and Correct ✅
All 11 action files present and working:
- `"use server"` directive on every file ✅
- `try/catch` on every function, returning `{ error: string }` on failure ✅
- `revalidatePath` called correctly after mutations ✅
- Prisma `upsert` used correctly in `updateRosterEntry` ✅
- `toDate()` helper correctly pads dates to `T00:00:00.000Z` to avoid timezone edge cases ✅
- `getStaffById` includes all nested relations (leave, attendance, assessments, training) in one query ✅

### 4. Hooks — Fully Wired to Server Actions ✅
All three hooks (`useRoster`, `useStaff`, `useLeave`) now call real server actions. `useUpdateRosterStatus` hook added. `useUpdateStaff` hook added. TanStack Query invalidation correctly set to refresh after mutations.

### 5. All Pages Use Real Data ✅
Every page now imports from `/src/lib/actions/*` instead of mock data. Server components use `async/await` with `Promise.all` for parallel fetching. `export const dynamic = "force-dynamic"` correctly set on all pages to prevent stale caching.

### 6. Login/Logout Session Tracking ✅
- On login: `createLoginSession` creates a DB record, session ID stored in `localStorage`
- On logout: `closeLoginSession` calculates `duration_minutes` and writes `logout_at`
- IP address and user agent captured from request headers
- Dashboard "Recent Logins" widget pulls real data from `getRecentLoginSessions`
- `prisma.config.ts` correctly uses `DIRECT_URL` for migrations

### 7. New Feature Pages ✅
All three new pages built and connected to real server actions:
- **Attendance** — shows all staff, today's records, mark absent via form action
- **Messages** — compose form, inbox with unread badges, real `sendMessage` action
- **Handover** — create form with all required fields (dept, shift, from/to staff, body, patients count, critical notes), today's reports listed with acknowledge status

### 8. Staff Profile — Complete ✅
All four real data sections: personal info, leave history, assessments table (all 4 score columns: competency, efficiency, professionalism, ethics), training table. `getStaffById` fetches everything in one Prisma query.

---

## ❌ CRITICAL BUGS — MUST FIX

### BUG 1 — `/src/middleware.ts` STILL DOES NOT EXIST 🔴
This is the **fourth audit** in a row this has been flagged. The app has NO route protection. Any user can navigate directly to `http://localhost:3000/dashboard` without logging in. This is a 5-line file.

**Create `/src/middleware.ts` at the project root:**
```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
```
**There is no reason this has not been done. Do it first, before anything else.**

---

### BUG 2 — Prisma Client Not Generated 🔴
The schema is at `prisma/schema.prisma` and uses `output = "../src/generated/prisma"` but the generated client directory (`/src/generated/prisma/`) does not exist in the repo. This means:
- `npm run build` will FAIL
- `npm run dev` will FAIL on first Prisma query
- Every single server action will crash at runtime

The `package.json` `build` script correctly runs `prisma generate && next build` but the generated files must be produced first.

**Fix:**
```bash
npx prisma generate
```
Then add `/src/generated/` to `.gitignore` (it should not be committed — it's generated on install). Add a `postinstall` script to `package.json` so it auto-generates on `npm install`:

```json
"scripts": {
  "postinstall": "prisma generate",
  "dev": "next dev",
  "build": "prisma generate && next build",
  ...
}
```

---

### BUG 3 — Prisma Schema Missing DATABASE_URL 🔴
The `schema.prisma` datasource block has no `url` or `directUrl`:
```prisma
datasource db {
  provider = "postgresql"
  schemas  = ["public", "auth"]
}
```
This will cause `prisma generate` to succeed but `prisma db push` and all runtime queries to fail because Prisma doesn't know the connection string.

With `prisma.config.ts` in place (Prisma 7 style), the schema doesn't need the URL — the config file provides it. **But confirm `prisma.config.ts` is being respected** by running:
```bash
npx prisma db push
```
If it fails with "no datasource URL", add to schema:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
  schemas   = ["public", "auth"]
}
```

---

## ⚠️ INCOMPLETE FEATURES — HIGH PRIORITY

### 4. Handover — Acknowledge Button Not Wired ⚠️
The handover page renders reports with "Acknowledged"/"Pending" badges correctly, but there is **no acknowledge button** for the receiving staff to click. The `acknowledgeHandover` action exists in `/src/lib/actions/handover.ts` but is never called from the UI.

**Fix:** Add a form below each unacknowledged report:
```tsx
{!report.is_acknowledged && (
  <form action={async () => {
    "use server";
    await acknowledgeHandover(report.id);
  }}>
    <Button type="submit" size="sm" variant="outline">
      <ClipboardCheck className="h-4 w-4" />
      Acknowledge
    </Button>
  </form>
)}
```

### 5. Attendance — Clock-In/Out Buttons Missing ⚠️
The attendance page shows clock-in and clock-out time columns but only has a "Mark Absent" button. There are no Clock In / Clock Out buttons. The `clockIn` and `clockOut` actions exist in `/src/lib/actions/attendance.ts` but are never called.

**Fix:** Add two form action buttons per staff row:
```tsx
<form action={async (formData) => {
  "use server";
  const staffId = String(formData.get("staff_id") ?? "");
  if (staffId) await clockIn(staffId, today());
}}>
  <input type="hidden" name="staff_id" value={person.id} />
  <Button size="sm" variant="outline" type="submit" disabled={!!record?.clock_in}>
    Clock In
  </Button>
</form>

<form action={async (formData) => {
  "use server";
  const staffId = String(formData.get("staff_id") ?? "");
  if (staffId) await clockOut(staffId, today());
}}>
  <input type="hidden" name="staff_id" value={person.id} />
  <Button size="sm" variant="outline" type="submit" disabled={!record?.clock_in || !!record?.clock_out}>
    Clock Out
  </Button>
</form>
```

### 6. Messages — "Mark as Read" Not Wired ⚠️
Messages appear in the inbox with "Unread" badges but clicking on a message does not call `markMessageRead`. The badge stays "Unread" forever.

**Fix:** Convert each message article into a form that calls `markMessageRead` when clicked, or add a "Mark as Read" button per message:
```tsx
{unread && (
  <form action={async () => {
    "use server";
    if (currentStaff) await markMessageRead(message.id, currentStaff.id);
  }}>
    <Button type="submit" size="sm" variant="ghost">Mark read</Button>
  </form>
)}
```

### 7. Messages — Sender is Always `staff[0]` ⚠️
In `messages/page.tsx`:
```ts
const currentStaff = staff[0] ?? null; // ← This is wrong
```
This hardcodes the first staff member in the database as the current user. In a real system the sender should be determined by the authenticated user's session — look up which `staff` record has `user_id` matching `auth.getUser().id`.

**Fix:** In the page, get the current user from Supabase server client, then find the matching staff:
```ts
const supabase = await createClient(); // server client
const { data: { user } } = await supabase.auth.getUser();
const currentStaff = user ? staff.find(s => s.user_id === user.id) ?? staff[0] : staff[0];
```
Apply the same fix to the handover page's `activeDepartment` — it currently defaults to `departments[0]`, which may not be the logged-in user's department.

---

## 🟡 MINOR ISSUES

| # | Issue | Effort |
|---|-------|--------|
| 8 | **Reports date range is hardcoded** to `"2026-06-01"` / `"2026-06-30"`. The date range pickers in the UI need to be wired to actually update the data. Since this is a Server Component, this requires converting to a Client Component with `useSearchParams` or URL search params. | 1 hr |
| 9 | **Sidebar has duplicate ClipboardList icon** for both "Duty Rosters" and "Handover Reports". Give Handover its own icon: `import { BookOpenCheck } from "lucide-react"` | 5 min |
| 10 | **Swaps — `reviewSwap` missing `reviewedBy`** — `reviewSwap` in `swaps.ts` accepts `reviewedBy` but the page's form action doesn't pass it. Needs the logged-in user's ID from auth. | 30 min |
| 11 | **Settings hospital profile is still hardcoded** — "SDA Hospital" and "Koforidua, Ghana" are static strings. Should fetch from the `hospitals` table. | 30 min |
| 12 | **`createTrainingRecord` action exists but no UI to trigger it** — staff profile Training tab shows records but has no "Add Training" button. | 1 hr |
| 13 | **`createAssessment` action exists but no UI to trigger it** — same gap on the Assessments tab. | 1 hr |
| 14 | **`mock.ts` is still imported by roster components** — `RosterWorkspace` and `RosterGrid` still pull `mockShiftConfigs` from mock data for the cell-edit popover. Should call `getShiftConfigurations(departmentId)` instead. | 30 min |

---

## SUMMARY

The backend phase was executed to a very high standard. All 11 server action files are clean, well-typed, and follow consistent patterns. The serializer layer shows architectural maturity. Every page now fetches real data. The new attendance, messages, and handover pages are structurally complete.

**The only blocker** preventing this app from being deployable is the missing `/src/middleware.ts` file (5 lines, flagged 4 times now) and the ungenerated Prisma client. Fix those two things and the app will build and run end-to-end.

After that, the remaining work is filling in the UI gaps: acknowledge button on handover, clock-in/out buttons on attendance, mark-as-read on messages, and replacing hardcoded sender/department with the real auth user.

---

## PART 2: FIX PROMPT FOR AGENT

---

# MedRota — Round 4 Fix Prompt

Work through these in exact order. Do not skip ahead.

---

## FIX 1 — Create `/src/middleware.ts` (5 lines, do this NOW)

This file has been missing for 4 audit rounds. Without it, route protection does not work.

Create the file at `/src/middleware.ts` (project root `src/` folder, NOT inside `lib/supabase/`):

```ts
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

## FIX 2 — Add `postinstall` script for Prisma generate

In `package.json`, add:
```json
"postinstall": "prisma generate"
```
This ensures the generated client is always created after `npm install` on any machine.

Then run locally:
```bash
npx prisma generate
```

Add `/src/generated/` to `.gitignore` so the generated files are not committed to the repo.

---

## FIX 3 — Wire the Acknowledge button on Handover page

In `/src/app/dashboard/handover/page.tsx`, import `acknowledgeHandover` from `@/lib/actions/handover` and add this inside the `.map()` for each report, below the `{report.critical_notes}` block:

```tsx
{!report.is_acknowledged && (
  <form
    action={async () => {
      "use server";
      await acknowledgeHandover(report.id);
    }}
    className="mt-3"
  >
    <Button type="submit" size="sm" variant="outline">
      <ClipboardCheck className="mr-2 h-4 w-4" />
      Acknowledge Handover
    </Button>
  </form>
)}
```

---

## FIX 4 — Wire Clock In / Clock Out buttons on Attendance page

In `/src/app/dashboard/attendance/page.tsx`, import `clockIn` and `clockOut` from `@/lib/actions/attendance`.

Replace the single "Mark Absent" form in the `<TableCell>` for Action with this:

```tsx
<TableCell>
  <div className="flex items-center gap-2">
    <form action={async (formData: FormData) => {
      "use server";
      const staffId = String(formData.get("staff_id") ?? "");
      if (staffId) await clockIn(staffId, today());
    }}>
      <input type="hidden" name="staff_id" value={person.id} />
      <Button
        size="sm"
        variant="outline"
        type="submit"
        disabled={!!record?.clock_in}
        className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
      >
        <Clock className="h-3 w-3 mr-1" />
        In
      </Button>
    </form>

    <form action={async (formData: FormData) => {
      "use server";
      const staffId = String(formData.get("staff_id") ?? "");
      if (staffId) await clockOut(staffId, today());
    }}>
      <input type="hidden" name="staff_id" value={person.id} />
      <Button
        size="sm"
        variant="outline"
        type="submit"
        disabled={!record?.clock_in || !!record?.clock_out}
        className="text-slate-700"
      >
        <Clock className="h-3 w-3 mr-1" />
        Out
      </Button>
    </form>

    <form action={async (formData: FormData) => {
      "use server";
      const staffId = String(formData.get("staff_id") ?? "");
      if (staffId) await markAbsent(staffId, today());
    }}>
      <input type="hidden" name="staff_id" value={person.id} />
      <Button
        size="sm"
        variant="outline"
        type="submit"
        className="text-red-700 border-red-200 hover:bg-red-50"
      >
        Absent
      </Button>
    </form>
  </div>
</TableCell>
```

---

## FIX 5 — Fix current user identity in Messages and Handover pages

### Messages page (`/src/app/dashboard/messages/page.tsx`)

Replace:
```ts
const currentStaff = staff[0] ?? null;
```
With:
```ts
import { createClient } from "@/lib/supabase/server";
// ...
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
const currentStaff = user
  ? (staff.find((s) => s.user_id === user.id) ?? staff[0] ?? null)
  : (staff[0] ?? null);
```

### Handover page (`/src/app/dashboard/handover/page.tsx`)

Replace:
```ts
const activeDepartment = departments[0] ?? null;
```
With:
```ts
import { createClient } from "@/lib/supabase/server";
// ...
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
const currentUserStaff = user ? staff.find((s) => s.user_id === user.id) : null;
const activeDepartment =
  (currentUserStaff?.department_id
    ? departments.find((d) => d.id === currentUserStaff.department_id)
    : null) ?? departments[0] ?? null;
```

---

## FIX 6 — Add Mark as Read to Messages inbox

In `/src/app/dashboard/messages/page.tsx`, import `markMessageRead` from `@/lib/actions/messages`.

Inside the `messages.map()`, add a mark-as-read button on unread messages:

```tsx
{unread && currentStaff && (
  <form
    action={async () => {
      "use server";
      await markMessageRead(message.id, currentStaff.id);
    }}
  >
    <Button type="submit" size="sm" variant="ghost" className="text-slate-500">
      Mark read
    </Button>
  </form>
)}
```

---

## FIX 7 — Fix duplicate sidebar icon for Handover

In `/src/components/layout/Sidebar.tsx`, change the Handover Reports nav item to use a distinct icon:

```ts
// Replace ClipboardList for handover with BookOpenCheck
import { ..., BookOpenCheck } from "lucide-react";

// In navItems array:
{ href: "/dashboard/handover", label: "Handover Reports", icon: BookOpenCheck },
```

---

## FIX 8 — Wire roster shift configs from real data (remove last mock import)

Find which components still import from `@/lib/data/mock`:
```bash
grep -r "from.*mock" src/
```

For any component using `mockShiftConfigs` (likely `RosterWorkspace.tsx` or `ShiftCell.tsx`), replace with a call to `getShiftConfigurations(departmentId)` passed down as a prop from the roster page — it already calls `getShiftConfigurations` via the `getRosterWithEntries` action.

---

## FIX 9 — Add "Add Assessment" and "Add Training" buttons to Staff Profile

In `/src/app/dashboard/staff/[id]/page.tsx`, add inline forms below each table to create new records. Import `createAssessment` and `createTrainingRecord`.

**Assessment form** (place inside the Assessments Card, below the Table):
```tsx
<details className="mt-4 rounded-lg border border-slate-200">
  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
    + Add Assessment
  </summary>
  <form
    action={async (formData: FormData) => {
      "use server";
      await createAssessment({
        staff_id: id,
        assessed_by: String(formData.get("assessed_by") ?? ""),
        assessment_date: String(formData.get("assessment_date") ?? ""),
        period: String(formData.get("period") ?? ""),
        competency_score: Number(formData.get("competency_score")) || undefined,
        efficiency_score: Number(formData.get("efficiency_score")) || undefined,
        professionalism_score: Number(formData.get("professionalism_score")) || undefined,
        ethical_score: Number(formData.get("ethical_score")) || undefined,
        comments: String(formData.get("comments") ?? "") || undefined,
      });
    }}
    className="grid gap-3 p-4 md:grid-cols-3"
  >
    <input name="period" placeholder="Period (e.g. Q1 2026)" className="h-10 rounded-md border border-slate-200 px-3 text-sm" required />
    <input name="assessment_date" type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" required />
    <input name="assessed_by" placeholder="Assessor ID" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
    {["competency_score", "efficiency_score", "professionalism_score", "ethical_score"].map((field) => (
      <input key={field} name={field} type="number" min={1} max={5}
        placeholder={`${field.replace("_score", "").replace("_", " ")} (1-5)`}
        className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
    ))}
    <textarea name="comments" placeholder="Comments" className="md:col-span-3 rounded-md border border-slate-200 px-3 py-2 text-sm min-h-20" />
    <Button type="submit" className="md:col-span-3">Save Assessment</Button>
  </form>
</details>
```

**Training form** (place inside the Training Card, below the Table):
```tsx
<details className="mt-4 rounded-lg border border-slate-200">
  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
    + Add Training Record
  </summary>
  <form
    action={async (formData: FormData) => {
      "use server";
      await createTrainingRecord({
        staff_id: id,
        training_title: String(formData.get("training_title") ?? ""),
        training_type: String(formData.get("training_type") ?? "attended"),
        provider: String(formData.get("provider") ?? "") || undefined,
        start_date: String(formData.get("start_date") ?? ""),
        end_date: String(formData.get("end_date") ?? ""),
        notes: String(formData.get("notes") ?? "") || undefined,
      });
    }}
    className="grid gap-3 p-4 md:grid-cols-3"
  >
    <input name="training_title" placeholder="Training title" className="h-10 rounded-md border border-slate-200 px-3 text-sm md:col-span-2" required />
    <select name="training_type" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
      <option value="attended">Attended</option>
      <option value="given">Given</option>
    </select>
    <input name="provider" placeholder="Provider / Institution" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
    <input name="start_date" type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" required />
    <input name="end_date" type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" required />
    <Button type="submit" className="md:col-span-3">Save Training Record</Button>
  </form>
</details>
```

---

## FINAL CHECKLIST

- [ ] `/src/middleware.ts` created at project root
- [ ] `postinstall` script added to `package.json`
- [ ] `npx prisma generate` run successfully, `/src/generated/prisma/` exists
- [ ] `/src/generated/` added to `.gitignore`
- [ ] Handover acknowledge button wired
- [ ] Attendance clock-in and clock-out buttons wired
- [ ] Messages mark-as-read wired
- [ ] Messages and Handover pages use real auth user, not `staff[0]`
- [ ] Sidebar handover icon changed from `ClipboardList` to `BookOpenCheck`
- [ ] Last remaining mock imports removed from roster components
- [ ] Add Assessment form on staff profile
- [ ] Add Training Record form on staff profile
- [ ] `npm run build` passes with zero errors
