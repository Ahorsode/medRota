# MedRota — Staff & HOD Onboarding / Credential Provisioning Prompt

## CONTEXT

When HR/Admin adds a new staff member or HOD through the Staff form, the system must also create their login account automatically:

- **Email** = the email entered in the staff form
- **Initial password** = the staff member's `staff_number`
- The account is flagged so the person **must change their password on first login** before they can access anything else
- HR never has to manually create accounts in Supabase Auth — it happens automatically when staff is created

This is a real security-sensitive flow. Follow every step exactly — do not skip the forced password change, and never expose the service role key to the browser.

---

## IMPORTANT SECURITY NOTE (do not skip)

A `staff_number` is often printed on ID badges, visible on rosters, and shared in spreadsheets — it is **not a secret**. Using it as an initial password is acceptable **only** because of the forced-change-on-first-login step. If that step is ever removed or bypassed, this becomes a serious vulnerability (anyone who knows a staff number can log in as that person indefinitely). Treat the forced password change as a hard requirement, not a nice-to-have.

---

## PART 1 — DATABASE CHANGES

### Migration: `supabase/migrations/012_credential_provisioning.sql`

```sql
-- Track whether a user must change their password before using the app
alter table public.staff
  add column if not exists must_change_password boolean default true,
  add column if not exists invited_at timestamptz,
  add column if not exists password_changed_at timestamptz;

-- Index to quickly find staff who haven't activated their account
create index if not exists staff_must_change_password_idx
  on public.staff(must_change_password) where must_change_password = true;
```

### Update Prisma schema — `Staff` model

Add these three fields to the `Staff` model in `prisma/schema.prisma`:

```prisma
must_change_password Boolean   @default(true)
invited_at           DateTime? @db.Timestamptz(6)
password_changed_at  DateTime? @db.Timestamptz(6)
```

Run:
```bash
npx prisma db push
npx prisma generate
```

### Update `Staff` type — `src/lib/types/index.ts`

```ts
export interface Staff {
  // ...existing fields...
  must_change_password: boolean;
  invited_at: string | null;
  password_changed_at: string | null;
}
```

### Update `serializeStaff` — `src/lib/actions/serializers.ts`

Add the three new fields to the existing serializer, following the same `dateTime()` pattern already used for other timestamp fields:

```ts
export function serializeStaff(staff: DbStaff): Staff {
  return {
    // ...existing fields...
    must_change_password: staff.must_change_password,
    invited_at: dateTime(staff.invited_at),
    password_changed_at: dateTime(staff.password_changed_at),
  };
}
```

---

## PART 2 — SUPABASE ADMIN CLIENT (Service Role)

Creating a user account requires Supabase's **Admin API**, which needs the `SERVICE_ROLE_KEY` — a privileged key that must **never** be sent to the browser or used in any client component.

### 2a. Add the service role key to `.env.local`

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Get this from Supabase Dashboard → Project Settings → API → `service_role` secret. Confirm `.env.local` is in `.gitignore` (it should already be).

### 2b. Create `src/lib/supabase/admin.ts`

This client is **only ever imported inside `"use server"` files** — never in a client component, never in a file that could end up in the browser bundle.

```ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Admin client using the service role key.
 * SERVER-ONLY. Never import this file in a client component.
 * Bypasses RLS — use only for privileged operations like account provisioning.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client"
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

---

## PART 3 — UPDATE `createStaff` TO PROVISION A LOGIN ACCOUNT

### Update `src/lib/actions/staff.ts`

Replace the existing `createStaff` function with this version, which creates the `auth.users` account immediately after the `staff` row is created, and links them via `user_id`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/audit";
import { prisma } from "@/lib/prisma";
import { serializeStaff } from "@/lib/actions/serializers";
import { createAdminClient } from "@/lib/supabase/admin";

export type StaffInput = {
  full_name: string;
  department_id: string;
  hospital_id?: string;
  rank?: string;
  position?: string;
  employment_type?: string;
  phone?: string;
  email?: string;
  staff_number: string;
  role?: "doctor" | "nurse" | "department_head" | "hr_officer" | "admin" | "staff";
};

export async function createStaff(data: StaffInput) {
  try {
    if (!data.email) {
      return { error: "Email is required to create a staff account." };
    }

    const hospitalId =
      data.hospital_id ??
      (data.department_id
        ? (
            await prisma.department.findUnique({
              where: { id: data.department_id },
              select: { hospital_id: true },
            })
          )?.hospital_id
        : null);

    // 1. Create the Supabase Auth account using the admin client.
    //    Initial password = staff_number. User must change it on first login.
    const admin = createAdminClient();
    const { data: authResult, error: authError } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.staff_number,
      email_confirm: true, // skip email verification — HR is provisioning this directly
      user_metadata: {
        full_name: data.full_name,
        provisioned_by: "staff_form",
      },
    });

    if (authError || !authResult?.user) {
      return {
        error: authError?.message ?? "Failed to create login account for this staff member.",
      };
    }

    const userId = authResult.user.id;

    // 2. Create the staff record, linked to the new auth user.
    let staff;
    try {
      staff = await prisma.staff.create({
        data: {
          full_name: data.full_name,
          department_id: data.department_id,
          hospital_id: hospitalId ?? undefined,
          rank: data.rank,
          position: data.position,
          employment_type: data.employment_type,
          phone: data.phone,
          email: data.email,
          staff_number: data.staff_number,
          user_id: userId,
          must_change_password: true,
          invited_at: new Date(),
        },
      });
    } catch (dbError) {
      // Roll back the auth account if the staff row fails to insert,
      // so we never end up with an orphaned login with no staff record.
      await admin.auth.admin.deleteUser(userId);
      throw dbError;
    }

    // 3. Assign the role in user_roles, defaulting to "staff" if unspecified.
    await prisma.userRole.create({
      data: {
        user_id: userId,
        role: data.role ?? "staff",
        department_id: data.department_id,
      },
    });

    await logAudit({
      staffId: staff.id,
      action: "staff_account_provisioned",
      entityType: "staff",
      entityId: staff.id,
      newValue: { email: data.email, role: data.role ?? "staff" },
    });

    revalidatePath("/dashboard/staff");
    return serializeStaff(staff);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to create staff member",
    };
  }
}
```

