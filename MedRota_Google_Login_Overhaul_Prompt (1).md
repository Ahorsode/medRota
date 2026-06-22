# MedRota — Login Overhaul: Google Sign-In + Flexible HR Credentials + Profile Self-Service

## WHAT THIS PHASE DELIVERS

1. **"Continue with Google"** as the primary sign-in option on the login page
2. Google sign-in only succeeds if the Google account's email matches an existing `staff.email` — otherwise reject with a clear message and a **"Request Access"** action that notifies HR
3. **HR can issue credentials using either email or phone number** as the login identifier when creating a staff member
4. **Forced password change on first login is NOT skippable** — this is a hard security requirement, not a UX preference (see reasoning below)
5. Staff/HOD can **add a password login method** from their Profile page even if they normally sign in with Google — and vice versa, Google users can link Google to an existing password account
6. One human = one `auth.users` row, regardless of how many sign-in methods they use (identity linking, not duplication)
7. Every credential-related event is written to the audit log

---

## WHY THE PASSWORD CHANGE CANNOT BE SKIPPABLE

A `staff_number` or phone number is not a secret — it's printed on ID badges, visible in shared rosters, and known to colleagues. The forced password change is the only thing that closes that gap. If a person can skip it, the account stays protected by a guessable credential indefinitely. Do not add a "Skip for now" button anywhere in this flow. Everything else about onboarding (profile photo, bio, etc.) can be skippable — this specific step cannot.

---

## PART 1 — SUPABASE DASHBOARD SETUP (You must do this manually — your agent cannot do this part)

Before any code will work, complete these steps in the Supabase Dashboard:

### 1a. Enable Google as an OAuth provider

1. Go to **Supabase Dashboard → Authentication → Providers → Google**
2. Toggle it **ON**
3. You need a **Google Cloud OAuth Client ID and Secret**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project (or use an existing one)
   - Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Add an **Authorized redirect URI**. Supabase shows you the exact URL to use — it looks like:
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
   - Copy the generated **Client ID** and **Client Secret**
4. Paste the Client ID and Client Secret into the Google provider settings in Supabase and **Save**

### 1b. Set your Site URL and Redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**:
- **Site URL**: your production URL (e.g. `https://medrota.vercel.app`) or `http://localhost:3000` for local dev
- **Redirect URLs**: add both:
  ```
  http://localhost:3000/auth/callback
  https://your-production-domain.com/auth/callback
  ```
  Without this, Google will redirect back to your app but Supabase will reject the callback.

### 1c. Decide on domain restriction (optional but recommended)

If your hospital staff use an institutional Google Workspace (e.g. `@sdahospital.gov.gh`), you can restrict Google sign-in to that domain only, which prevents anyone with a personal Gmail from even attempting sign-in. This is set in the Google Cloud OAuth consent screen under **Authorized domains**, not in Supabase. If staff use personal Gmail accounts, skip this — your app-level email-matching check (Part 3) is the real gatekeeper either way.

### 1d. Confirm your Service Role Key is set

You should already have this from the credential-provisioning phase. Confirm `.env.local` contains:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
This is required for identity linking and for the admin client used to create/update accounts.

### 1e. Enable "Manual Linking" for identities

In **Supabase Dashboard → Authentication → Settings**, find the **"Allow manual linking"** toggle and turn it **ON**. Without this, Supabase will not let you programmatically link a Google identity to an existing email/password account — they'd remain two separate `auth.users` rows even if they're the same email.

### 1f. Set up Twilio so the Phone provider can be enabled

This step is required **only if HR will be allowed to issue phone-number-based logins** (Part 4 of this prompt). If you've decided to drop the phone option and stick to email + Google only, skip this section entirely and tell your agent to remove the phone path from `createStaff` (see the note at the end of Part 4).

Supabase's Phone provider will not activate at all unless an SMS provider is configured at the project level — this is true even though MedRota never actually sends an OTP/SMS in normal use (see the explanation at the end of Part 4 for why). The toggle and the SMS credentials are bundled together in Supabase's settings UI, so there's no way to skip this if you want phone-based login.

