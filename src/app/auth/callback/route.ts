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

  const mergedInto = data.user.app_metadata?.merged_into;
  const canonicalUserId = mergedInto || data.user.id;

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

  // If the staff record has no user_id yet, link it now.
  if (!staffRecord.user_id) {
    await prisma.staff.update({
      where: { id: staffRecord.id },
      data: {
        user_id: canonicalUserId,
        must_change_password: false, // Google sign-in is already a secure auth method
      },
    });
  } else if (staffRecord.user_id !== canonicalUserId) {
    // The staff record is linked to a DIFFERENT auth user (likely their email/password account).
    // Attempt to merge identities.
    const { linkGoogleIdentityToExistingStaffUser } = await import("@/lib/auth/linkIdentity");
    await linkGoogleIdentityToExistingStaffUser(staffRecord.user_id, data.user.id, googleEmail);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
