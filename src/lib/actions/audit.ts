"use server";

import { prisma } from "@/lib/prisma";

export async function logAudit(input: {
  userId?: string | null;
  staffId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: input.userId ?? null,
        staff_id: input.staffId ?? null,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        old_value: input.oldValue === undefined ? undefined : (input.oldValue as never),
        new_value: input.newValue === undefined ? undefined : (input.newValue as never),
        ip_address: input.ipAddress ?? null,
      },
    });
  } catch {
    // Auditing should not block the user-facing mutation.
  }
}