**Steps:**

1. **Create a Twilio account** at [twilio.com/try-twilio](https://www.twilio.com/try-twilio). Verify your email and phone number. You'll land on the Twilio Console with trial credit (no credit card required to start).

2. **Get your Account SID and Auth Token** — on the Twilio Console Dashboard, find the **"Account Info"** panel. Copy the **Account SID** (starts with `AC...`) and click "Show" to reveal the **Auth Token**.

3. **Buy a phone number** — go to **Phone Numbers → Manage → Buy a Number**, filter by SMS capability, pick any available number, click Buy. Free on a trial account.

   > Ghana-specific note: if your staff have Ghanaian phone numbers, check Twilio's country coverage/regulatory page for Ghana before relying on this in production. Since MedRota never actually sends a real OTP through this path, it matters less right now — but worth knowing if OTP login is ever added later.

4. **Create a Messaging Service** — go to **Messaging → Services → Create Messaging Service**. Name it (e.g. `MedRota OTP`), choose **"Notify my users"** as the use case, add the phone number from step 3 as a Sender, finish the wizard. Copy the **Service SID** (starts with `MG...`) from the Messaging Service's Overview page.

5. **Enter the credentials into Supabase** — go to **Supabase Dashboard → Authentication → Providers → Phone**:

   | Field | Value |
   |---|---|
   | SMS provider | Twilio |
   | Twilio Account SID | from step 2 |
   | Twilio Auth Token | from step 2 |
   | Twilio Message Service SID | the `MG...` SID from step 4 |
   | Twilio Content SID | leave blank (WhatsApp only) |
   | Enable phone confirmations | leave **OFF** — MedRota uses `phone_confirm: true` in code to skip OTP verification entirely |
   | SMS OTP Expiry / Length / Message | leave as default, irrelevant since no OTP is sent |

   Click **Save**, then refresh the page and confirm there are no red "required" field warnings left.

6. **Know what to expect afterward** — this setup only unlocks the Phone provider toggle. It does not change how staff log in with a phone number; they still authenticate with a password against their phone number, exactly like email/password login, just using a different identifier. No real SMS should ever be sent through normal MedRota usage, and no Twilio charges should accumulate. If that ever changes (a text unexpectedly goes out, or `Enable phone confirmations` gets toggled on by mistake), treat it as a bug — see the explanation in Part 4 for exactly why no OTP should ever fire.

   > One trial-account limitation to know: Twilio trial accounts can usually only send SMS to numbers manually verified under **Phone Numbers → Verified Caller IDs**. This won't affect you since MedRota doesn't send real SMS in this flow — it only matters if you later turn on `Enable phone confirmations` and start testing real OTP delivery.

---

## PART 2 — DATABASE CHANGES

### Migration: `supabase/migrations/013_login_methods.sql`

```sql
-- Track the contact method used for HR-issued login (email or phone)
alter table public.staff
  add column if not exists login_identifier_type text default 'email'
    check (login_identifier_type in ('email', 'phone')),
  add column if not exists access_requests_email text;

-- Table to log "Request Access" attempts from unregistered Google sign-ins
create table if not exists public.access_requests (
  id              uuid primary key default gen_random_uuid(),
  attempted_email text not null,
  google_name     text,
  status          text default 'pending'
    check (status in ('pending', 'resolved', 'dismissed')),
  resolved_by     uuid references auth.users(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz default now()
);

create index access_requests_status_idx on public.access_requests(status);

alter table public.access_requests enable row level security;

create policy "Admins and HR read access requests"
  on public.access_requests for select to authenticated
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'hr_officer')
  ));

create policy "Admins and HR manage access requests"
  on public.access_requests for update to authenticated
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'hr_officer')
  ));

-- Realtime so HR sees new access requests live
alter publication supabase_realtime add table public.access_requests;
```

### Prisma schema additions

Add to `Staff` model in `prisma/schema.prisma`:
```prisma
login_identifier_type String  @default("email")
```

Add new model:
```prisma
model AccessRequest {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  attempted_email String
  google_name     String?
  status          String    @default("pending")
  resolved_by     String?   @db.Uuid
  resolved_at     DateTime? @db.Timestamptz(6)
  created_at      DateTime  @default(now()) @db.Timestamptz(6)

  @@map("access_requests")
  @@schema("public")
}
```

Run:
```bash
npx prisma db push
npx prisma generate
```

### Update types — `src/lib/types/index.ts`

```ts
export interface AccessRequest {
  id: UUID;
  attempted_email: string;
  google_name: string | null;
  status: "pending" | "resolved" | "dismissed";
  resolved_by: UUID | null;
  resolved_at: string | null;
  created_at: string;
}
```

Add `login_identifier_type: "email" | "phone";` to the `Staff` interface.

### Update serializers — `src/lib/actions/serializers.ts`

Add `serializeAccessRequest` following the existing pattern, and include `login_identifier_type` in `serializeStaff`.

---

## PART 3 — GOOGLE SIGN-IN FLOW

### 3a. Create the OAuth callback route — `src/app/auth/callback/route.ts`

This is the route Supabase redirects to after Google auth completes. It exchanges the code for a session, then checks whether the email matches a staff record.

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const googleEmail = data.user.email;
  if (!googleEmail) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=no_email`);
  }

  // Check if a staff record exists with this email
  const staffRecord = await prisma.staff.findFirst({
    where: { email: googleEmail, is_active: true },
  });

  if (!staffRecord) {
    // No matching staff record — sign them out immediately, do not allow access
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=not_registered&email=${encodeURIComponent(googleEmail)}`
    );
  }

  // If the staff record has no user_id yet (first-ever Google sign-in for this person),
  // link this auth user to the staff record now.
  if (!staffRecord.user_id) {
    await prisma.staff.update({
      where: { id: staffRecord.id },
      data: {
        user_id: data.user.id,
        must_change_password: false, // Google sign-in is already a secure auth method
      },
    });
  } else if (staffRecord.user_id !== data.user.id) {
    // The staff record is linked to a DIFFERENT auth user (likely their email/password account).
    // This means the same person now has two auth.users rows. Attempt to link identities.
    // See Part 5 for the linking helper — call it here.
    const { linkGoogleIdentityToExistingStaffUser } = await import("@/lib/auth/linkIdentity");
    await linkGoogleIdentityToExistingStaffUser(staffRecord.user_id, data.user.id, googleEmail);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
```

### 3b. Update the login page — `src/app/login/page.tsx`

Add a "Continue with Google" button above the existing email/password form, and handle the `?error=` query params for clear messaging.

```tsx
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, LockKeyhole, Mail, Stethoscope, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createLoginSession } from "@/lib/actions/sessions";
import { createClient } from "@/lib/supabase/client";
import { submitAccessRequest } from "@/lib/actions/accessRequests";
import { toast } from "sonner";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.69-2.26 1.1-3.71 1.1-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.14c-.22-.69-.35-1.42-.35-2.14s.13-1.45.35-2.14V7.02H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.98l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.02l3.66 2.84c.87-2.6 3.3-4.48 6.16-4.48z" />
  </svg>
);

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unregisteredEmail, setUnregisteredEmail] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const emailParam = searchParams.get("email");

    if (errorParam === "not_registered" && emailParam) {
      setUnregisteredEmail(emailParam);
      setError(null);
    } else if (errorParam === "auth_failed") {
      setError("Google sign-in failed. Please try again or use your password.");
    } else if (errorParam === "no_email") {
      setError("Your Google account has no email address attached.");
    }
  }, [searchParams]);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
    // On success, the browser redirects away — no further action needed here.
  }

  async function handleRequestAccess() {
    if (!unregisteredEmail) return;
    const result = await submitAccessRequest(unregisteredEmail);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Request sent to HR. They'll add your email and notify you.");
      setUnregisteredEmail(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await createClient().auth.signInWithPassword({ email, password });

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
          // Session logging should not block login.
        }
      }

      window.location.href = "/dashboard";
    } catch {
      setError("Supabase environment keys are missing. Add them to .env.local to enable login.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1A2B4A] p-6">
      <Card className="w-full max-w-md border-white/10 shadow-2xl">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-[#A8DADC] text-[#1A2B4A]">
            <Stethoscope className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">MedRota</CardTitle>
          <p className="text-sm text-slate-500">Sign in to manage SDA Hospital duty rosters.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Unregistered Google email — show Request Access prompt */}
          {unregisteredEmail && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-2">
                  <p>
                    <strong>{unregisteredEmail}</strong> isn&apos;t registered in MedRota.
                    Ask HR to add your email, or sign in below with your staff credentials.
                  </p>
                  <Button size="sm" variant="outline" onClick={handleRequestAccess}
                    className="border-amber-300 text-amber-700 hover:bg-amber-100">
                    Notify HR — Request Access
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Google Sign-In */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">or sign in with credentials</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Email/Password form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold text-slate-700">
              Email or Phone
              <span className="relative mt-1 block">
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  type="text"
                  placeholder="you@sdahospital.org or 024XXXXXXX"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <span className="relative mt-1 block">
                <LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </span>
            </label>
            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}
            <Button className="w-full" variant="navy" type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

> Note: the "Email or Phone" input currently still calls `signInWithPassword({ email, password })`. Phone-based login requires resolving the phone number to the matching account's email server-side first — see Part 6 for how to wire this without switching Supabase's auth mechanism.

### 3c. Access Request server action — `src/lib/actions/accessRequests.ts`

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/audit";

export async function submitAccessRequest(email: string) {
  try {
    const existing = await prisma.accessRequest.findFirst({
      where: { attempted_email: email, status: "pending" },
    });
    if (existing) {
      return { success: true, message: "Your request is already pending with HR." };
    }

    await prisma.accessRequest.create({
      data: { attempted_email: email },
    });

    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to submit request" };
  }
}

export async function getAccessRequests(status: "pending" | "resolved" | "dismissed" = "pending") {
  try {
    const requests = await prisma.accessRequest.findMany({
      where: { status },
      orderBy: { created_at: "desc" },
    });
    return requests;
  } catch {
    return [];
  }
}

export async function resolveAccessRequest(id: string, resolvedBy: string, dismiss = false) {
  try {
    await prisma.accessRequest.update({
      where: { id },
      data: {
        status: dismiss ? "dismissed" : "resolved",
        resolved_by: resolvedBy,
        resolved_at: new Date(),
      },
    });
    await logAudit({
      action: "access_request_resolved",
      entityType: "access_request",
      entityId: id,
    });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to resolve request" };
  }
}
```

### 3d. Show pending Access Requests to HR

Add a card or tab to `/dashboard/settings` (or the HR Dashboard) listing pending access requests with the attempted email, timestamp, and two actions: **"Go to Staff → Add Email"** (deep link) and **"Dismiss"**. Use a Realtime subscription on `access_requests` so new requests appear live without a refresh, following the same pattern as the existing `NotificationBell` component.

---

## PART 4 — HR ISSUES CREDENTIALS WITH EMAIL OR PHONE

### 4a. Update `StaffForm` to let HR choose the identifier type

Add a toggle/radio group above the contact fields:

```tsx
<div className="space-y-2">
  <Label>Login Identifier</Label>
  <div className="flex gap-2">
    <button type="button"
      onClick={() => setIdentifierType("email")}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
        identifierType === "email" ? "border-[#2E86AB] bg-blue-50 text-[#1A2B4A]" : "border-slate-200 text-slate-500"
      }`}>
      Use Email
    </button>
    <button type="button"
      onClick={() => setIdentifierType("phone")}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
        identifierType === "phone" ? "border-[#2E86AB] bg-blue-50 text-[#1A2B4A]" : "border-slate-200 text-slate-500"
      }`}>
      Use Phone Number
    </button>
  </div>
  <p className="text-xs text-slate-400">
    This determines what the staff member types in to log in. They can still add the other method later from their profile.
  </p>
