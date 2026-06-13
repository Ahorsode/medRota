"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { StaffDrawer } from "@/components/staff/StaffDrawer";
import { LeaveSpan } from "@/components/roster/LeaveSpan";
import { ShiftCell } from "@/components/roster/ShiftCell";
import { ShiftSummaryBar } from "@/components/roster/ShiftSummaryBar";
import type { Department, Roster, RosterEntry, ShiftCode, ShiftConfiguration, Staff } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { getMonthDays } from "@/lib/utils/dates";
import {
  buildEntryMap,
  buildLeaveSpans,
  findConflicts,
  getEntryKey,
  getShiftConfiguration,
  summarizeDays,
} from "@/lib/utils/shifts";

export function RosterGrid({
  roster,
  entries,
  staff,
  department,
  shiftConfigurations,
  editable,
  onCellChange,
}: {
  roster: Roster;
  entries: RosterEntry[];
  staff: Staff[];
  department: Department;
  shiftConfigurations: ShiftConfiguration[];
  editable: boolean;
  onCellChange: (staffId: string, date: string, shiftCode: ShiftCode) => void;
}) {
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => getMonthDays(roster.year, roster.month), [roster.month, roster.year]);
  const entryMap = useMemo(() => buildEntryMap(entries), [entries]);
  const summaries = useMemo(() => summarizeDays(entries, roster.year, roster.month), [entries, roster.month, roster.year]);
  const conflicts = useMemo(() => findConflicts(entries, staff), [entries, staff]);
  const leaveSpans = useMemo(() => buildLeaveSpans(entries), [entries]);
  const visibleStaff = staff.filter((person) => person.department_id === department.id && person.is_active);
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: visibleStaff.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div ref={scrollRef} className="max-h-[68vh] overflow-auto">
          <div className="sticky top-0 z-30 min-w-max border-b border-slate-200 bg-white">
            <div
              className="grid min-h-14 items-center text-xs font-bold uppercase text-slate-500"
              style={{ gridTemplateColumns: `220px 70px repeat(${days.length}, 44px)` }}
            >
              <div className="sticky left-0 z-40 flex h-full items-center border-r border-slate-200 bg-white px-4">Name</div>
              <div className="sticky left-[220px] z-40 flex h-full items-center border-r border-slate-200 bg-white px-3">Rank</div>
              {days.map((day) => (
                <div
                  key={day.iso}
                  className={cn(
                    "flex h-full flex-col items-center justify-center border-r border-slate-100",
                    day.isWeekend && "bg-slate-50",
                    day.isHoliday && "bg-orange-50 text-orange-700",
                  )}
                >
                  <span className="font-mono text-sm text-slate-950">{day.dayNumber}</span>
                  <span>{day.dayName}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-w-max" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const person = visibleStaff[virtualRow.index];
              const rowSpans = leaveSpans.filter((span) => span.staffId === person.id);

              return (
                <div
                  key={person.id}
                  className={cn(
                    "absolute left-0 grid h-[52px] items-center border-b border-slate-100",
                    person.employment_type === "Locum" && "border-b-2 border-dashed border-rose-200",
                  )}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                    gridTemplateColumns: `220px 70px repeat(${days.length}, 44px)`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaff(person);
                      setDrawerOpen(true);
                    }}
                    className={cn(
                      "sticky left-0 z-20 flex h-full items-center border-r border-slate-200 bg-white px-4 text-left text-sm font-bold text-slate-900 hover:text-[#2E86AB]",
                      person.employment_type === "Locum" && "bg-rose-50",
                    )}
                  >
                    {person.full_name}
                  </button>
                  <div className="sticky left-[220px] z-20 flex h-full items-center border-r border-slate-200 bg-white px-3 text-xs font-bold text-slate-500">
                    {person.rank}
                  </div>
                  {days.map((day) => {
                    const span = rowSpans.find((item) => item.startDate === day.iso);
                    const insideSpan = rowSpans.some((item) => day.dayNumber > item.startDay && day.dayNumber < item.startDay + item.length);
                    if (span) return <LeaveSpan key={day.iso} label={span.label} length={span.length} />;
                    if (insideSpan) return null;

                    const entry = entryMap.get(getEntryKey(person.id, day.iso));
                    const code = entry?.shift_code ?? "O";
                    const conflict = conflicts.find((item) => item.staffId === person.id && item.date === day.iso);
                    const config = getShiftConfiguration(shiftConfigurations, department.id, code);

                    return (
                      <div
                        key={day.iso}
                        className={cn("flex h-full items-center justify-center border-r border-slate-100", day.isWeekend && "bg-slate-50/70")}
                      >
                        <ShiftCell
                          code={code}
                          staffName={person.full_name}
                          date={day.iso}
                          editable={editable}
                          hasConflict={Boolean(conflict)}
                          conflictReason={conflict?.reason}
                          configuration={config}
                          onChange={(nextCode) => {
                            onCellChange(person.id, day.iso, nextCode);
                            toast.success(`${person.full_name} updated to ${nextCode} on ${day.dayNumber}`);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <ShiftSummaryBar summaries={summaries} />
        </div>
      </div>
      <StaffDrawer staff={selectedStaff} entries={entries} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
