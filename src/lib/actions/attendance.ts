"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeAttendanceRecord } from "@/lib/actions/serializers";

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function getAttendanceRecords(staffId?: string, departmentId?: string, date?: string) {
  try {
    const records = await prisma.attendanceRecord.findMany({
      where: {
        ...(staffId ? { staff_id: staffId } : {}),
        ...(date ? { shift_date: toDate(date) } : {}),
        ...(departmentId ? { staff: { department_id: departmentId } } : {}),
      },
      include: { staff: true },
      orderBy: { shift_date: "desc" },
    });
    return records.map(serializeAttendanceRecord);
  } catch {
    return [];
  }
}

export async function clockIn(staffId: string, shiftDate: string) {
  try {
    const record = await prisma.attendanceRecord.upsert({
      where: { staff_id_shift_date: { staff_id: staffId, shift_date: toDate(shiftDate) } },
      create: { staff_id: staffId, shift_date: toDate(shiftDate), clock_in: new Date(), status: "present" },
      update: { clock_in: new Date() },
    });
    revalidatePath("/dashboard/attendance");
    return serializeAttendanceRecord(record);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to clock in" };
  }
}

export async function clockOut(staffId: string, shiftDate: string) {
  try {
    const record = await prisma.attendanceRecord.update({
      where: { staff_id_shift_date: { staff_id: staffId, shift_date: toDate(shiftDate) } },
      data: { clock_out: new Date() },
    });
    revalidatePath("/dashboard/attendance");
    return serializeAttendanceRecord(record);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to clock out" };
  }
}

export async function markAbsent(staffId: string, shiftDate: string, notes?: string) {
  try {
    const record = await prisma.attendanceRecord.upsert({
      where: { staff_id_shift_date: { staff_id: staffId, shift_date: toDate(shiftDate) } },
      create: { staff_id: staffId, shift_date: toDate(shiftDate), status: "absent", notes },
      update: { status: "absent", notes },
    });
    revalidatePath("/dashboard/attendance");
    return serializeAttendanceRecord(record);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to mark absent" };
  }
}
