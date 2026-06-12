# MedRota — Round 2 Audit Report
### Post-Fix Review (June 12, 2026)

---

## SCORECARD COMPARISON

| Category | Round 1 | Round 2 |
|----------|---------|---------|
| Project structure & routing | 10/10 | 10/10 |
| Design & color palette | 9/10 | 9/10 |
| Roster grid (core feature) | 9/10 | 9/10 |
| Database schema | 10/10 | 10/10 |
| **Sidebar responsiveness** | **0/10** | **9/10** ✅ |
| **Authentication** | **1/10** | **8/10** ✅ |
| **PDF / Excel export** | **1/10** | **9/10** ✅ |
| **Roster status workflow** | **2/10** | **9/10** ✅ |
| **Staff profile page** | **0/10** | **7/10** ✅ |
| Supabase data integration | 1/10 | 1/10 — not yet |
| Form functionality | 2/10 | 4/10 — partial |
| Leave/swap approval workflow | 2/10 | 2/10 — unchanged |
| Reports (real data) | 2/10 | 2/10 — unchanged |
| Create dept/roster modals | 0/10 | 0/10 — unchanged |
| **Overall** | **~55/100** | **~72/100** ✅ |

---

## ✅ WHAT WAS FIXED (Good work)

### 1. Sidebar — FULLY FIXED ✅
This was the most critical bug and it's been done correctly:
- `SidebarContext` created at `/src/lib/context/sidebar.tsx` with `mobileOpen` + `collapsed` state
- `localStorage` persistence for collapse state — survives page refresh
- Mobile: slide-in drawer with backdrop overlay, X close button, closes on nav link click
- Desktop: collapse toggle button at bottom (`ChevronLeft`/`ChevronRight`), shrinks to `w-16` icon-only mode
- Tooltips on icon-only collapsed nav items via Radix Tooltip
- `SidebarProvider` wrapping the dashboard layout
- Header hamburger button now calls `setMobileOpen(true)` — fully wired
- Backdrop `onClick` closes the drawer