---

## PART 4 — UPDATE STAFF FORM (collect email + role at creation time)

In `src/components/staff/StaffForm.tsx`, the form already likely has an email field. Confirm it is **required** (not optional) since the account cannot be created without it. Also add a **Role** select if it doesn't already exist:

```tsx
<div className="space-y-1">
  <Label htmlFor="role">System Role</Label>
  <select
    id="role"
    name="role"
    required
    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
    defaultValue="staff"
  >
    <option value="staff">Staff (Nurse / Doctor — self-service only)</option>
    <option value="department_head">Department Head</option>
    <option value="hr_officer">HR Officer</option>
    <option value="medical_director">Medical Director</option>
    <option value="admin">Administrator</option>
  </select>
  <p className="text-xs text-slate-400">
    Determines which dashboard the staff member sees after login.
  </p>
</div>
```

After successful submission, show a confirmation toast that includes the login instructions, since there is no email-sending system yet:

```tsx
toast.success(
  `${result.full_name} added. Login email: ${data.email} · Temporary password: ${data.staff_number}`,
  { duration: 10000 }
);
```

> Note: In a future phase this should be replaced with an actual email being sent to the staff member rather than displaying the password in a toast. Flag this to the team as a known limitation for now — for a controlled pilot rollout, HR reading the credentials off-screen to the staff member directly is an acceptable interim step, but it should not remain the long-term flow.

---

## PART 5 — FORCE PASSWORD CHANGE ON FIRST LOGIN

This is the most important part of the entire flow. Build it carefully.

