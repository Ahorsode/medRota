"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeShiftSwap } from "@/lib/actions/serializers";

export async function getShiftSwaps(departmentId?: string) {
  try {
    const swaps = await prisma.shiftSwap.findMany({
      where: {
        ...(departmentId
          ? {
              OR: [
                { requester: { department_id: departmentId } },
                { replacement: { department_id: departmentId } },
              ],
            }
          : {}),
      },
      include: {
        requester: { include: { department: true } },
        replacement: { include: { department: true } },
        requester_entry: true,
        replacement_entry: true,
      },
      orderBy: { requested_at: "desc" },
    });
    return swaps.map(serializeShiftSwap);
  } catch {
    return [];
  }
}

export async function getShiftSwapsForStaff(staffId: string) {
  try {
    const swaps = await prisma.shiftSwap.findMany({
      where: {
        OR: [{ requester_id: staffId }, { replacement_id: staffId }],
      },
      include: {
        requester: { include: { department: true } },
        replacement: { include: { department: true } },
        requester_entry: true,
        replacement_entry: true,
      },
      orderBy: { requested_at: "desc" },
    });
    return swaps.map(serializeShiftSwap);
  } catch {
    return [];
  }
}

export async function createShiftSwapRequest(data: {
  requester_id: string;
  replacement_id: string;
  requester_entry_id: string;
  replacement_entry_id?: string;
}) {
  try {
    const swap = await prisma.shiftSwap.create({
      data: {
        requester_id: data.requester_id,
        replacement_id: data.replacement_id,
        requester_entry_id: data.requester_entry_id,
        replacement_entry_id: data.replacement_entry_id || null,
        status: "pending",
      },
      include: {
        requester: { include: { department: true } },
        replacement: { include: { department: true } },
        requester_entry: true,
        replacement_entry: true,
      },
    });
    revalidatePath("/dashboard/swaps");
    revalidatePath("/dashboard/my-swaps");
    return serializeShiftSwap(swap);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to request shift swap" };
  }
}

export async function respondToSwap(id: string, staffId: string, decision: "accept" | "decline") {
  try {
    const existing = await prisma.shiftSwap.findUnique({ where: { id } });
    if (!existing) return { error: "Shift swap not found" };
    if (existing.replacement_id !== staffId) return { error: "Only the requested replacement can respond" };

    const swap = await prisma.shiftSwap.update({
      where: { id },
      data: { status: decision === "accept" ? "approved" : "rejected" },
      include: {
        requester: { include: { department: true } },
        replacement: { include: { department: true } },
        requester_entry: true,
        replacement_entry: true,
      },
    });
    revalidatePath("/dashboard/swaps");
    revalidatePath("/dashboard/my-swaps");
    return serializeShiftSwap(swap);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to respond to shift swap" };
  }
}

export async function reviewSwap(id: string, status: "approved" | "rejected", reviewedBy?: string) {
  try {
    const swap = await prisma.shiftSwap.update({
      where: { id },
      data: { status, reviewed_by: reviewedBy ?? null },
    });
    revalidatePath("/dashboard/swaps");
    return serializeShiftSwap(swap);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to review shift swap" };
  }
}
