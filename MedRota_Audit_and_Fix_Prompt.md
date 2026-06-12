# MedRota — Code Audit Report & Fix Prompt

---

## PART 1: AUDIT REPORT
### What Was Built vs. What Was Expected

---

### ✅ WHAT THE AGENT DID WELL

1. **Project structure** — Exactly matches the spec. All routes created: `/dashboard`, `/departments`, `/staff`, `/rosters`, `/rosters/[deptId]/[year]/[month]`, `/leave`, `/swaps`, `/reports`, `/settings`, `/login`.

2. **Design system** — Color palette (Deep Navy `#1A2B4A`, Sapphire `#2E86AB`, Soft Teal `#A8DADC`) correctly applied throughout. The luxe aesthetic is present.

3. **Roster Grid** — The most critical feature is well built:
   - Virtualised rows with `@tanstack/react-virtual` ✅
   - Sticky name + rank columns ✅
   - Color-coded shift cells (M/A/N/O/H/%) ✅
   - Leave span rendering across multiple columns ✅
   - Hover tooltips with staff name, date, shift details ✅
   - Click-to-edit popover with all shift options ✅
   - Conflict detection with red ring + alert icon ✅
   - Weekend column tinting ✅
   - Holiday column tinting ✅
   - Shift summary bar per day at bottom ✅
   - Monthly shift summary sidebar panel ✅

4. **Database schema** — Full Supabase migration file written covering all 8 tables with correct relationships, constraints, RLS scaffolding, and unique indexes.

5. **TypeScript types** — Complete, no `any` usage, all interfaces match the DB schema exactly.

6. **Mock data** — Realistic seed data using actual SDA Hospital department names, staff ranks (SNO, NO, SN, EN, RN, SEN), real shift time configs per department (Security uses different hours), and leave spans for testing.

7. **All pages scaffolded** — Every page has real content, not placeholder text. Staff table, leave table, swaps table, reports charts, settings with shift configs, departments grid all built.

8. **Tech stack** — Next.js 14 App Router, Supabase client/server setup, TypeScript, Tailwind v4, shadcn/ui, Recharts, jsPDF, SheetJS, React Hook Form, Zod, Sonner toasts — all installed and wired up.

9. **Security dept `%` off-day code** — Correctly handled as a distinct code with its own shift config and color class.

10. **RosterWorkspace** — State management for cell edits with optimistic updates, status badge, toolbar with export buttons.

---

### ❌ WHAT IS MISSING OR BROKEN

#### CRITICAL — Broken Core UX

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Sidebar is not responsive** — Uses `hidden lg:flex` so it completely disappears on mobile/tablet with no replacement nav. The hamburger Menu icon in the Header exists but has NO onClick handler — it does nothing. Users on small screens are completely locked out of navigation. | 🔴 Critical |
| 2 | **Sidebar has no close/collapse on desktop** — On large screens the sidebar is always open at full `w-72` width with no toggle. There is no way to collapse it to gain more workspace for the roster grid. The roster grid especially needs maximum horizontal space. | 🔴 Critical |
| 3 | **Login is fake** — The "Sign in" button is an `<Link href="/dashboard">` that navigates without any authentication. Supabase Auth client is set up but never called. No session check, no protected routes, no middleware. | 🔴 Critical |
| 4 | **Staff Profile page missing** — The spec required `/dashboard/staff/[id]` page. Clicking a staff name in `StaffDrawer` or the `StaffTable` has no destination. The route does not exist. | 🔴 Critical |
| 5 | **StaffForm, LeaveForm are static** — Forms render fields and buttons but have no `onSubmit` handler, no state update, no Supabase call. Submitting does nothing. | 🔴 Critical |

#### HIGH — Missing Features from Spec

| # | Issue | Severity |
|---|-------|----------|
| 6 | **Supabase is not connected** — All pages use `mock` data imported directly. No page makes a Supabase query. The hooks folder exists but hooks are empty stubs. The app will look correct in demo but has no real persistence. | 🟠 High |
| 7 | **No PDF export** — `RosterToolbar` has an "Export PDF" button but it calls `console.log` only. `jsPDF` is installed but the export logic in `/lib/utils/export.ts` is not implemented. | 🟠 High |
| 8 | **No Excel export** — Same situation. SheetJS (`xlsx`) is installed, button exists, no implementation. | 🟠 High |
| 9 | **Leave approval workflow is not wired** — The Leave table shows approve/reject buttons but they are static — no state change, no Supabase update, no toast feedback. | 🟠 High |
| 10 | **Swap approval is partially wired** — Approve/Reject fire `toast.success/error` only. No actual status update. | 🟠 High |
| 11 | **Roster status workflow not wired** — The Submit → Approve → Publish buttons in `RosterToolbar` fire toasts only. Status field in state never changes. | 🟠 High |
| 12 | **Reports charts use hardcoded data** — `ReportsCharts` renders with static arrays. The date range and department filter do nothing. No real aggregation from roster entries. | 🟠 High |