### 5a. Create the Force Password Change page — `src/app/change-password/page.tsx`

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ShieldCheck, Loader2 } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    // Guard against staff re-using their staff number as the new password
    if (/^\d+$/.test(newPassword)) {
      setError("Choose a password that isn't only numbers — your staff number is not secure.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Clear the must_change_password flag via server action
    const response = await fetch("/api/auth/complete-password-change", {
      method: "POST",
    });

    if (!response.ok) {
      setError("Password updated, but we couldn't finalize your account. Please contact IT.");
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#1A2B4A]/10">
            <ShieldCheck className="h-6 w-6 text-[#1A2B4A]" />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A]">Set Your Password</h1>
          <p className="mt-1 text-sm text-slate-500">
            For your security, you must set a new password before continuing.
            This replaces the temporary password you were given.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-9"
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-9"
                required
                minLength={8}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full bg-[#1A2B4A] hover:bg-[#2E86AB]" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set Password & Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

### 5b. Create the API route to clear the flag — `src/app/api/auth/complete-password-change/route.ts`

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await prisma.staff.updateMany({
    where: { user_id: user.id },
    data: {
      must_change_password: false,
      password_changed_at: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
```

---

## PART 6 — REDIRECT LOGIC: SEND USERS TO CHANGE-PASSWORD WHEN FLAGGED

### 6a. Update root middleware — `src/middleware.ts`

The middleware must check the `must_change_password` flag and redirect there before allowing access to `/dashboard`. Since middleware can't query Prisma directly (it runs on the Edge runtime), do the check inside the dashboard layout instead — middleware only continues to handle the basic authenticated/unauthenticated split it already does.

### 6b. Update `src/app/dashboard/layout.tsx`

Add the password-change check immediately after resolving the session user:

```tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/getSessionUser";
// ...other imports

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Force password change before allowing any dashboard access
  if (user.staffRecord?.must_change_password) {
    redirect("/change-password");
  }

  // ...existing role-based sidebar rendering
}
```

### 6c. Add `must_change_password` to `SessionUser` type

In `src/lib/auth/getSessionUser.ts`, make sure the `staffRecord` object returned includes `must_change_password`:

```ts
staffRecord: staffRecord
  ? {
      id: staffRecord.id,
      full_name: staffRecord.full_name,
      // ...existing fields
      must_change_password: staffRecord.must_change_password,
    }
  : null,
```

Update the `SessionUser` type definition to match.

### 6d. Guard the `/change-password` page itself

Add a tiny check so a fully activated user can't sit on this page indefinitely — if `must_change_password` is already `false`, bounce them to `/dashboard`. Add this as a server check by converting the page to fetch session state first, or simpler: add a `useEffect` on mount that calls a small `/api/auth/session-status` route and redirects if already activated. (Optional — not required for first pass, but good practice.)

---

## PART 7 — LOGIN PAGE: HANDLE THE REDIRECT CORRECTLY

The login page's post-auth navigation (`window.location.href = "/dashboard"`) already does a full page reload, which is correct here — the dashboard layout will catch the `must_change_password` flag server-side and redirect to `/change-password` automatically. **No changes needed to the login page itself** beyond what was fixed in the previous round.

---

## PART 8 — UPDATE STAFF PROFILE TO SHOW ACCOUNT STATUS

In `src/app/dashboard/staff/[id]/page.tsx`, add a small account status indicator in the personal info card:

```tsx
{staff.must_change_password ? (
  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
    <Clock className="h-3 w-3" />
    Awaiting first login
  </span>
) : (
  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
    <CheckCircle className="h-3 w-3" />
    Account active
  </span>
)}
```

Also add an HR-only "Reset Password" action button that re-sets the password back to the staff number and flips `must_change_password` back to `true` — useful if someone forgets their password and can't self-recover yet (no forgot-password flow exists in this phase).

Add to `src/lib/actions/staff.ts`:

```ts
export async function resetStaffPassword(staffId: string) {
  try {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff?.user_id) return { error: "This staff member has no linked login account." };

    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(staff.user_id, {
      password: staff.staff_number,
    });

    if (authError) return { error: authError.message };

    await prisma.staff.update({
      where: { id: staffId },
      data: { must_change_password: true, password_changed_at: null },
    });

    await logAudit({
      staffId,
      action: "staff_password_reset",
      entityType: "staff",
      entityId: staffId,
    });

    revalidatePath(`/dashboard/staff/${staffId}`);
    return { success: true, temporaryPassword: staff.staff_number };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to reset password" };
  }
}
```

---

## FINAL CHECKLIST

- [ ] Migration `012_credential_provisioning.sql` written and run
- [ ] `Staff` Prisma model has 3 new fields
- [ ] `Staff` type updated in `types/index.ts`
- [ ] `serializeStaff` updated with new fields
- [ ] `SUPABASE_SERVICE_ROLE_KEY` added to `.env.local` (never committed, never in client code)
- [ ] `src/lib/supabase/admin.ts` created — service role client, server-only
- [ ] `createStaff` rewritten to: create auth user → create staff row → roll back auth user on DB failure → assign role in `user_roles`
- [ ] `StaffForm` collects required email + role, shows temporary password in success toast
- [ ] `src/app/change-password/page.tsx` built with validation (min length, no all-numeric, confirm match)
- [ ] `src/app/api/auth/complete-password-change/route.ts` created
- [ ] `getSessionUser()` includes `must_change_password` in `staffRecord`
- [ ] `dashboard/layout.tsx` redirects to `/change-password` when flagged
- [ ] Staff profile page shows account status badge (Awaiting first login / Active)
- [ ] `resetStaffPassword` action added for HR-initiated password resets
- [ ] Tested end-to-end: create staff → log in with staff_number → forced to change-password page → set new password → redirected to correct role dashboard
- [ ] `npm run build` passes with zero TypeScript errors

---

## RECOMMENDATION FOR A LATER PHASE

Right now the temporary password is shown to HR in a toast notification, which means HR has to relay it to the staff member verbally or in writing. For a real production rollout, replace this with:
- Supabase's built-in `admin.generateLink({ type: "invite", email })` to send a proper email invite, or
- A transactional email service (Resend, SendGrid) triggered from `createStaff` that emails the staff member their login email + a one-time setup link

This is fine for an initial pilot at a single hospital where HR can hand out credentials directly, but should not be the permanent design once more departments or sites are onboarded.
