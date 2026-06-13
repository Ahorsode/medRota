"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeTrainingRecord } from "@/lib/actions/serializers";

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function getTrainingRecords(staffId?: string, departmentId?: string) {
  try {
    const records = await prisma.trainingRecord.findMany({
      where: {
        ...(staffId ? { staff_id: staffId } : {}),
        ...(departmentId ? { staff: { department_id: departmentId } } : {}),
      },
      include: { staff: true },
      orderBy: { start_date: "desc" },
    });
    return records.map(serializeTrainingRecord);
  } catch {
    return [];
  }
}

export async function createTrainingRecord(data: {
  staff_id: string;
  training_title: string;
  training_type: string;
  provider?: string;
  start_date: string;
  end_date: string;
  certificate_url?: string;
  notes?: string;
}) {
  try {
    const record = await prisma.trainingRecord.create({
      data: { ...data, start_date: toDate(data.start_date), end_date: toDate(data.end_date) },
    });
    revalidatePath("/dashboard/staff");
    return serializeTrainingRecord(record);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create training record" };
  }
}
