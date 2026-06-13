import type { Conflict, DaySummary, LeaveSpanSegment, RosterEntry, ShiftCode, ShiftConfiguration, Staff } from "@/lib/types";
import { getMonthDays } from "@/lib/utils/dates";

export const shiftOptions: Array<{ code: ShiftCode; label: string }> = [
  { code: "M", label: "Morning" },
  { code: "A", label: "Afternoon" },
  { code: "N", label: "Night" },
  { code: "O", label: "Off Day" },
  { code: "H", label: "Holiday" },
  { code: "%", label: "Off Day" },
  { code: "LEAVE", label: "Leave" },
  { code: "ON_CALL", label: "On Call" },
];

export const shiftColorClasses: Record<ShiftCode, string> = {
  M: "border-blue-200 bg-blue-100 text-blue-700",
  A: "border-amber-200 bg-amber-100 text-amber-700",
  N: "border-indigo-200 bg-indigo-100 text-indigo-700",
  O: "border-slate-200 bg-slate-100 text-slate-500",
  H: "border-orange-200 bg-orange-100 text-orange-700",
  "%": "border-slate-200 bg-slate-100 text-slate-400",
  LEAVE: "border-purple-200 bg-purple-100 text-purple-700",
  ON_CALL: "border-rose-200 bg-rose-100 text-rose-700",
};

export function getEntryKey(staffId: string, shiftDate: string) {
  return `${staffId}:${shiftDate}`;
}

export function buildEntryMap(entries: RosterEntry[]) {
  return new Map(entries.filter((entry) => entry.staff_id).map((entry) => [getEntryKey(entry.staff_id ?? "", entry.shift_date), entry]));
}

export function getShiftConfiguration(configs: ShiftConfiguration[], departmentId: string, code: ShiftCode) {
  return configs.find((config) => config.department_id === departmentId && config.shift_code === code);
}

export function summarizeDays(entries: RosterEntry[], year: number, month: number): DaySummary[] {
  return getMonthDays(year, month).map((day) => {
    const summary: DaySummary = {
      date: day.iso,
      M: 0,
      A: 0,
      N: 0,
      O: 0,
      H: 0,
      "%": 0,
      LEAVE: 0,
      ON_CALL: 0,
    };

    entries
      .filter((entry) => entry.shift_date === day.iso)
      .forEach((entry) => {
        summary[entry.shift_code] += 1;
      });

    return summary;
  });
}

export function monthlyShiftTotals(entries: RosterEntry[]) {
  return entries.reduce(
    (totals, entry) => {
      totals[entry.shift_code] += 1;
      return totals;
    },
    { M: 0, A: 0, N: 0, O: 0, H: 0, "%": 0, LEAVE: 0, ON_CALL: 0 } as Record<ShiftCode, number>,
  );
}

export function findConflicts(entries: RosterEntry[], staff: Staff[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const seniorRanks = new Set(["SNO", "SEN", "Doctor", "MO", "Specialist"]);
  const byStaff = new Map<string, RosterEntry[]>();

  entries.forEach((entry) => {
    if (!entry.staff_id) return;
    const current = byStaff.get(entry.staff_id) ?? [];
    current.push(entry);
    byStaff.set(entry.staff_id, current);
  });

  byStaff.forEach((staffEntries, staffId) => {
    const sorted = [...staffEntries].sort((a, b) => a.shift_date.localeCompare(b.shift_date));
    let consecutiveNights = 0;

    sorted.forEach((entry, index) => {
      consecutiveNights = entry.shift_code === "N" ? consecutiveNights + 1 : 0;
      if (consecutiveNights > 3) {
        conflicts.push({ staffId, date: entry.shift_date, reason: "More than 3 consecutive night shifts" });
      }

      const previous = sorted[index - 1];
      if (previous?.shift_code === "N" && entry.shift_code === "M") {
        conflicts.push({ staffId, date: entry.shift_date, reason: "Rest period below 8 hours after night shift" });
      }
    });
  });

  const byDateAndShift = new Map<string, RosterEntry[]>();
  entries
    .filter((entry) => ["M", "A", "N"].includes(entry.shift_code))
    .forEach((entry) => {
      if (!entry.staff_id) return;
      const key = `${entry.shift_date}:${entry.shift_code}`;
      const current = byDateAndShift.get(key) ?? [];
      current.push(entry);
      byDateAndShift.set(key, current);
    });

  byDateAndShift.forEach((shiftEntries) => {
    const hasSenior = shiftEntries.some((entry) => {
      const staffMember = staff.find((person) => person.id === entry.staff_id);
      return seniorRanks.has(staffMember?.rank ?? "");
    });

    if (!hasSenior && shiftEntries[0]) {
      shiftEntries.forEach((entry) => {
        if (entry.staff_id) {
          conflicts.push({ staffId: entry.staff_id, date: entry.shift_date, reason: "No senior staff assigned to this shift" });
        }
      });
    }
  });

  return conflicts;
}

export function buildLeaveSpans(entries: RosterEntry[]): LeaveSpanSegment[] {
  const spans: LeaveSpanSegment[] = [];
  const byStaff = new Map<string, RosterEntry[]>();

  entries
    .filter((entry) => entry.is_leave || entry.shift_code === "LEAVE")
    .forEach((entry) => {
      if (!entry.staff_id) return;
      const current = byStaff.get(entry.staff_id) ?? [];
      current.push(entry);
      byStaff.set(entry.staff_id, current);
    });

  byStaff.forEach((staffEntries, staffId) => {
    const sorted = [...staffEntries].sort((a, b) => a.shift_date.localeCompare(b.shift_date));
    let segment: RosterEntry[] = [];

    const flush = () => {
      if (segment.length === 0) return;
      const start = segment[0];
      const end = segment[segment.length - 1];
      spans.push({
        staffId,
        startDate: start.shift_date,
        endDate: end.shift_date,
        startDay: Number(start.shift_date.slice(-2)),
        length: segment.length,
        label: `${start.leave_type ?? "Leave"} Leave`.toUpperCase(),
      });
      segment = [];
    };

    sorted.forEach((entry) => {
      const previous = segment[segment.length - 1];
      const previousDay = previous ? Number(previous.shift_date.slice(-2)) : null;
      const currentDay = Number(entry.shift_date.slice(-2));

      if (!previous || previousDay === currentDay - 1) {
        segment.push(entry);
      } else {
        flush();
        segment.push(entry);
      }
    });

    flush();
  });

  return spans;
}