</div>
```

### 4b. Update `createStaff` to handle phone-based provisioning

Supabase Auth's `createUser` admin call accepts either `email` or `phone` — not a fabricated email. Update `src/lib/actions/staff.ts`:

```ts
export async function createStaff(data: StaffInput & { login_identifier_type?: "email" | "phone" }) {
  try {
    const identifierType = data.login_identifier_type ?? "email";

    if (identifierType === "email" && !data.email) {
      return { error: "Email is required when using email as the login identifier." };
    }
    if (identifierType === "phone" && !data.phone) {
      return { error: "Phone number is required when using phone as the login identifier." };
    }

    const hospitalId = /* ...unchanged... */;

    const admin = createAdminClient();
    const createPayload =
      identifierType === "phone"
        ? { phone: data.phone!, password: data.staff_number, phone_confirm: true }
        : { email: data.email!, password: data.staff_number, email_confirm: true };

    const { data: authResult, error: authError } = await admin.auth.admin.createUser({
      ...createPayload,
      user_metadata: { full_name: data.full_name, provisioned_by: "staff_form" },
    });

    if (authError || !authResult?.user) {
      return { error: authError?.message ?? "Failed to create login account." };
    }

    const userId = authResult.user.id;

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
          login_identifier_type: identifierType,
          invited_at: new Date(),
        },
      });
    } catch (dbError) {
      await admin.auth.admin.deleteUser(userId);
      throw dbError;
    }

    await prisma.userRole.create({
      data: { user_id: userId, role: data.role ?? "staff", department_id: data.department_id },
    });

    await logAudit({
      staffId: staff.id,
      action: "staff_account_provisioned",
      entityType: "staff",
      entityId: staff.id,
      newValue: { identifier_type: identifierType, role: data.role ?? "staff" },
    });

    revalidatePath("/dashboard/staff");
    return serializeStaff(staff);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create staff member" };
  }
}
```

> **Important Supabase note:** phone-based auth requires an SMS provider configured in **Supabase Dashboard → Authentication → Providers → Phone**. Supabase doesn't send SMS itself — you must connect a provider like Twilio, MessageBird, or Vonage and enter their credentials there. This is required to enable the Phone provider toggle at all, even though MedRota never sends a real OTP through it. See Part 1f above for the full Twilio setup walkthrough.
>
> **Why no real SMS is ever sent in this flow:** the `phone_confirm: true` flag passed into `admin.auth.admin.createUser()` tells Supabase to treat the phone number as already verified, skipping the OTP/SMS step entirely. The staff member then logs in with their phone number + a password — functionally identical to email/password login, just using a different identifier. The Twilio setup in Part 1f exists purely to satisfy Supabase's project-level requirement to activate the Phone provider; it is not actually used in MedRota's day-to-day login flow. If you ever see a real SMS go out or a Twilio charge accumulate from normal usage, treat that as a bug — it should never happen with this flow as designed.
>
> **If you decide not to set up Twilio:** drop the phone-identifier option entirely and keep email + Google only. To do this, remove the `identifierType === "phone"` branch from `createStaff` in Part 4b below, remove the "Use Phone Number" toggle button from `StaffForm` in Part 4a, and remove `login_identifier_type` handling from the login page's "Email or Phone" input (revert it to "Email" only). This is the simpler and recommended path unless you have a real population of staff without email addresses.

---

## PART 5 — IDENTITY LINKING

This is the part most likely to be done wrong if rushed. Build it carefully.

### 5a. Create `src/lib/auth/linkIdentity.ts`

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/actions/audit";

/**
 * Called when a Google sign-in is detected for a staff member who already
 * has a separate auth.users row (created via HR's email/password provisioning).
 *
 * Strategy: rather than fighting Supabase's identity model, we treat the
 * ORIGINAL HR-created auth user as the "source of truth" account, and we
 * record the Google sign-in as a linked alternate method by updating that
 * original user's identities via the admin API, then making the staff
 * record's user_id continue pointing at the original account.
 *
 * The newly created Google-only auth.users row becomes orphaned (no staff
 * record), so we deactivate it to avoid confusion, since the canonical
 * account is the original one.
 */
export async function linkGoogleIdentityToExistingStaffUser(
  originalUserId: string,
  googleAuthUserId: string,
  email: string
) {
  const admin = createAdminClient();

  try {
    // Mark the duplicate Google-only auth user as banned/inactive so it can
    // never be used to sign in directly — all future Google sign-ins for
    // this email will still hit this same duplicate row, so instead we
    // update app_metadata to flag it as "merged" and short-circuit future
    // logins to redirect to the original account context.
    await admin.auth.admin.updateUserById(googleAuthUserId, {
      app_metadata: { merged_into: originalUserId, merged_at: new Date().toISOString() },
    });

    await logAudit({
      action: "identity_linked",
      entityType: "staff",
      newValue: { original_user_id: originalUserId, google_user_id: googleAuthUserId, email },
    });
  } catch (error) {
    console.error("Identity linking failed:", error);
  }
}
```

