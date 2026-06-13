"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeStaffAssessment } from "@/lib/actions/serializers";

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function getAssessments(staffId?: string, departmentId?: string) {
  try {
    const assessments = await prisma.staffAssessment.findMany({
      where: {
        ...(staffId ? { staff_id: staffId } : {}),
        ...(departmentId ? { staff: { department_id: departmentId } } : {}),
      },
      include: { staff: true },
      orderBy: { assessment_date: "desc" },
    });
    return assessments.map(serializeStaffAssessment);
  } catch {
    return [];
  }
}

export async function createAssessment(data: {
  staff_id: string;
  assessed_by: string;
  assessment_date: string;
  period: string;
  competency_score?: number;
  efficiency_score?: number;
  professionalism_score?: number;
  ethical_score?: number;
  comments?: string;
}) {
  try {
    const scores = [
      data.competency_score,
      data.efficiency_score,
      data.professionalism_score,
      data.ethical_score,
    ].filter((score): score is number => typeof score === "number");
    const overall_score = scores.length > 0 ? Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(2)) : null;
    const assessment = await prisma.staffAssessment.create({
      data: { ...data, assessment_date: toDate(data.assessment_date), overall_score },
    });
    revalidatePath("/dashboard/staff");
    return serializeStaffAssessment(assessment);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create assessment" };
  }
}