#### MEDIUM — Polish & Completeness

| # | Issue | Severity |
|---|-------|----------|
| 13 | **No empty states** — Departments/rosters/staff pages with zero data show blank cards, not the meaningful empty state with action prompt described in the spec. | 🟡 Medium |
| 14 | **Create Department modal missing** — "Create Department" button has no action. | 🟡 Medium |
| 15 | **Create Roster modal missing** — "Create Roster" button on rosters page has no action. | 🟡 Medium |
| 16 | **Staff deactivate action missing** — Table shows Edit action only; Deactivate not present. | 🟡 Medium |
| 17 | **Settings save buttons are static** — Hospital profile Save button has no handler. | 🟡 Medium |
| 18 | **No middleware for auth redirect** — `/middleware.ts` does not exist. Unauthenticated users can access `/dashboard` directly by URL. | 🟡 Medium |
| 19 | **Shift conflict detection is partial** — `findConflicts` checks double-booking but the 8-hour rest period rule and 3-consecutive-nights rule from the spec are not implemented. | 🟡 Medium |
| 20 | **Mobile staff schedule view** — Spec required a read-only mobile view for staff to check their own schedule. Not built. | 🟡 Medium |

---

### SUMMARY SCORECARD

| Category | Score |
|----------|-------|
| Project structure & routing | 10/10 |
| Design & color palette | 9/10 |
| Roster grid (core feature) | 9/10 |
| Database schema | 10/10 |
| TypeScript types | 10/10 |
| Authentication | 1/10 |
| Supabase data integration | 1/10 |
| Sidebar responsiveness | 0/10 |
| Form functionality | 2/10 |
| Export (PDF/Excel) | 1/10 |
| Workflow actions | 2/10 |
| **Overall** | **~55/100** |

The foundation is excellent. Structure, design, and the roster grid core are production-quality. The gap is that almost everything is read-only mock data — the app looks complete but does not actually do anything yet.

---
---

## PART 2: FIX PROMPT FOR AGENT

---

# MedRota — Fix & Complete Prompt

You have built an excellent structural foundation for MedRota. The roster grid, design system, types, and database schema are high quality. Now you need to fix critical bugs and wire up the real functionality. Work through every item below in order of priority.

---

## PRIORITY 1 — SIDEBAR RESPONSIVENESS (Fix First)

The sidebar currently uses `hidden lg:flex` and is completely broken on small and medium screens. Fix it fully.

### Requirements:
- **Mobile/tablet (< lg):** Sidebar must be hidden by default. The hamburger `<Menu />` icon in `Header.tsx` must open it as a **slide-in drawer** (overlay from left) when clicked.
- **Desktop (≥ lg):** Sidebar shows by default. Add a **collapse toggle button** (a small `<ChevronLeft />` / `<ChevronRight />` icon pinned to the right edge of the sidebar, vertically centred). When collapsed, sidebar shrinks to `w-16` (icon-only mode — show only the nav icons, hide the label text). When expanded, shows `w-72` with icons + labels. The collapse state must **persist** (use `localStorage` so it survives page refresh).

### Implementation:

**1. Create a new `SidebarContext`** at `/src/lib/context/sidebar.tsx`:
```tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";

type SidebarCtx = {
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
};

const SidebarContext = createContext<SidebarCtx | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen, collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}
```

**2. Wrap dashboard layout** in `SidebarProvider` inside `/src/app/dashboard/layout.tsx`.

**3. Rewrite `Sidebar.tsx`** to:
- On mobile: render as a fixed overlay drawer controlled by `mobileOpen`. Include a close button (X) inside the drawer header. Clicking the backdrop also closes it.
- On desktop: render inline, width transitions between `w-72` (expanded) and `w-16` (collapsed) using Tailwind `transition-all duration-200`. In collapsed mode, hide all label text (`hidden` when collapsed, `block` when expanded) but keep icons visible and centred. Show a collapse toggle button at the bottom of the nav (or pinned to the right edge).
- The nav items in collapsed mode should show icons only with a Tooltip showing the label on hover.

**4. Update `Header.tsx`** to call `setMobileOpen(true)` from `useSidebar()` when the Menu button is clicked. The Menu button should only be visible on `< lg` screens (keep `lg:hidden`).

**5. Add a dark backdrop overlay** behind the mobile sidebar (`fixed inset-0 bg-black/40 z-40 lg:hidden`) that appears when `mobileOpen` is true and closes the sidebar on click.

