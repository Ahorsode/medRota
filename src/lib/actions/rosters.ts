"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  serializeLeaveRequest,
  serializeRoster,
  serializeRosterEntry,
  serializeShiftConfiguration,
  serializeStaff,
} from "@/lib/actions/serializers";
import { autoGenerateEntries, type AutoGenerateConfig } from "@/lib/utils/autoGenerate";
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

export async function autoGenerateRoster(
  rosterId: string,
  departmentId: string,
  year: number,
  month: number,
  config: AutoGenerateConfig,
) {
  try {
    const staff = await prisma.staff.findMany({
      where: { department_id: departmentId, is_active: true },
    });

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        staff_id: { in: staff.map((person) => person.id) },
        status: "approved",
        start_date: { lte: monthEnd },
        end_date: { gte: monthStart },
      },
    });

    const generated = autoGenerateEntries(
      rosterId,
      departmentId,
      staff.map(serializeStaff),
      year,
      month,
      approvedLeaves.map(serializeLeaveRequest),
      config,
    );

    for (const person of staff) {
      const leaveEntries = generated.filter((entry) => entry.staff_id === person.id && entry.shift_code === "LEAVE");
      const entitlement =
        person.employment_type === "Full-time"
          ? config.annualLeaveEntitlementFullTime
          : config.annualLeaveEntitlementPartTime;

      for (const entry of leaveEntries.slice(entitlement)) {
        entry.shift_code = "O";
        entry.is_leave = false;
        entry.leave_type = null;
      }
    }

    await prisma.$transaction([
      prisma.rosterEntry.deleteMany({ where: { roster_id: rosterId } }),
      ...(generated.length > 0
        ? [
            prisma.rosterEntry.createMany({
              data: generated.map((entry) => ({
                ...entry,
                shift_date: toDate(entry.shift_date),
              })),
            }),
          ]
        : []),
    ]);

    const entries = await prisma.rosterEntry.findMany({
      where: { roster_id: rosterId },
      orderBy: { shift_date: "asc" },
    });

    revalidatePath("/dashboard/rosters");
    return { entries: entries.map(serializeRosterEntry) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Auto-generate failed" };
  }
}
