"use server";

import { revalidatePath } from "next/cache";
import { serializeAllowanceRate, serializePayrollSummary } from "@/lib/actions/serializers";
import { getRosterEntries, getRosterEntriesForStaff } from "@/lib/actions/rosters";
import { prisma } from "@/lib/prisma";
import type { ShiftAllowanceSummary } from "@/lib/types";

const FALLBACK_ALLOWANCES = {
  N: 50,
  weekend: 30,
  H: 80,
  ON_CALL: 40,
};

function monthBounds(year: number, month: number) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { monthStart, monthEnd };
}

function emptySummary(): ShiftAllowanceSummary {
  return {
    nightShifts: 0,
    holidayShifts: 0,
    weekendShifts: 0,
    nightAllowance: 0,
    holidayAllowance: 0,
    weekendAllowance: 0,
    total: 0,
  };
}

function summarize(entries: Array<{ shift_code: string; shift_date: string }>): ShiftAllowanceSummary {
  const nightShifts = entries.filter((entry) => entry.shift_code === "N").length;
  const holidayShifts = entries.filter((entry) => entry.shift_code === "H").length;
  const weekendShifts = entries.filter((entry) => {
    const day = new Date(`${entry.shift_date}T00:00:00`).getDay();
    return (day === 0 || day === 6) && entry.shift_code !== "O" && entry.shift_code !== "%";
  }).length;

  const nightAllowance = nightShifts * FALLBACK_ALLOWANCES.N;
  const holidayAllowance = holidayShifts * FALLBACK_ALLOWANCES.H;
  const weekendAllowance = weekendShifts * FALLBACK_ALLOWANCES.weekend;

  return {
    nightShifts,
    holidayShifts,
    weekendShifts,
    nightAllowance,
    holidayAllowance,
    weekendAllowance,
    total: nightAllowance + holidayAllowance + weekendAllowance,
  };
}

export async function getAllowanceRates(hospitalId?: string) {
  try {
    const rates = await prisma.allowanceRate.findMany({
      where: {
        ...(hospitalId ? { hospital_id: hospitalId } : {}),
        is_active: true,
      },
      orderBy: [{ shift_code: "asc" }, { effective_from: "desc" }],
    });

    return rates.map(serializeAllowanceRate);
  } catch {
    return [];
  }
}

export async function updateAllowanceRate(id: string, rateGhs: number) {
  try {
    const rate = await prisma.allowanceRate.update({
      where: { id },
      data: { rate_ghs: rateGhs },
    });

    revalidatePath("/dashboard/payroll");
    revalidatePath("/dashboard/settings");
    return serializeAllowanceRate(rate);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update allowance rate" };
  }
}