> **Why not use Supabase's native `linkIdentity()`?** Supabase's client-side `linkIdentity()` API links a new OAuth provider to the **currently signed-in session** — it's designed for "I'm logged in, now let me add Google to my account" (which is exactly Part 6's use case below), not for "two separate accounts already exist for the same email and need merging after the fact," which is an admin-side operation Supabase doesn't fully automate. The approach above is a pragmatic workaround: keep the HR-created account as canonical, and tag the duplicate so your app logic always resolves back to the original. Revisit this if Supabase ships a more complete account-merge API in the future.

### 5b. Update the OAuth callback to check for merged accounts

In `src/app/auth/callback/route.ts`, after a successful Google session, check `app_metadata.merged_into` and if present, redirect with a message rather than silently logging into the wrong identity context. In practice, since the staff record continues to point at the original `user_id`, the dashboard layout's `getSessionUser()` call will resolve correctly either way as long as you query `staff` by `email` first (matching Part 3a's logic) rather than strictly by `user_id`.

---

## PART 6 — PROFILE SELF-SERVICE: ADD A LOGIN METHOD

### 6a. "Add Google Sign-In" from Profile (for password-first users)

In `src/app/dashboard/my-profile/page.tsx`, add a "Login Methods" card:

```tsx
import { LoginMethodsCard } from "@/components/staff/LoginMethodsCard";
// ...
<LoginMethodsCard staffEmail={staff.email} />
```

