"use server";

import { headers } from "next/headers";
import { serializeAuditLog } from "@/lib/actions/serializers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type AuditValue = { [key: string]: JsonValue };

export async function logAudit(input: {
  userId?: string | null;
  staffId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: AuditValue;
  newValue?: AuditValue;
  ipAddress?: string | null;
}) {
  try {
    let ipAddress = input.ipAddress ?? null;

    if (!ipAddress) {
      try {
        const headerStore = await headers();
        ipAddress = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      } catch {
        ipAddress = null;
      }
    }

    await prisma.auditLog.create({
      data: {
        user_id: input.userId ?? null,
        staff_id: input.staffId ?? null,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        old_value: input.oldValue as Prisma.InputJsonValue | undefined,
        new_value: input.newValue as Prisma.InputJsonValue | undefined,
        ip_address: ipAddress,
      },
    });
  } catch {
    // Auditing must never block the user-facing mutation.
  }
}

export async function getAuditLogs(filters?: {
  entityType?: string;
  entityId?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(filters?.entityType ? { entity_type: filters.entityType } : {}),
        ...(filters?.entityId ? { entity_id: filters.entityId } : {}),
        ...(filters?.userId ? { user_id: filters.userId } : {}),
        ...(filters?.from || filters?.to
          ? {
              created_at: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { created_at: "desc" },
      take: filters?.limit ?? 100,
    });

    return logs.map(serializeAuditLog);
  } catch {
    return [];
  }
}
