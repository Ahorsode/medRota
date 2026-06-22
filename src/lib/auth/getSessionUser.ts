import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type UserRoleName =
  | "admin"
  | "hr_officer"
  | "department_head"
  | "doctor"
  | "nurse"
  | "medical_director"
  | "staff";

export type SessionUser = {
  id: string;
  email: string;
  role: UserRoleName;
  staffRecord: {
    id: string;
    full_name: string;
    rank: string | null;
    position: string | null;
    department_id: string;
    department_name: string;
    employment_type: string | null;
    phone: string | null;
    email: string | null;
    staff_number: string;
    must_change_password: boolean;
  } | null;
  departmentId: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  let authUser: User | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authUser = user;
  } catch {
    return null;
  }

  if (!authUser) return null;

  let canonicalUserId = authUser.id;
  if (authUser.app_metadata?.merged_into) {
    canonicalUserId = authUser.app_metadata.merged_into as string;
  } else if (authUser.email) {
    const staffByEmail = await prisma.staff.findFirst({
      where: { email: authUser.email, is_active: true },
      select: { user_id: true },
    });
    if (staffByEmail?.user_id) {
      canonicalUserId = staffByEmail.user_id;
    }
  }

  const [userRole, staffRecord] = await Promise.all([
    prisma.userRole.findFirst({
      where: { user_id: canonicalUserId },
      include: { department: true },
      orderBy: { id: "asc" },
    }),
    prisma.staff.findFirst({
      where: { user_id: canonicalUserId },
      include: { department: true },
    }),
  ]);

  const departmentId = userRole?.department_id ?? staffRecord?.department_id ?? null;

  return {
    id: canonicalUserId,
    email: authUser.email ?? "",
    role: (userRole?.role ?? "staff") as UserRoleName,
    staffRecord: staffRecord
      ? {
          id: staffRecord.id,
          full_name: staffRecord.full_name,
          rank: staffRecord.rank,
          position: staffRecord.position,
          department_id: staffRecord.department_id ?? "",
          department_name: staffRecord.department?.name ?? "Unassigned",
          employment_type: staffRecord.employment_type,
          phone: staffRecord.phone,
          email: staffRecord.email,
          staff_number: staffRecord.staff_number ?? "",
          must_change_password: staffRecord.must_change_password,
        }
      : null,
    departmentId,
  };
}