---

## PRIORITY 2 — AUTHENTICATION WITH SUPABASE

Replace the fake login with real Supabase Auth.

### Login page `/src/app/login/page.tsx`:
- Convert the form to a real `"use client"` component with `useState` for email, password, loading, and error.
- On submit call `supabase.auth.signInWithPassword({ email, password })`.
- On success: `router.push("/dashboard")`.
- On error: display error message below the form (e.g. "Invalid email or password").
- Show a spinner on the button while loading.

### Middleware `/src/middleware.ts` (create this file):
```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}

export const config = { matcher: ["/dashboard/:path*", "/login"] };
```

### Logout in Header:
- Replace the `<Link href="/login">` logout button with a real button that calls `supabase.auth.signOut()` then `router.push("/login")`.

---

## PRIORITY 3 — PDF EXPORT (implement fully)

Open `/src/lib/utils/export.ts` and implement `exportRosterToPDF`. It must produce output matching the physical SDA Hospital paper roster format.

```ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Department, RosterEntry, Staff } from "@/lib/types";
import { getMonthDays, monthNames } from "./dates";

export function exportRosterToPDF(
  department: Department,
  staff: Staff[],
  entries: RosterEntry[],
  year: number,
  month: number
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const days = getMonthDays(year, month);
  const deptStaff = staff.filter((s) => s.department_id === department.id && s.is_active);

  // Header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("SDA HOSPITAL, KOFORIDUA", doc.internal.pageSize.width / 2, 15, { align: "center" });
  doc.setFontSize(12);
  doc.text(department.name.toUpperCase(), doc.internal.pageSize.width / 2, 22, { align: "center" });
  doc.text("DUTY ROSTER", doc.internal.pageSize.width / 2, 29, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`${monthNames[month - 1].toUpperCase()}, ${year}`, doc.internal.pageSize.width / 2, 36, { align: "center" });

  // Day name row + date number row as the column headers
  const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const head = [
    [
      "NAME",
      "RANK",
      ...days.map((d) => d.dayNumber.toString()),
    ],
    [
      "",
      "",
      ...days.map((d) => dayNames[new Date(d.iso).getDay()]),
    ],
  ];

  const entryMap = new Map(entries.map((e) => [`${e.staff_id}_${e.shift_date}`, e]));

  const body = deptStaff.map((person) => {
    const cells = days.map((day) => {
      const entry = entryMap.get(`${person.id}_${day.iso}`);
      if (!entry) return "O";
      if (entry.is_leave) return entry.leave_type?.slice(0, 5).toUpperCase() ?? "LEAVE";
      return entry.shift_code;
    });
    return [person.full_name, person.rank ?? "", ...cells];
  });

  autoTable(doc, {
    startY: 42,
    head,
    body,
    styles: { fontSize: 7, cellPadding: 1.5, halign: "center", font: "courier" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 35 }, 1: { cellWidth: 12 } },
    headStyles: { fillColor: [26, 43, 74], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Legend at bottom
  const finalY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(8);
  doc.text("M= MORNING   A= AFTERNOON   N= NIGHT   O= OFF DAY   H= HOLIDAY   %= OFF DAY", 14, finalY);

  doc.save(`${department.name.replace(/\s+/g, "_")}_Roster_${monthNames[month - 1]}_${year}.pdf`);
}
```

Then wire it up in `RosterToolbar.tsx` — replace the `console.log` with `exportRosterToPDF(department, staff, entries, roster.year, roster.month)`.

---

## PRIORITY 4 — EXCEL EXPORT (implement fully)

In `/src/lib/utils/export.ts` also implement `exportRosterToExcel`:

```ts
import * as XLSX from "xlsx";

export function exportRosterToExcel(
  department: Department,
  staff: Staff[],
  entries: RosterEntry[],
  year: number,
  month: number
) {
  const days = getMonthDays(year, month);
  const deptStaff = staff.filter((s) => s.department_id === department.id && s.is_active);
  const entryMap = new Map(entries.map((e) => [`${e.staff_id}_${e.shift_date}`, e]));
  const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  const header1 = ["NAME", "RANK", ...days.map((d) => d.dayNumber)];
  const header2 = ["", "", ...days.map((d) => dayNames[new Date(d.iso).getDay()])];

  const rows = deptStaff.map((person) => {
    const cells = days.map((day) => {
      const entry = entryMap.get(`${person.id}_${day.iso}`);
      if (!entry) return "O";
      if (entry.is_leave) return entry.leave_type?.slice(0, 5).toUpperCase() ?? "LEAVE";
      return entry.shift_code;
    });
    return [person.full_name, person.rank ?? "", ...cells];
  });

  const ws = XLSX.utils.aoa_to_sheet([
    [`SDA HOSPITAL, KOFORIDUA — ${department.name.toUpperCase()} DUTY ROSTER — ${monthNames[month - 1].toUpperCase()} ${year}`],
    [],
    header1,
    header2,
    ...rows,
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Roster");
  XLSX.writeFile(wb, `${department.name.replace(/\s+/g, "_")}_Roster_${monthNames[month - 1]}_${year}.xlsx`);
}
```

