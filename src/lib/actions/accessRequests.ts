"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/audit";
import { serializeAccessRequest } from "@/lib/actions/serializers";

export async function submitAccessRequest(email: string) {
  try {
    const existing = await prisma.accessRequest.findFirst({
      where: { attempted_email: email, status: "pending" },
    });
    if (existing) {
      return { success: true, message: "Your request is already pending with HR." };
    }

    await prisma.accessRequest.create({
      data: { attempted_email: email },
    });

    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to submit request" };
  }
}

export async function getAccessRequests(status: "pending" | "resolved" | "dismissed" = "pending") {
  try {
    const requests = await prisma.accessRequest.findMany({
      where: { status },
      orderBy: { created_at: "desc" },
    });
    return requests.map(serializeAccessRequest);
  } catch {
    return [];
  }
}

export async function resolveAccessRequest(id: string, resolvedBy: string, dismiss = false) {
  try {
    await prisma.accessRequest.update({
      where: { id },
      data: {
        status: dismiss ? "dismissed" : "resolved",
        resolved_by: resolvedBy,
        resolved_at: new Date(),
      },
    });
    await logAudit({
      action: "access_request_resolved",
      entityType: "access_request",
      entityId: id,
    });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to resolve request" };
  }
}
