import type { LeaveRequest, RosterEntry, ShiftCode, Staff } from "@/lib/types";
import { getMonthDays } from "@/lib/utils/dates";

export interface AutoGenerateConfig {
  morningDaysPerStaff: number;
  afternoonDaysPerStaff: number;
  nightDaysPerStaff: number;
  maxConsecutiveNights: number;
  enforceSeniorCoverage: boolean;
  minCoveragePerShift: { M: number; A: number; N: number };
  annualLeaveEntitlementFullTime: number;
  annualLeaveEntitlementPartTime: number;
}

export const defaultAutoGenerateConfig: AutoGenerateConfig = {
  morningDaysPerStaff: 16,
  afternoonDaysPerStaff: 8,
  nightDaysPerStaff: 4,
  maxConsecutiveNights: 3,
  enforceSeniorCoverage: true,
  minCoveragePerShift: { M: 2, A: 2, N: 1 },
  annualLeaveEntitlementFullTime: 30,
  annualLeaveEntitlementPartTime: 15,
};

const SENIOR_RANKS = new Set(["SNO", "SEN", "Doctor", "MO", "Specialist", "NO"]);

type GeneratedRosterEntry = Omit<RosterEntry, "id" | "created_at" | "updated_at">;

function dateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function makeEntry(
  rosterId: string,
  staffId: string,
  date: string,
  shiftCode: ShiftCode,
  opts?: { leaveType?: string | null; isLeave?: boolean },
): GeneratedRosterEntry {
  return {
    roster_id: rosterId,
    staff_id: staffId,
    shift_date: date,
    shift_code: shiftCode,
    shift_config_id: null,
    notes: null,
    is_leave: opts?.isLeave ?? shiftCode === "LEAVE",
    leave_type: opts?.leaveType ?? null,
  };
}

export function autoGenerateEntries(
  rosterId: string,
  departmentId: string,
  staff: Staff[],
  year: number,
  month: number,
  approvedLeaves: LeaveRequest[],
  config: AutoGenerateConfig = defaultAutoGenerateConfig,
): GeneratedRosterEntry[] {
  const days = getMonthDays(year, month);
  const activeStaff = staff.filter((person) => person.department_id === departmentId && person.is_active);

  if (activeStaff.length === 0) return [];

  const leaveDates = new Map<string, Set<string>>();

  for (const leave of approvedLeaves) {
    if (leave.status !== "approved" || !leave.staff_id) continue;

    const staffLeaveDates = leaveDates.get(leave.staff_id) ?? new Set<string>();
    for (const date of dateRange(leave.start_date, leave.end_date)) {
      staffLeaveDates.add(date);
    }
    leaveDates.set(leave.staff_id, staffLeaveDates);
  }

  const shiftCount = new Map<string, Record<ShiftCode, number>>();
  const consecutiveNights = new Map<string, number>();
  const lastShiftCode = new Map<string, ShiftCode | null>();

  for (const person of activeStaff) {
    shiftCount.set(person.id, { M: 0, A: 0, N: 0, O: 0, H: 0, "%": 0, LEAVE: 0, ON_CALL: 0 });
    consecutiveNights.set(person.id, 0);
    lastShiftCode.set(person.id, null);
  }

  const entries: GeneratedRosterEntry[] = [];

  for (const day of days) {
    const available = activeStaff.filter((person) => !leaveDates.get(person.id)?.has(day.iso));
    const onLeave = activeStaff.filter((person) => leaveDates.get(person.id)?.has(day.iso));

    for (const person of onLeave) {
      const leaveRecord = approvedLeaves.find(
        (leave) =>
          leave.staff_id === person.id &&
          leave.status === "approved" &&
          leave.start_date <= day.iso &&
          leave.end_date >= day.iso,
      );

      entries.push(makeEntry(rosterId, person.id, day.iso, "LEAVE", { leaveType: leaveRecord?.leave_type ?? "Annual" }));
      shiftCount.get(person.id)!.LEAVE += 1;
      consecutiveNights.set(person.id, 0);
      lastShiftCode.set(person.id, "LEAVE");
    }

    if (day.isHoliday) {
      for (const person of available) {
        entries.push(makeEntry(rosterId, person.id, day.iso, "H"));
        shiftCount.get(person.id)!.H += 1;
        consecutiveNights.set(person.id, 0);
        lastShiftCode.set(person.id, "H");
      }
      continue;
    }

    const assignedToday = new Map<string, ShiftCode>();
    const sortedByNeed = [...available].sort((a, b) => {
      const aTotals = shiftCount.get(a.id)!;
      const bTotals = shiftCount.get(b.id)!;
      return aTotals.M + aTotals.A + aTotals.N - (bTotals.M + bTotals.A + bTotals.N);
    });

    function pickForShift(shiftCode: "M" | "A" | "N", targetPerStaff: number, count: number) {
      const targetCount = Math.min(count, available.length - assignedToday.size);

      const eligible = sortedByNeed.filter((person) => {
        if (assignedToday.has(person.id)) return false;
        if (shiftCode === "M" && lastShiftCode.get(person.id) === "N") return false;
        if (shiftCode === "N" && (consecutiveNights.get(person.id) ?? 0) >= config.maxConsecutiveNights) return false;
        return true;
      });

      const underTarget = eligible.filter((person) => shiftCount.get(person.id)![shiftCode] < targetPerStaff);
      const pool = underTarget.length >= targetCount ? underTarget : eligible;
      const seniors = pool.filter((person) => SENIOR_RANKS.has(person.rank ?? ""));
      const nonSeniors = pool.filter((person) => !SENIOR_RANKS.has(person.rank ?? ""));
      const ordered = config.enforceSeniorCoverage && seniors.length > 0 ? [...seniors, ...nonSeniors] : pool;

      return ordered
        .sort((a, b) => shiftCount.get(a.id)![shiftCode] - shiftCount.get(b.id)![shiftCode])
        .slice(0, targetCount);
    }

    const morningCount = day.isWeekend
      ? config.minCoveragePerShift.M
      : Math.max(config.minCoveragePerShift.M, Math.ceil(available.length * 0.5));
    const afternoonCount = day.isWeekend
      ? config.minCoveragePerShift.A
      : Math.max(config.minCoveragePerShift.A, Math.ceil(available.length * 0.25));
    const nightCount = Math.max(config.minCoveragePerShift.N, Math.ceil(available.length * 0.15));

    for (const person of pickForShift("M", config.morningDaysPerStaff, morningCount)) {
      assignedToday.set(person.id, "M");
    }
    for (const person of pickForShift("A", config.afternoonDaysPerStaff, afternoonCount)) {
      assignedToday.set(person.id, "A");
    }
    for (const person of pickForShift("N", config.nightDaysPerStaff, nightCount)) {
      assignedToday.set(person.id, "N");
    }

    for (const person of available) {
      assignedToday.set(person.id, assignedToday.get(person.id) ?? "O");
    }

    for (const [staffId, code] of assignedToday) {
      entries.push(makeEntry(rosterId, staffId, day.iso, code));
      shiftCount.get(staffId)![code] += 1;
      consecutiveNights.set(staffId, code === "N" ? (consecutiveNights.get(staffId) ?? 0) + 1 : 0);
      lastShiftCode.set(staffId, code);
    }
  }

  return entries;
}
