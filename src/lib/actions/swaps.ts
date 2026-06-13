"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeShiftSwap } from "@/lib/actions/serializers";

export async function getShiftSwaps() {
  try {
    const swaps = await prisma.shiftSwap.findMany({
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
