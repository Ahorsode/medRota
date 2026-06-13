"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeLeaveRequest } from "@/lib/actions/serializers";

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function getLeaveRequests(staffId?: string, departmentId?: string) {
  try {
    const requests = await prisma.leaveRequest.findMany({
      where: {
        ...(staffId ? { staff_id: staffId } : {}),
        ...(departmentId ? { staff: { department_id: departmentId } } : {}),
      },
      include: { staff: { include: { department: true } } },
      orderBy: { requested_at: "desc" },
    });
    return requests.map(serializeLeaveRequest);
  } catch {
    return [];
  }
}

export async function createLeaveRequest(data: {
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string;
}) {
  try {
    const leave = await prisma.leaveRequest.create({
      data: { ...data, start_date: toDate(data.start_date), end_date: toDate(data.end_date) },
    });
    revalidatePath("/dashboard/leave");
    return serializeLeaveRequest(leave);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create leave request" };
  }
}

export async function reviewLeaveRequest(id: string, status: "approved" | "rejected", reviewedBy?: string, notes?: string) {
  try {
    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: { status, reviewed_by: reviewedBy ?? null, reviewed_at: new Date(), notes: notes ?? null },
    });
    revalidatePath("/dashboard/leave");
    return serializeLeaveRequest(leave);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to review leave request" };
  }
}