export async function generatePayrollSummary(staffId: string, year: number, month: number, hospitalId: string) {
  try {
    const { monthStart, monthEnd } = monthBounds(year, month);

    const [entries, absences, rates] = await Promise.all([
      prisma.rosterEntry.findMany({
        where: {
          staff_id: staffId,
          shift_date: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.attendanceRecord.findMany({
        where: {
          staff_id: staffId,
          shift_date: { gte: monthStart, lte: monthEnd },
          status: "absent",
        },
      }),
      prisma.allowanceRate.findMany({
        where: {
          hospital_id: hospitalId,
          is_active: true,
          effective_from: { lte: monthEnd },
        },
        orderBy: { effective_from: "desc" },
      }),
    ]);

    const rateMap = new Map<string, number>();
    for (const rate of rates) {
      if (!rateMap.has(rate.shift_code)) {
        rateMap.set(rate.shift_code, Number(rate.rate_ghs.toString()));
      }
    }

    const counts = {
      M: 0,
      A: 0,
      N: 0,
      H: 0,
      ON_CALL: 0,
      LEAVE: 0,
      weekend: 0,
    };

    for (const entry of entries) {
      if (entry.shift_code === "M") counts.M += 1;
      if (entry.shift_code === "A") counts.A += 1;
      if (entry.shift_code === "N") counts.N += 1;
      if (entry.shift_code === "H") counts.H += 1;
      if (entry.shift_code === "ON_CALL") counts.ON_CALL += 1;
      if (entry.shift_code === "LEAVE") counts.LEAVE += 1;

      const day = new Date(entry.shift_date).getUTCDay();
      if ((day === 0 || day === 6) && entry.shift_code !== "O" && entry.shift_code !== "%" && entry.shift_code !== "LEAVE") {
        counts.weekend += 1;
      }
    }

    const nightAllowance = counts.N * (rateMap.get("N") ?? FALLBACK_ALLOWANCES.N);
    const holidayAllowance = counts.H * (rateMap.get("H") ?? FALLBACK_ALLOWANCES.H);
    const onCallAllowance = counts.ON_CALL * (rateMap.get("ON_CALL") ?? FALLBACK_ALLOWANCES.ON_CALL);
    const weekendAllowance = counts.weekend * (rateMap.get("weekend") ?? FALLBACK_ALLOWANCES.weekend);
    const totalAllowance = nightAllowance + holidayAllowance + onCallAllowance + weekendAllowance;
    const totalShifts = counts.M + counts.A + counts.N + counts.H + counts.ON_CALL;

    const summary = await prisma.payrollSummary.upsert({
      where: { staff_id_month_year: { staff_id: staffId, month, year } },
      create: {
        staff_id: staffId,
        month,
        year,
        morning_shifts: counts.M,
        afternoon_shifts: counts.A,
        night_shifts: counts.N,
        weekend_shifts: counts.weekend,
        holiday_shifts: counts.H,
        on_call_shifts: counts.ON_CALL,
        total_shifts: totalShifts,
        leave_days: counts.LEAVE,
        absent_days: absences.length,
        night_allowance: nightAllowance,
        weekend_allowance: weekendAllowance,
        holiday_allowance: holidayAllowance,
        on_call_allowance: onCallAllowance,
        total_allowance: totalAllowance,
      },
      update: {
        morning_shifts: counts.M,
        afternoon_shifts: counts.A,
        night_shifts: counts.N,
        weekend_shifts: counts.weekend,
        holiday_shifts: counts.H,
        on_call_shifts: counts.ON_CALL,
        total_shifts: totalShifts,
        leave_days: counts.LEAVE,
        absent_days: absences.length,
        night_allowance: nightAllowance,
        weekend_allowance: weekendAllowance,
        holiday_allowance: holidayAllowance,
        on_call_allowance: onCallAllowance,
        total_allowance: totalAllowance,
        generated_at: new Date(),
      },
      include: { staff: { include: { department: true } } },
    });

    revalidatePath("/dashboard/payroll");
    revalidatePath("/dashboard/reports");
    return serializePayrollSummary(summary);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to generate payroll summary" };
  }
}

export async function getDepartmentPayrollSummary(departmentId: string, year: number, month: number) {
  try {
    const summaries = await prisma.payrollSummary.findMany({
      where: {
        month,
        year,
        staff: { department_id: departmentId },
      },
      include: { staff: { include: { department: true } } },
      orderBy: { total_allowance: "desc" },
    });

    return summaries.map(serializePayrollSummary);
  } catch {
    return [];
  }
}

export async function getAllStaffPayrollSummary(year: number, month: number) {
  try {
    const summaries = await prisma.payrollSummary.findMany({
      where: { month, year },
      include: { staff: { include: { department: true } } },
      orderBy: { total_allowance: "desc" },
    });

    return summaries.map(serializePayrollSummary);
  } catch {
    return [];
  }
}

export async function getShiftAllowanceSummary(staffId: string, year: number, month: number) {
  if (!staffId) return emptySummary();

  const entries = await getRosterEntriesForStaff(staffId, year, month);
  return summarize(entries);
}

export async function getShiftAllowanceSummaryForDepartment(departmentId: string | undefined, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const entries = await getRosterEntries(startDate, endDate, departmentId);
  return summarize(entries);
}