### 6b. Create `src/components/staff/LoginMethodsCard.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";

export function LoginMethodsCard({ staffEmail }: { staffEmail: string | null }) {
  const [identities, setIdentities] = useState<{ provider: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUserIdentities().then(({ data }) => {
      if (data?.identities) setIdentities(data.identities);
    });
  }, []);

  const hasGoogle = identities.some((i) => i.provider === "google");
  const hasPassword = identities.some((i) => i.provider === "email" || i.provider === "phone");

  async function handleLinkGoogle() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard/my-profile` },
    });
    if (error) toast.error(error.message);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Login Methods</CardTitle>
        <p className="text-sm text-slate-500">
          Manage how you sign in to MedRota. You can use more than one method.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700">Email / Password</p>
              <p className="text-xs text-slate-400">{staffEmail ?? "Not set"}</p>
            </div>
          </div>
          <span className={`text-xs font-medium ${hasPassword ? "text-emerald-600" : "text-slate-400"}`}>
            {hasPassword ? "Active" : "Not linked"}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
          <div className="flex items-center gap-3">
            <KeyRound className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700">Google Sign-In</p>
              <p className="text-xs text-slate-400">
                {hasGoogle ? "Connected" : "Not connected"}
              </p>
            </div>
          </div>
          {!hasGoogle && (
            <Button size="sm" variant="outline" onClick={handleLinkGoogle} disabled={loading}>
              Connect Google
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

> This uses Supabase's native `linkIdentity()` because here the user IS already signed in and is choosing to add Google to their existing session — exactly the scenario that API is designed for. This is different from Part 5's after-the-fact merge of two pre-existing separate accounts.

### 6c. "Add Password Login" from Profile (for Google-first users)

For a staff member who only ever signed in with Google, let them set a password so they have a fallback method:

```tsx
async function handleSetPassword(newPassword: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    toast.error(error.message);
  } else {
    toast.success("Password set. You can now sign in with email + password too.");
  }
}
```

Reuse the same password validation rules from the forced-change page (min 8 characters, not all-numeric) here as well — extract them into a shared `src/lib/utils/passwordRules.ts` helper so both places stay consistent:

```ts
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (/^\d+$/.test(password)) return "Choose a password that isn't only numbers.";
  return null;
}
```

---

## PART 7 — FINAL CHECKLIST

### Supabase Dashboard (manual steps — you do these, not the agent)
- [ ] Google provider enabled in Supabase Auth with Client ID + Secret from Google Cloud Console
- [ ] Redirect URI added in Google Cloud Console matching Supabase's callback URL
- [ ] Site URL and Redirect URLs configured in Supabase Auth settings (including `/auth/callback`, plus `localhost:3000/auth/callback` if testing locally)
- [ ] "Allow manual linking" toggled ON in Supabase Auth settings
- [ ] Decided whether to restrict Google sign-in to a specific Workspace domain
- [ ] Confirmed `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
- [ ] Decided whether HR will offer phone-number-based login at all
- [ ] If yes: Twilio account created, phone number purchased, Messaging Service created, all 3 credentials entered into Supabase's Phone provider settings, "Enable phone confirmations" left OFF
- [ ] If no: phone-identifier option removed from `StaffForm` and `createStaff` per the note in Part 4

