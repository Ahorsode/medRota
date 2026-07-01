"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/audit";
import { prisma } from "@/lib/prisma";
import { serializeStaff } from "@/lib/actions/serializers";
import { getSessionUser, type UserRoleName } from "@/lib/auth/getSessionUser";
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
  role?: UserRoleName;
};

const provisionableRoles = new Set<UserRoleName>([
  "admin",
  "hr_officer",
  "department_head",
  "doctor",
  "nurse",
  "medical_director",
  "staff",
]);

function canManageStaff(role: UserRoleName) {
  return role === "admin" || role === "hr_officer";
}

function generateSecurePassword() {
  return randomBytes(24).toString("base64url");
}

export async function markStaffFirstLogin(userId: string) {
  const now = new Date();
  await prisma.staff.updateMany({
    where: { user_id: userId, has_logged_in: false },
    data: { has_logged_in: true, first_login_at: now },
  });
}

export async function getStaffPasswordLoginPolicy(identifier: string, isEmail: boolean) {
  try {
    const trimmed = identifier.trim();
    if (!trimmed) {
      return { allowed: false, error: "Enter your email or phone number." };
    }

    const staff = await prisma.staff.findFirst({
      where: {
        is_active: true,
        ...(isEmail ? { email: trimmed } : { phone: trimmed }),
      },
      select: { allow_staff_id_login: true },
    });

    if (!staff) {
      return { allowed: true };
    }

    if (!staff.allow_staff_id_login) {
      return {
        allowed: false,
        error: "Password sign-in is disabled for this account. Use Google sign-in or contact HR.",
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export async function getStaff(departmentId?: string) {
  try {
    const staff = await prisma.staff.findMany({
      where: {
        ...(departmentId ? { department_id: departmentId } : {}),
        is_active: true,
      },
      include: { department: true },
      orderBy: { full_name: "asc" },
    });
    return staff.map(serializeStaff);
  } catch {
    return [];
  }
}

export async function getStaffById(id: string) {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id },
      include: {
        department: true,
        leave_requests: { orderBy: { requested_at: "desc" }, take: 10 },
        attendance_records: { orderBy: { shift_date: "desc" }, take: 30 },
        assessments: { orderBy: { assessment_date: "desc" } },
        training_records: { orderBy: { start_date: "desc" } },
      },
    });
    return staff ? serializeStaff(staff) : null;
  } catch {
    return null;
  }
}

export async function createStaff(
  data: StaffInput & {
    login_identifier_type?: "email" | "phone";
    allow_staff_id_login?: boolean;
  },
) {
  try {
    const actor = await getSessionUser();
    if (!actor) {
      return { error: "You must be signed in to create staff accounts." };
    }
    if (!canManageStaff(actor.role)) {
      return { error: "You do not have permission to create staff accounts." };
    }

    const identifierType = data.login_identifier_type ?? "email";
    const allowStaffIdLogin = data.allow_staff_id_login ?? true;
    const email = data.email?.trim();
    const phone = data.phone?.trim();
    const staffNumber = data.staff_number.trim();
    const departmentId = data.department_id.trim();
    const role = data.role && provisionableRoles.has(data.role) ? data.role : "staff";
    const initialPassword = allowStaffIdLogin ? staffNumber : generateSecurePassword();

    if (identifierType === "email" && !email) {
      return { error: "Email is required when using email as the login identifier." };
    }
    if (identifierType === "phone" && !phone) {
      return { error: "Phone number is required when using phone as the login identifier." };
    }
    if (!staffNumber) {
      return { error: "Staff number is required to create a staff account." };
    }
    if (!departmentId) {
      return { error: "Department is required to create a staff account." };
    }

    const hospitalId =
      data.hospital_id ??
      (departmentId
        ? (await prisma.department.findUnique({ where: { id: departmentId }, select: { hospital_id: true } }))?.hospital_id
        : null);

    const admin = createAdminClient();
    const createPayload =
      identifierType === "phone"
        ? { phone: phone!, password: initialPassword, phone_confirm: true }
        : { email: email!, password: initialPassword, email_confirm: true };

    const { data: authResult, error: authError } = await admin.auth.admin.createUser({
      ...createPayload,
      user_metadata: {
        full_name: data.full_name,
        provisioned_by: "staff_form",
      },
    });

    if (authError || !authResult?.user) {
      return { error: authError?.message ?? "Failed to create login account for this staff member." };
    }

    const userId = authResult.user.id;
    let staff;

    try {
      staff = await prisma.$transaction(async (tx) => {
        const createdStaff = await tx.staff.create({
          data: {
            full_name: data.full_name,
            department_id: departmentId,
            hospital_id: hospitalId ?? undefined,
            rank: data.rank,
            position: data.position,
            employment_type: data.employment_type,
            phone: phone || undefined,
            email: email || undefined,
            staff_number: staffNumber,
            user_id: userId,
            must_change_password: allowStaffIdLogin,
            allow_staff_id_login: allowStaffIdLogin,
            has_logged_in: false,
            login_identifier_type: identifierType,
            invited_at: new Date(),
          },
        });

        await tx.userRole.create({
          data: {
            user_id: userId,
            role,
            department_id: departmentId,
          },
        });

        return createdStaff;
      });
    } catch (dbError) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        // Best effort rollback; surface the original database failure.
      }
      throw dbError;
    }

    await logAudit({
      userId: actor.id,
      staffId: staff.id,
      action: "staff_account_provisioned",
      entityType: "staff",
      entityId: staff.id,
      newValue: {
        identifier_type: identifierType,
        email: email ?? null,
        phone: phone ?? null,
        role,
        allow_staff_id_login: allowStaffIdLogin,
      },
    });
    revalidatePath("/dashboard/staff");
    return serializeStaff(staff);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create staff member" };
  }
}

