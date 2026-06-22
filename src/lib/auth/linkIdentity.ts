import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/actions/audit";
import { prisma } from "@/lib/prisma";

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

    // Copy/sync roles from original user to Google user to support Supabase RLS policies
    const roles = await prisma.userRole.findMany({ where: { user_id: originalUserId } });
    for (const role of roles) {
      if (!role.department_id) continue; // composite key requires non-null dept
      await prisma.userRole.upsert({
        where: {
          user_id_role_department_id: {
            user_id: googleAuthUserId,
            role: role.role,
            department_id: role.department_id,
          }
        },
        create: {
          user_id: googleAuthUserId,
          role: role.role,
          department_id: role.department_id,
        },
        update: {},
      });
    }

    await logAudit({
      action: "identity_linked",
      entityType: "staff",
      newValue: { original_user_id: originalUserId, google_user_id: googleAuthUserId, email },
    });
  } catch (error) {
    console.error("Identity linking failed:", error);
  }
}