### Database & Types
- [ ] Migration `013_login_methods.sql` written and run
- [ ] `Staff` model has `login_identifier_type` field
- [ ] `AccessRequest` Prisma model added
- [ ] Types updated in `types/index.ts`
- [ ] Serializers updated

### Google Sign-In Flow
- [ ] `src/app/auth/callback/route.ts` created
- [ ] Login page updated with "Continue with Google" button and error-state handling
- [ ] `submitAccessRequest`, `getAccessRequests`, `resolveAccessRequest` actions created
- [ ] Pending access requests visible to HR with Realtime updates
- [ ] Tested: Google sign-in with a registered email → lands on dashboard
- [ ] Tested: Google sign-in with an unregistered email → rejected, signed out, Request Access shown

### HR Credential Issuance
- [ ] `StaffForm` has email/phone identifier toggle
- [ ] `createStaff` handles both `email` and `phone` provisioning paths
- [ ] Confirmed phone-based password auth works without requiring SMS provider setup

### Identity Linking
- [ ] `src/lib/auth/linkIdentity.ts` created
- [ ] OAuth callback calls the linking helper when a `user_id` mismatch is detected
- [ ] Tested: staff created by HR with email/password, later signs in with Google using same email → no duplicate dashboard confusion

### Profile Self-Service
- [ ] `LoginMethodsCard` component built and added to `/dashboard/my-profile`
- [ ] "Connect Google" button using native `linkIdentity()`
- [ ] "Set Password" option for Google-first users
- [ ] Shared `validatePassword` helper used in both the forced-change page and profile self-service

### Forced Password Change (unchanged from before — confirm still intact)
- [ ] No skip option exists anywhere in the password-change flow
- [ ] Google sign-ins are exempt from `must_change_password` (already secure via Google)
- [ ] `npm run build` passes with zero TypeScript errors
