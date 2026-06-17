"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/audit";
import { serializeLocumShift } from "@/lib/actions/serializers";
import { prisma } from "@/lib/prisma";

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function getLocumShifts(departmentId?: string, status?: "open" | "filled" | "cancelled") {
  try {
    const shifts = await prisma.locumShift.findMany({
      where: {
        ...(departmentId ? { department_id: departmentId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        department: true,
        filled_staff: { include: { department: true } },
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
        department: true,
        filled_staff: { include: { department: true } },
      },
    });

    await logAudit({
      userId: data.posted_by,
      action: "locum_shift_posted",
      entityType: "locum_shift",
      entityId: shift.id,
      newValue: {
        department_id: data.department_id,
        shift_date: data.shift_date,
        shift_code: data.shift_code,
      },
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

    const shift = await prisma.locumShift.findUnique({
      where: { id },
      include: {
        department: true,
        filled_staff: { include: { department: true } },
      },
    });

    await logAudit({
      staffId,
      action: "locum_shift_accepted",
      entityType: "locum_shift",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: "filled", staff_id: staffId },
    });
    revalidatePath("/dashboard/locum-board");
    revalidatePath("/dashboard/rosters");
    return shift ? serializeLocumShift(shift) : { error: "Locum shift not found after update" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to accept locum shift" };
  }
}

export async function cancelLocumShift(id: string, cancelledBy?: string) {
  try {
    const existing = await prisma.locumShift.findUnique({ where: { id } });
    if (!existing) return { error: "Locum shift not found" };

    const shift = await prisma.locumShift.update({
      where: { id },
      data: { status: "cancelled" },
      include: {
        department: true,
        filled_staff: { include: { department: true } },
      },
    });

    await logAudit({
      userId: cancelledBy,
      action: "locum_shift_cancelled",
      entityType: "locum_shift",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: "cancelled" },
    });
    revalidatePath("/dashboard/locum-board");
    return serializeLocumShift(shift);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to cancel locum shift" };
  }
}
