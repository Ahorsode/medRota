# Fix Prompt: PoultryHub Ghana — Phase 1 Audit Fixes

This is a follow-up pass on the existing `proultryHUB` repository. The build is in good shape overall — the core architecture, database-separation rule, calculation engine, and page structure all match the original spec correctly. This prompt addresses specific issues found in a code review. Work through them in order. Do not restructure anything not listed here.

---

## 1. Remove the fabricated user identity (real bug)

**Files:** `src/components/admin/sidebar.tsx`, `src/app/admin/page.tsx`

The sidebar currently shows a hardcoded user card — initials "AA", name "Akosua A.", role "Owner" — and the dashboard greets with `"Good morning, Akosua"`. No authentication exists yet (per `app/admin/layout.tsx`'s own TODO comment), so this invents an identity that isn't real and could confuse the actual client when they see it.

Fix:
- In `sidebar.tsx`, remove the hardcoded "Akosua A." / "Owner" profile block entirely, or replace it with a neutral placeholder (e.g. "Owner Account" with no invented name) and a comment noting it should be wired to real user data once auth is added.
- In `admin/page.tsx`, replace `"Good morning, Akosua"` with a time-of-day-independent, name-independent greeting (e.g. `"Dashboard overview"` or `"Welcome back"`). Do not invent a name. If a personalized greeting is wanted later, it should pull from real session data once auth exists — not before.

---

## 2. Remove the fabricated "Across 5 regions" stat

**File:** `src/app/admin/page.tsx`

The "Active projects" card shows `"Across 5 regions"` as static text, unrelated to actual data. Replace it with a real derived value — count the distinct `region_id` values across active projects — or remove the line if it's not worth the extra query/computation. Do not leave a hardcoded number that doesn't reflect the data on screen.

---

## 3. Display `specification_snapshot` on the project detail page

**Files:** `src/app/admin/projects/[id]/page.tsx`, `src/lib/data.ts` (createProjectFromQuote, for reference — no change needed there)

`specification_snapshot` is correctly captured when a quote converts to a project (land area, building dimensions, cage count, cost breakdown at time of acceptance), but it is never rendered anywhere. This defeats its purpose: the owner should be able to see what was agreed for a project without reopening the original quote, and the original quote may later change or no longer reflect the project as-built.

Fix: add a "Project Specification" card to `/admin/projects/[id]`, populated from `project.specification_snapshot`, showing at minimum: land area, building dimensions, cage count, water system notes, and the cost breakdown by trade at time of acceptance. Place it near the top of the page, above or alongside the budget/payments section. Handle the case where `specification_snapshot` is empty or missing keys gracefully (don't crash if a field is absent — this matters for the demo-store seed data, which currently uses a different, smaller shape than the real conversion flow produces; see Section 5 below).

---

## 4. Guard against division by zero on budget percentage calculations

**Files:** `src/app/admin/page.tsx`, `src/app/admin/projects/[id]/page.tsx`

Three places divide by `project.budget_total` without checking it's greater than zero:

- `src/app/admin/page.tsx` — the "Budget vs spend" table's percent calculation
- `src/app/admin/page.tsx` — the "Budget risk > 80%" attention-required count
- `src/app/admin/projects/[id]/page.tsx` — `spentPercent` calculation

If `budget_total` is ever `0` (e.g. a project is registered before a budget is finalized), these currently produce `NaN` or `Infinity`, which will render incorrectly. Add a guard in each case — e.g. treat percent as `0` when `budget_total <= 0` — rather than dividing directly.

---

## 5. Align demo-store specification_snapshot shape with the real conversion flow

**File:** `src/lib/demo-store.ts`

The seeded demo projects use `specification_snapshot: { houseCount: X, cageCount: Y }`, but the real `createProjectFromQuote` function in `src/lib/data.ts` produces a snapshot with a different, more detailed shape (`land_area_sqm`, `building_length_m`, `building_width_m`, `building_height_m`, `cage_count`, `water_system_notes`, `cost_carpentry`, `cost_masonry`, `cost_electrical`, `cost_water_system`, `cost_total`).

Once Section 3 above is implemented, this mismatch will cause the new "Project Specification" card to render incompletely or oddly for demo-mode projects. Update the seed data in `demo-store.ts` to produce snapshots matching the real shape (you can generate them by calling `calculateQuoteSpecification` for each seeded project, the same way `makeQuote` already does for quotes) so demo mode and real mode display consistently.

---

## 6. Fix trade-cost rounding so totals reconcile exactly

**File:** `src/lib/calculate-quote.ts`

Currently, `costTotal` is rounded once, and each trade cost (`costCarpentry`, `costMasonry`, `costElectrical`, `costWaterSystem`) is independently rounded from a percentage of that total. Because each is rounded separately, the four trade costs will not always sum exactly to `costTotal` — this will look like an arithmetic error to the owner or a customer reviewing a quote.

Fix: round the first three trade costs normally, then set the fourth (e.g. `costWaterSystem`) to `costTotal` minus the sum of the other three. This guarantees the breakdown always reconciles exactly to the displayed total. Add a short comment explaining why the last value is calculated this way rather than independently rounded.

---

## 7. Complete a real visual QA pass

**File:** `design-qa.md` (update after fixing), no code change required unless visual bugs are found

The existing `design-qa.md` discloses that the previous build pass never actually captured a screenshot of the running app — the browser tool failed locally, so visual fidelity (typography, spacing, responsive layout, chart rendering) was never confirmed against the intended design, despite build/lint/typecheck passing.

Run the app locally (`npm run dev`), and visually inspect, at minimum:
- `/` (public estimate page) — form interaction, estimate display, responsive layout at mobile width
- `/customer` — static layout at mobile and desktop width
- `/admin` — dashboard cards, chart rendering, table layout
- `/admin/quotes` and `/admin/quotes/[id]` — form layout, recalculate confirmation flow, status badges
- `/admin/projects` and `/admin/projects/[id]` — all four summary cards, expense/payment tables, the Farm Performance panel in both its populated and "no data yet" states (test by using a `customer_name` containing "pending", which the mock fetcher treats as not-yet-handed-over)

Fix any visual bugs found (overflow, misaligned cards, broken responsive behavior) and update `design-qa.md` to reflect that this pass was actually completed, replacing the "blocked" status with real findings or a clean pass.

---

## 8. Note on RLS policies (no action required now, just confirm understanding)

`supabase/migrations/20260619000100_initial_schema.sql` enables RLS on every table but defines no policies, relying entirely on `anon`/`authenticated` being revoked and only `service_role` being granted access. This is safe as long as all reads/writes continue to go exclusively through `src/lib/supabase/admin.ts` (the service-role client) — which is the case today. Add a short comment in the migration file directly above the `enable row level security` lines noting that this is intentional and will need real RLS policies once Supabase Auth is introduced (per the Section 8 TODO in `admin/layout.tsx`), so a future contributor doesn't mistake the absence of policies for an oversight.

---

## Out of scope for this pass

Do not add authentication, do not build the construction-crew or customer-portal real functionality, and do not change the read-only external-farm-data integration approach — all of that remains correctly deferred per the original build prompt.

## Verification checklist before calling this done

- [ ] `npm run build` completes with no errors
- [ ] `npm run typecheck` completes with no errors
- [ ] `npm run lint` completes with no errors
- [ ] No hardcoded names or fabricated stats remain in `/admin`
- [ ] A project's specification is visible on its detail page, in both demo mode and real-Supabase mode
- [ ] No `NaN%` or `Infinity` can appear anywhere budget percentages are shown, even with a project at `budget_total = 0`
- [ ] A generated quote's four trade costs sum exactly to its total, for several different flock sizes
- [ ] `design-qa.md` reflects an actual completed visual pass, not a blocked one
