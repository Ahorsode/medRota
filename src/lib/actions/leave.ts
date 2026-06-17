"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/audit";
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
      data: {
        ...data,
        start_date: toDate(data.start_date),
        end_date: toDate(data.end_date),
        status: "pending_hod",
      },
    });
    revalidatePath("/dashboard/leave");
    revalidatePath("/dashboard/my-leave");
    return serializeLeaveRequest(leave);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create leave request" };
  }
}

export async function hodReviewLeave(id: string, decision: "approve" | "reject", hodUserId: string, notes?: string) {
  try {
    const newStatus = decision === "approve" ? "pending_hr" : "rejected_hod";
    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: newStatus,
        hod_reviewed_by: hodUserId,
        hod_reviewed_at: new Date(),
        hod_notes: notes ?? null,
      },
    });
    await logAudit({
      userId: hodUserId,
      action: decision === "approve" ? "leave_hod_approved" : "leave_hod_rejected",
      entityType: "leave_request",
      entityId: id,
      newValue: { status: newStatus, notes },
    });
    revalidatePath("/dashboard/leave");
    revalidatePath("/dashboard/my-leave");
    return serializeLeaveRequest(leave);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "HOD review failed" };
  }
}

export async function reviewLeaveRequest(id: string, status: "approved" | "rejected_hr", reviewedBy?: string, notes?: string) {
  try {
    const existing = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) return { error: "Leave request not found" };
    if (existing.status !== "pending_hr") {
      return { error: "This request must be reviewed by the department head first" };
    }

    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: { status, reviewed_by: reviewedBy ?? null, reviewed_at: new Date(), notes: notes ?? null },
    });
    await logAudit({
      userId: reviewedBy,
      action: status === "approved" ? "leave_hr_approved" : "leave_hr_rejected",
      entityType: "leave_request",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status, notes },
    });
    revalidatePath("/dashboard/leave");
    revalidatePath("/dashboard/my-leave");
    return serializeLeaveRequest(leave);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to review leave request" };
  }
}
