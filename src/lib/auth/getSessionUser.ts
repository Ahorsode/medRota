import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

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
  } | null;
  departmentId: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  let authUser: { id: string; email?: string | null } | null = null;

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

  const [userRole, staffRecord] = await Promise.all([
    prisma.userRole.findFirst({
      where: { user_id: authUser.id },
      include: { department: true },
      orderBy: { id: "asc" },
    }),
    prisma.staff.findFirst({
      where: { user_id: authUser.id },
      include: { department: true },
    }),
  ]);

  const departmentId = userRole?.department_id ?? staffRecord?.department_id ?? null;

  return {
    id: authUser.id,
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
        }
      : null,
    departmentId,
  };
}