Wire it up in `RosterToolbar.tsx` alongside the PDF export button.

---

## PRIORITY 5 — STAFF PROFILE PAGE

Create `/src/app/dashboard/staff/[id]/page.tsx`:

- Fetch `staff.find(s => s.id === params.id)` from mock (or Supabase later)
- Show: full name, rank, position, department, employment type, contact info
- Show a mini roster grid (read-only, last 3 months) listing their shift history — reuse the same shift code badges
- Show leave history table (leave type, dates, status)
- Show upcoming shifts for this month in a simple list
- Add an "Edit" button that opens `StaffForm` in a sheet/drawer pre-populated with their data
- If staff not found, call `notFound()`

---

## PRIORITY 6 — WIRE UP FORM SUBMISSIONS (mock-first, no Supabase required yet)

### StaffForm
- Add `useForm` with Zod schema validating: full_name (required), rank, position, department_id (required), employment_type, phone, email
- `onSubmit` should: (1) call a passed-in `onSuccess(newStaff)` callback or (2) update a global Zustand store, then (3) show a success toast "Staff member added"
- Add loading state to submit button

### LeaveForm
- Add `useForm` with Zod: staff_id (required), leave_type (required), start_date (required), end_date (required, must be ≥ start_date), reason
- `onSubmit`: add to local state / store + toast "Leave request submitted"

### Approve/Reject buttons (Leave page)
- Leave table approve/reject buttons must update the leave's `status` field in local state and show toast
- When a leave is approved, if the relevant roster entry exists, its `shift_code` should be updated to `"LEAVE"` automatically

---

## PRIORITY 7 — ROSTER STATUS WORKFLOW

In `RosterToolbar.tsx`, the Submit / Approve / Publish buttons must actually update the roster's `status` field.

- Pass `onStatusChange: (newStatus: RosterStatus) => void` as a prop from `RosterWorkspace`
- In `RosterWorkspace`, maintain `roster` in state so status can change
- Each button calls `onStatusChange` with the next status and shows a toast
- The `RosterStatusBadge` in the workspace header updates reactively

The status flow is: `draft` → `submitted` → `approved` → `published`
- Show only the valid next-step button (e.g. if status is `draft`, show "Submit for Approval"; if `submitted`, show "Approve"; if `approved`, show "Publish")

---

## PRIORITY 8 — REPORTS CHARTS (wire up real data)

In `ReportsCharts.tsx`, replace hardcoded arrays with props derived from actual `rosterEntries` and `leaveRequests` from mock data:

- **Staffing by Shift Type**: bar chart — count of M/A/N/O entries across all departments for the selected month
- **Absenteeism**: count of LEAVE entries per week in the month, shown as a line chart
- **Night Shift Fairness**: bar chart — per staff name, count of N shifts in the month (highlights anyone over the department average)
- The date range filter and department filter at the top of the Reports page must actually filter the data passed to the charts

---

## PRIORITY 9 — MISSING MODALS (Create Department, Create Roster)

### Create Department
- Clicking "Create Department" button opens a `<Dialog>` (shadcn) with a form: Department Name (required), Description
- On submit: add to local departments state and show toast

### Create Roster
- Clicking "Create Roster" opens a `<Dialog>` with: Department select (dropdown of existing departments), Month select (1–12), Year input
- Validate: roster for that dept/month/year doesn't already exist
- On submit: add new roster with `status: "draft"` to local state, then navigate to the roster editor

---

## ADDITIONAL NOTES

- **Do not break the existing roster grid** — it is working well. Only add to it, don't rewrite it.
- **Keep all mock data** — do not remove it. The Supabase integration will come in a future phase. All fixes above should work with mock data first.
- **The sidebar fix is the most visible bug** — do this first. A user on a laptop or tablet currently has no navigation at all.
- **No new dependencies** — everything needed is already installed (`jspdf`, `jspdf-autotable`, `xlsx`, `zustand`, `react-hook-form`, `zod`, `sonner`, `@radix-ui/react-dialog`).
- **TypeScript strict mode** — no `any`. Use the existing types in `/src/lib/types/index.ts`.
- **After all fixes**, run `npm run build` and confirm zero TypeScript errors before finishing.
