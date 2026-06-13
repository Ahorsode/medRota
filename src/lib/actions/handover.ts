"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeHandoverReport } from "@/lib/actions/serializers";

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function getHandoverReports(departmentId: string, date?: string) {
  try {
    const reports = await prisma.handoverReport.findMany({
      where: {
        department_id: departmentId,
        ...(date ? { shift_date: toDate(date) } : {}),
      },
      include: { from_staff: true, to_staff: true },
      orderBy: [{ shift_date: "desc" }, { created_at: "desc" }],
    });
    return reports.map(serializeHandoverReport);
  } catch {
    return [];
  }
}

export async function createHandoverReport(data: {
  department_id: string;
  shift_date: string;
  shift_code: string;
  from_staff_id: string;
  to_staff_id: string;
  report_body: string;
  patients_count?: number;
  critical_notes?: string;
}) {
  try {
    const report = await prisma.handoverReport.create({
      data: { ...data, shift_date: toDate(data.shift_date) },
    });
    revalidatePath("/dashboard/handover");
    return serializeHandoverReport(report);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create handover report" };
  }
}

export async function acknowledgeHandover(id: string) {
  try {
    const report = await prisma.handoverReport.update({
      where: { id },
      data: { is_acknowledged: true, acknowledged_at: new Date() },
    });
    revalidatePath("/dashboard/handover");
    return serializeHandoverReport(report);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to acknowledge handover" };
  }
}
