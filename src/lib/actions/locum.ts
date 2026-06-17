"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/audit";
import { prisma } from "@/lib/prisma";
import type { LocumShift } from "@/lib/types";

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateOnly(value: Date | string | null | undefined) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value ?? "";
}

function serializeLocumShift(shift: {
  id: string;
  department_id: string | null;
  shift_date: Date | string;
  shift_code: string;
  requirements: string | null;
  status: string;
  filled_by: string | null;
  posted_by: string | null;
  created_at: Date | string;
  department?: { id: string; name: string } | null;
  filled_staff?: { id: string; full_name: string } | null;
}): LocumShift {
  return {
    ...shift,
    shift_date: dateOnly(shift.shift_date),
    shift_code: shift.shift_code as LocumShift["shift_code"],
    status: shift.status as LocumShift["status"],
    created_at: shift.created_at instanceof Date ? shift.created_at.toISOString() : shift.created_at,
    department: shift.department
      ? {
          id: shift.department.id,
          name: shift.department.name,
          hospital_id: null,
          description: null,
          is_active: true,
          department_type: "department",
          parent_id: null,
          created_at: "",
        }
      : null,
    filled_staff: shift.filled_staff
      ? {
          id: shift.filled_staff.id,
          full_name: shift.filled_staff.full_name,
          hospital_id: null,
          department_id: null,
          user_id: null,
          staff_number: null,
          rank: null,
          position: null,
          employment_type: null,
          phone: null,
          email: null,
          is_active: true,
          created_at: "",
        }
      : null,
  };
}

export async function getLocumShifts(departmentId?: string, status?: "open" | "filled" | "cancelled") {
  try {
    const shifts = await prisma.locumShift.findMany({
      where: {
        ...(departmentId ? { department_id: departmentId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        filled_staff: { select: { id: true, full_name: true } },
      },
      orderBy: [{ shift_date: "asc" }, { created_at: "desc" }],
    });
    return shifts.map(serializeLocumShift);
  } catch {
    return [];
  }
}

export async function postLocumShift(data: {
  department_id: string;
  shift_date: string;
  shift_code: string;
  requirements?: string;
  posted_by?: string;
}) {
  try {
    const shift = await prisma.locumShift.create({
      data: {
        department_id: data.department_id,
        shift_date: toDate(data.shift_date),
        shift_code: data.shift_code,
        requirements: data.requirements,
        posted_by: data.posted_by,
      },
      include: {
        department: { select: { id: true, name: true } },
        filled_staff: { select: { id: true, full_name: true } },
      },
    });
    await logAudit({
      userId: data.posted_by,
      action: "locum_shift_posted",
      entityType: "locum_shift",
      entityId: shift.id,
      newValue: { department_id: data.department_id, shift_date: data.shift_date, shift_code: data.shift_code },
    });
    revalidatePath("/dashboard/locum-board");
    return serializeLocumShift(shift);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to post locum shift" };
  }
}

export async function acceptLocumShift(id: string, staffId: string) {
  try {
    const existing = await prisma.locumShift.findUnique({ where: { id } });
    if (!existing) return { error: "Locum shift not found" };
    if (existing.status !== "open") return { error: "This locum shift is no longer open" };
    if (!existing.department_id) return { error: "Locum shift has no department" };

    const shiftDate = new Date(existing.shift_date);
    const month = shiftDate.getUTCMonth() + 1;
    const year = shiftDate.getUTCFullYear();

    const roster = await prisma.roster.upsert({
      where: { department_id_month_year: { department_id: existing.department_id, month, year } },
      create: { department_id: existing.department_id, month, year, status: "draft" },
      update: {},
    });

    await prisma.$transaction([
      prisma.locumShift.update({
        where: { id },
        data: { status: "filled", filled_by: staffId },
      }),
      prisma.rosterEntry.upsert({
        where: {
          roster_id_staff_id_shift_date: {
            roster_id: roster.id,
            staff_id: staffId,
            shift_date: shiftDate,
          },
        },
        create: {
          roster_id: roster.id,
          staff_id: staffId,
          shift_date: shiftDate,
          shift_code: existing.shift_code,
        },
        update: {
          shift_code: existing.shift_code,
        },
      }),
    ]);

    await logAudit({
      staffId,
      action: "locum_shift_accepted",
      entityType: "locum_shift",
      entityId: id,
      newValue: { status: "filled", staffId },
    });
    revalidatePath("/dashboard/locum-board");
    revalidatePath("/dashboard/rosters");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to accept locum shift" };
  }
}