export async function updateStaffIdLoginAllowed(staffId: string, enabled: boolean) {
  try {
    const actor = await getSessionUser();
    if (!actor) {
      return { error: "You must be signed in to change login settings." };
    }
    if (!canManageStaff(actor.role)) {
      return { error: "You do not have permission to change login settings." };
    }

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff?.user_id) {
      return { error: "This staff member has no linked login account." };
    }
    if (!staff.staff_number) {
      return { error: "This staff member has no staff number on file." };
    }

    if (enabled && staff.has_logged_in) {
      return {
        error: "Staff ID login cannot be turned on again after this person has signed in at least once.",
      };
    }

    if (enabled === staff.allow_staff_id_login) {
      return { success: true, allow_staff_id_login: staff.allow_staff_id_login };
    }

    const admin = createAdminClient();
    const nextPassword = enabled ? staff.staff_number : generateSecurePassword();

    const { error: authError } = await admin.auth.admin.updateUserById(staff.user_id, {
      password: nextPassword,
    });

    if (authError) {
      return { error: authError.message };
    }

    const updated = await prisma.staff.update({
      where: { id: staffId },
      data: {
        allow_staff_id_login: enabled,
        must_change_password: enabled,
        ...(enabled ? { password_changed_at: null } : {}),
      },
    });

    await logAudit({
      userId: actor.id,
      staffId,
      action: enabled ? "staff_id_login_enabled" : "staff_id_login_disabled",
      entityType: "staff",
      entityId: staffId,
      newValue: { allow_staff_id_login: enabled },
    });

    revalidatePath(`/dashboard/staff/${staffId}`);
    revalidatePath("/dashboard/staff");
    return { success: true, allow_staff_id_login: updated.allow_staff_id_login };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update login settings" };
  }
}

export async function resetStaffPassword(staffId: string) {
  try {
    const actor = await getSessionUser();
    if (!actor) {
      return { error: "You must be signed in to reset staff passwords." };
    }
    if (!canManageStaff(actor.role)) {
      return { error: "You do not have permission to reset staff passwords." };
    }

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff?.user_id) {
      return { error: "This staff member has no linked login account." };
    }
    if (!staff.staff_number) {
      return { error: "This staff member has no staff number to use as a temporary password." };
    }
    if (!staff.allow_staff_id_login) {
      return {
        error: "Staff ID login is disabled for this account. Enable it first or ask the staff member to use Google sign-in.",
      };
    }
    if (staff.has_logged_in) {
      return {
        error: "Password cannot be reset to the staff number after this person has signed in at least once.",
      };
    }

    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(staff.user_id, {
      password: staff.staff_number,
    });

    if (authError) {
      return { error: authError.message };
    }

    await prisma.staff.update({
      where: { id: staffId },
      data: {
        must_change_password: true,
        password_changed_at: null,
      },
    });

    await logAudit({
      userId: actor.id,
      staffId,
      action: "staff_password_reset",
      entityType: "staff",
      entityId: staffId,
    });

    revalidatePath(`/dashboard/staff/${staffId}`);
    revalidatePath("/dashboard/staff");
    return { success: true, temporaryPassword: staff.staff_number };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to reset password" };
  }
}

export async function updateStaff(
  id: string,
  data: Partial<Omit<StaffInput, "staff_number" | "hospital_id" | "role"> & { is_active: boolean }>,
) {
  try {
    const staff = await prisma.staff.update({ where: { id }, data });
    const auditData = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value ?? null]));
    await logAudit({
      staffId: id,
      action: "staff_updated",
      entityType: "staff",
      entityId: id,
      newValue: auditData,
    });
    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard/my-profile");
    return serializeStaff(staff);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update staff member" };
  }
}
