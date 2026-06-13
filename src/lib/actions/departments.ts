"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeDepartment } from "@/lib/actions/serializers";

export type DepartmentInput = {
  hospital_id: string;
  name: string;
  description?: string;
  department_type?: string;
  parent_id?: string;
};

export async function getDepartments(hospitalId?: string) {
  try {
    const departments = await prisma.department.findMany({
      where: {
        ...(hospitalId ? { hospital_id: hospitalId } : {}),
        is_active: true,
      },
      include: {
        children: true,
        _count: { select: { staff: true, rosters: true } },
      },
      orderBy: { name: "asc" },
    });
    return departments.map(serializeDepartment);
  } catch {
    return [];
  }
}

export async function createDepartment(data: DepartmentInput) {
  try {
    const department = await prisma.department.create({ data });
    revalidatePath("/dashboard/departments");
    return serializeDepartment(department);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create department" };
  }
}
