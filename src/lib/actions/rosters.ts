"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/audit";
import { createNotification } from "@/lib/actions/notifications";
import { prisma } from "@/lib/prisma";
import {
  serializeLeaveRequest,
  serializeRoster,
  serializeRosterEntry,
  serializeShiftConfiguration,
  serializeStaff,
} from "@/lib/actions/serializers";
import { autoGenerateEntries, type AutoGenerateConfig } from "@/lib/utils/autoGenerate";
import { monthNames } from "@/lib/utils/dates";
import type { RosterStatus, ShiftCode } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

interface SignatureEntry {
  role: "hod" | "director";
  name: string;
  user_id: string;
  signed_at: string;
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function signatureEntries(value: unknown): SignatureEntry[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is SignatureEntry => {
    return (
      typeof item === "object" &&
      item !== null &&
      "role" in item &&
      "name" in item &&
      "user_id" in item &&
      "signed_at" in item &&
      (item.role === "hod" || item.role === "director") &&
      typeof item.name === "string" &&
      typeof item.user_id === "string" &&
      typeof item.signed_at === "string"
    );
  });
}

export async function getRosters(departmentId?: string) {
  try {
    const rosters = await prisma.roster.findMany({
      where: {
        ...(departmentId ? { department_id: departmentId } : {}),
      },
      include: { department: true, _count: { select: { entries: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return rosters.map(serializeRoster);
  } catch {
    return [];
  }
}

export async function getRosterEntriesForStaff(staffId: string, year: number, month: number) {
  try {
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const entries = await prisma.rosterEntry.findMany({
      where: {
        staff_id: staffId,
        shift_date: { gte: monthStart, lte: monthEnd },
      },
      include: { shift_config: true },
      orderBy: { shift_date: "asc" },
    });
    return entries.map(serializeRosterEntry);
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
    if (shiftCode !== "O") {
      await logAudit({
        action: "roster_entry_updated",
        entityType: "roster_entry",
        entityId: entry.id,
        newValue: { staff_id: staffId, shift_date: shiftDate, shift_code: shiftCode },
      });
    }
    revalidatePath("/dashboard/rosters");
    return serializeRosterEntry(entry);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update roster entry" };
  }
}

export async function updateRosterStatus(
  id: string,
  status: RosterStatus,
  approvedBy?: string,
) {
  try {
    const existing = await prisma.roster.findUnique({ where: { id }, include: { department: true } });
    if (!existing) return { error: "Roster not found" };

    const roster = await prisma.roster.update({
      where: { id },
      include: { department: true },
      data: {
        status,
        approved_by: ["approved", "hod_signed", "director_signed", "published"].includes(status) ? approvedBy ?? null : null,
        hod_signed_at: status === "hod_signed" ? new Date() : undefined,
        director_signed_at: status === "director_signed" ? new Date() : undefined,
        published_at: status === "published" ? new Date() : null,
      },
    });
    await logAudit({
      userId: approvedBy,
      action: `roster_${status}`,
      entityType: "roster",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status },
    });

    if (status === "published" && roster.department_id) {
      const departmentStaff = await prisma.staff.findMany({ where: { department_id: roster.department_id, is_active: true } });
      await Promise.all(
        departmentStaff.map((person) =>
          createNotification({
            staff_id: person.id,
            title: "New roster published",
            body: `${roster.department?.name ?? "Your department"} roster for ${monthNames[roster.month - 1]} ${roster.year} is now available.`,
            type: "roster",
            link: "/dashboard/my-schedule",
          }),
        ),
      );
    }

    revalidatePath("/dashboard/rosters");
    return serializeRoster(roster);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update roster status" };
  }
}

export async function signRoster(id: string, signerRole: "hod" | "director", signerUserId: string, signerName: string) {
  try {
    const existing = await prisma.roster.findUnique({ where: { id } });
    if (!existing) return { error: "Roster not found" };

    if (signerRole === "hod" && existing.status !== "submitted") {
      return { error: "Only submitted rosters can be signed by the HOD" };
    }
    if (signerRole === "director" && existing.status !== "hod_signed") {
      return { error: "Only HOD-signed rosters can be countersigned" };
    }

    const newStatus = signerRole === "hod" ? "hod_signed" : "director_signed";
    const existingSignatures = signatureEntries(existing.signatures);
    const otherSignatures = existingSignatures.filter((signature) => signature.role !== signerRole);
    const newSignature: SignatureEntry = {
      role: signerRole,
      name: signerName,
      user_id: signerUserId,
      signed_at: new Date().toISOString(),
    };
    const updatedSignatures: Prisma.InputJsonArray = [...otherSignatures, newSignature].map((signature) => ({
      role: signature.role,
      name: signature.name,
      user_id: signature.user_id,
      signed_at: signature.signed_at,
    }));

    const roster = await prisma.roster.update({
      where: { id },
      data: {
        status: newStatus,
        signatures: updatedSignatures,
        ...(signerRole === "hod"
          ? { hod_signed_at: new Date(), hod_signed_by: signerUserId }
          : { director_signed_at: new Date(), director_signed_by: signerUserId }),
      },
      include: { department: true },
    });

    await logAudit({
      userId: signerUserId,
      action: `roster_${newStatus}`,
      entityType: "roster",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: newStatus, signed_by: signerName, role: signerRole },
    });

    revalidatePath("/dashboard/rosters");
    return serializeRoster(roster);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to sign roster" };
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
