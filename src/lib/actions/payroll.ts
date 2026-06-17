"use server";

import { getRosterEntries, getRosterEntriesForStaff } from "@/lib/actions/rosters";
import type { ShiftAllowanceSummary } from "@/lib/types";

const ALLOWANCES = {
  N: 50,
  weekend: 30,
  H: 80,
};

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

  return {
    nightShifts,
    holidayShifts,
    weekendShifts,
    nightAllowance: nightShifts * ALLOWANCES.N,
    holidayAllowance: holidayShifts * ALLOWANCES.H,
    weekendAllowance: weekendShifts * ALLOWANCES.weekend,
    total: nightShifts * ALLOWANCES.N + holidayShifts * ALLOWANCES.H + weekendShifts * ALLOWANCES.weekend,
  };
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
