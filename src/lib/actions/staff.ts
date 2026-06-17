"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/audit";
import { prisma } from "@/lib/prisma";
import { serializeStaff } from "@/lib/actions/serializers";

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
};

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

export async function createStaff(data: StaffInput) {
  try {
    const hospitalId =
      data.hospital_id ??
      (data.department_id
        ? (await prisma.department.findUnique({ where: { id: data.department_id }, select: { hospital_id: true } }))?.hospital_id
        : null);
    const staff = await prisma.staff.create({ data: { ...data, hospital_id: hospitalId ?? undefined } });
    revalidatePath("/dashboard/staff");
    return serializeStaff(staff);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create staff member" };
  }
}

export async function updateStaff(
  id: string,
  data: Partial<Omit<StaffInput, "staff_number" | "hospital_id"> & { is_active: boolean }>,
) {
  try {
    const staff = await prisma.staff.update({ where: { id }, data });
    await logAudit({
      staffId: id,
      action: "staff_updated",
      entityType: "staff",
      entityId: id,
      newValue: data,
    });
    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard/my-profile");
    return serializeStaff(staff);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update staff member" };
  }
}
