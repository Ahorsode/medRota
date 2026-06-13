"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  serializeRoster,
  serializeRosterEntry,
  serializeShiftConfiguration,
} from "@/lib/actions/serializers";
import type { ShiftCode } from "@/lib/types";

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function getRosters() {
  try {
    const rosters = await prisma.roster.findMany({
      include: { department: true, _count: { select: { entries: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return rosters.map(serializeRoster);
  } catch {
    return [];
  }
}

export async function getRosterWithEntries(departmentId: string, year: number, month: number) {
  try {
    const roster = await prisma.roster.findUnique({
      where: { department_id_month_year: { department_id: departmentId, month, year } },
      include: { entries: true },
    });

    return {
      roster: roster ? serializeRoster(roster) : null,
      entries: roster?.entries.map(serializeRosterEntry) ?? [],
    };
  } catch {
    return { roster: null, entries: [] };
  }
}

export async function getShiftConfigurations(departmentId?: string) {
  try {
    const configs = await prisma.shiftConfiguration.findMany({
      where: {
        ...(departmentId ? { department_id: departmentId } : {}),
        is_active: true,
      },
      orderBy: { shift_code: "asc" },
    });
    return configs.map(serializeShiftConfiguration);
  } catch {
    return [];
  }
}

export async function getRosterEntries(startDate?: string, endDate?: string, departmentId?: string) {
  try {
    const entries = await prisma.rosterEntry.findMany({
      where: {
        ...(startDate || endDate
          ? {
              shift_date: {
                ...(startDate ? { gte: toDate(startDate) } : {}),
                ...(endDate ? { lte: toDate(endDate) } : {}),
              },
            }
          : {}),
        ...(departmentId ? { staff: { department_id: departmentId } } : {}),
      },
      include: { staff: true },
      orderBy: { shift_date: "asc" },
    });
    return entries.map(serializeRosterEntry);
  } catch {
    return [];
  }
}

export async function createRoster(data: { department_id: string; month: number; year: number; created_by?: string }) {
  try {
    const roster = await prisma.roster.create({ data });
    revalidatePath("/dashboard/rosters");
    return serializeRoster(roster);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create roster" };
  }
}

export async function updateRosterEntry(
  rosterId: string,
  staffId: string,
  shiftDate: string,
  shiftCode: ShiftCode,
  opts?: { isLeave?: boolean; leaveType?: string; notes?: string },
) {
  try {
    const entry = await prisma.rosterEntry.upsert({
      where: {
        roster_id_staff_id_shift_date: {
          roster_id: rosterId,
          staff_id: staffId,
          shift_date: toDate(shiftDate),
        },
      },
      create: {
        roster_id: rosterId,
        staff_id: staffId,
        shift_date: toDate(shiftDate),
        shift_code: shiftCode,
        is_leave: opts?.isLeave ?? shiftCode === "LEAVE",
        leave_type: opts?.leaveType,
        notes: opts?.notes,
      },
      update: {
        shift_code: shiftCode,
        is_leave: opts?.isLeave ?? shiftCode === "LEAVE",
        leave_type: opts?.leaveType ?? null,
        notes: opts?.notes ?? null,
      },
    });
    revalidatePath("/dashboard/rosters");
    return serializeRosterEntry(entry);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update roster entry" };
  }
}

export async function updateRosterStatus(id: string, status: "draft" | "submitted" | "approved" | "published", approvedBy?: string) {
  try {
    const roster = await prisma.roster.update({
      where: { id },
      data: {
        status,
        approved_by: status === "approved" || status === "published" ? approvedBy ?? null : null,
        published_at: status === "published" ? new Date() : null,
      },
    });
    revalidatePath("/dashboard/rosters");
    return serializeRoster(roster);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update roster status" };
  }
}
