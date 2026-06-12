"use client";

import { useMemo, useState } from "react";
import { RosterGrid } from "@/components/roster/RosterGrid";
import { RosterStatusBadge } from "@/components/roster/RosterStatusBadge";
import { RosterToolbar } from "@/components/roster/RosterToolbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Department, Roster, RosterEntry, ShiftCode, ShiftConfiguration, Staff } from "@/lib/types";
import { getMonthDays, monthNames } from "@/lib/utils/dates";
import { monthlyShiftTotals } from "@/lib/utils/shifts";

export function RosterWorkspace({
  roster,
  department,
  initialEntries,
  staff,
  shiftConfigurations,
}: {
  roster: Roster;
  department: Department;
  initialEntries: RosterEntry[];
  staff: Staff[];
  shiftConfigurations: ShiftConfiguration[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const departmentStaff = staff.filter((person) => person.department_id === department.id);
  const totals = useMemo(() => monthlyShiftTotals(entries), [entries]);
  const days = getMonthDays(roster.year, roster.month);

  function handleCellChange(staffId: string, date: string, shiftCode: ShiftCode) {
    setEntries((current) =>
      current.map((entry) =>
        entry.staff_id === staffId && entry.shift_date === date
          ? {
              ...entry,
              shift_code: shiftCode,
              is_leave: shiftCode === "LEAVE",
              leave_type: shiftCode === "LEAVE" ? entry.leave_type ?? "Annual" : null,
              updated_at: new Date().toISOString(),
            }
          : entry,
      ),
    );
  }

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-extrabold text-slate-950">
              {department.name} · {monthNames[roster.month - 1]} {roster.year} Duty Roster
            </h2>
            <RosterStatusBadge status={roster.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {departmentStaff.length} staff · {days.length} days · inline editing enabled
          </p>
        </div>
        <RosterToolbar roster={roster} department={department} staff={staff} entries={entries} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="blue">Morning: {totals.M}</Badge>
            <Badge variant="warning">Afternoon: {totals.A}</Badge>
            <Badge variant="purple">Night: {totals.N}</Badge>
            <Badge>Off: {totals.O + totals["%"]}</Badge>
            <Badge variant="purple">Leave: {totals.LEAVE}</Badge>
          </div>
          <RosterGrid
            roster={roster}
            entries={entries}
            staff={staff}
            department={department}
            shiftConfigurations={shiftConfigurations}
            editable
            onCellChange={handleCellChange}
          />
        </div>
        <Card className="h-max">
          <CardContent className="p-5">
            <h3 className="font-extrabold text-slate-950">Monthly Shift Summary</h3>
            <div className="mt-4 space-y-3 text-sm">
              <Summary label="Morning" value={totals.M} color="text-blue-700" />
              <Summary label="Afternoon" value={totals.A} color="text-amber-700" />
              <Summary label="Night" value={totals.N} color="text-indigo-700" />
              <Summary label="Holiday" value={totals.H} color="text-orange-700" />
              <Summary label="Leave" value={totals.LEAVE} color="text-purple-700" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Summary({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className={`font-mono text-lg font-extrabold ${color}`}>{value}</span>
    </div>
  );
}