### 2. Authentication — FIXED ✅
- Login form now calls `supabase.auth.signInWithPassword()`
- Loading spinner on submit button
- Error message shown below form on failed auth
- Logout button calls `supabase.auth.signOut()` then redirects to `/login`
- Middleware (`/src/lib/supabase/middleware.ts`) protects `/dashboard/*` and redirects authenticated users away from `/login`
- Graceful fallback when Supabase env keys are missing (shows informative error, doesn't crash)

### 3. PDF Export — FULLY IMPLEMENTED ✅
- `exportRosterToPdf()` in `/src/lib/utils/export.ts` — fully implemented
- A4 landscape, hospital name header, department name, month/year
- Full grid table with name, rank, and all 31 day columns
- Colour-coded cells per shift type (M=blue, A=amber, N=indigo, LEAVE=purple)
- Day names (MON/TUE etc.) as second header row
- Legend footer at bottom
- Wired to the "Export PDF" button in RosterToolbar ✅

### 4. Excel Export — FULLY IMPLEMENTED ✅
- `exportRosterToExcel()` using SheetJS
- Hospital name, department, month/year in top rows
- Full staff grid with shift codes
- Legend row at bottom
- Wired to "Export Excel" button in RosterToolbar ✅

### 5. Roster Status Workflow — FIXED ✅
- `RosterWorkspace` now holds `roster` in state
- `onStatusChange` prop passed down to `RosterToolbar`
- Status badge updates reactively when workflow advances
- Only the correct next-step button shows (draft→submitted→approved→published)
- Published date set automatically when status reaches `published`
- Toast on each transition

### 6. Staff Profile Page — BUILT ✅
- `/dashboard/staff/[id]` page exists
- Shows personal info card (staff number, rank, employment, phone, email)
- Shows upcoming shifts as badge list
- `notFound()` called for unknown IDs

---

## ❌ STILL MISSING / BROKEN

### 🔴 Critical

**1. `/src/middleware.ts` does not exist**
The auth protection exists in `/src/lib/supabase/middleware.ts` but there is NO `/src/middleware.ts` at the project root. Next.js only reads middleware from the root `src/middleware.ts` file. The protection is completely non-functional — anyone can still access `/dashboard` directly without logging in.

**Fix:** Create `/src/middleware.ts`:
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

### 🟠 High Priority

**2. Forms are half-done — submit only shows a toast, nothing actually changes**

- `StaffForm`: Validates correctly with Zod, but `onSubmit` shows `toast.success("... ready to add once Supabase is connected")`. No state update at all. A user submitting the form sees a success toast but no new row appears in the table.
- `LeaveForm`: Same — valid Zod schema, `onSubmit` shows toast but the leave table below doesn't gain a new row. The form fields are also too minimal (no department select, no proper leave type dropdown — just free text inputs).

**3. Leave approval buttons still fake**
`LeaveTable` approve/reject buttons fire `toast.success/error` only. The `leave.status` badge in the row never changes. This was listed as Priority 6 in the fix prompt and was not done.

**4. Swap approval buttons still fake**
Same situation — toasts only, no state update.

**5. Reports charts are still 100% hardcoded**
`ReportsCharts` still uses static arrays defined at the top of the file. The date range picker and department filter on the Reports page still do nothing. This was Priority 8 in the fix prompt and was not done.

**6. Supabase never actually called for data**
All pages still read from mock data. This is expected as a future phase — but worth noting the hooks in `/src/lib/hooks/` are still empty stubs.

---

### 🟡 Medium Priority

**7. Staff profile page is missing key features from spec**
The page was built but is missing:
- No "Edit" button / StaffDrawer pre-populated with their data
- No leave history section (only shift history shown)
- Shift history shows first 18 entries raw — not grouped by month or filtered to upcoming

**8. Create Department modal — button still has no onClick**
The "Create Department" button has no action. No dialog opens.

**9. Create Roster modal — button still has no onClick**
Same — "Create Roster" on the rosters overview page does nothing.

**10. Staff table — no link to profile page**
The `StaffTable` component has no link/button to navigate to `/dashboard/staff/[id]`. The profile page exists but is unreachable from the UI.

**11. Settings save buttons still static**
Hospital profile Save button has no handler.

---

## WHAT TO FIX NEXT — Prioritised

### Fix 1 — Middleware (10 minutes, most impactful)
Create `/src/middleware.ts` as shown above. Without this, auth protection does not work at all regardless of what's in the supabase middleware file.

### Fix 2 — Leave & Swap approval state (1–2 hours)
Convert `LeaveTable` and the Swaps page to use local `useState` for the list. Approve/reject buttons update the specific item's status in state and show a toast. The badge changes colour reactively.

```tsx
// LeaveTable pattern
const [leaves, setLeaves] = useState(initialLeaves);

function handleApprove(id: string) {
  setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: "approved" } : l));
  toast.success("Leave approved");
}
```

### Fix 3 — StaffForm actually adds to table (1 hour)
Move the `staff` state up to the `StaffPage` level. Pass `staff` down as a prop to `StaffTable` and an `onAdd` callback down to `StaffForm`. When the form submits, generate a mock new staff object and call `onAdd`. The table gains a new row immediately.

### Fix 4 — Staff table links to profile (30 minutes)
In `StaffTable.tsx`, wrap each staff name cell in `<Link href={/dashboard/staff/${person.id}}>`. Add a "View" action button in the actions column.

### Fix 5 — Create Department / Create Roster modals (2 hours)
Add shadcn `<Dialog>` modals triggered by the existing buttons. Simple form inside each — on submit add to local state list (same pattern as StaffForm fix above).

### Fix 6 — Reports use real data (2 hours)
Import `rosterEntries` from mock data. Derive chart data by aggregating over the entries:
```ts
// Staffing summary — count M/A/N per department
const staffing = departments.map(dept => ({
  department: dept.name,
  Morning: entries.filter(e => e.shift_code === "M" && staffInDept(e.staff_id, dept.id)).length,
  Afternoon: entries.filter(e => e.shift_code === "A" && staffInDept(e.staff_id, dept.id)).length,
  Night: entries.filter(e => e.shift_code === "N" && staffInDept(e.staff_id, dept.id)).length,
}));
```

---

## SUMMARY

Your agent addressed all 5 Priority 1 items correctly (sidebar, auth, PDF, Excel, roster workflow). That's the most visible and important work done well.

What remains is mostly Priority 6–9 from the original list — the interactive state management for approvals, modals, and form submissions — plus the critical missing `/src/middleware.ts` file which is a 5-line fix that re-enables all auth protection.

The app is now at a solid **72/100** — looks complete, navigation works everywhere, exports work, auth is wired. The remaining gaps are all "actions that do something" rather than structural issues.
