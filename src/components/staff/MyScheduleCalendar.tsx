"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RosterEntry } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { getMonthDays } from "@/lib/utils/dates";

const SHIFT_STYLES: Record<string, { bg: string; text: string; label: string; hours: string }> = {
  M: { bg: "bg-blue-100", text: "text-blue-700", label: "Morning", hours: "07:30 - 14:00" },
  A: { bg: "bg-amber-100", text: "text-amber-700", label: "Afternoon", hours: "14:00 - 20:30" },
  N: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Night", hours: "20:30 - 07:30" },
  O: { bg: "bg-slate-100", text: "text-slate-500", label: "Off Day", hours: "" },
  H: { bg: "bg-orange-100", text: "text-orange-700", label: "Holiday", hours: "" },
  LEAVE: { bg: "bg-purple-100", text: "text-purple-700", label: "Leave", hours: "" },
  "%": { bg: "bg-slate-100", text: "text-slate-400", label: "Off", hours: "" },
  ON_CALL: { bg: "bg-rose-100", text: "text-rose-700", label: "On Call", hours: "On call" },
};

export function MyScheduleCalendar({
  entries,
  month,
  year,
}: {
  entries: RosterEntry[];
  month: number;
  year: number;
  staffId: string;
}) {
  const router = useRouter();
  const days = getMonthDays(year, month);
  const entryMap = new Map(entries.map((entry) => [entry.shift_date, entry]));
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const blankDays = Array.from({ length: firstDayOfWeek }, (_, index) => `blank-${index}`);
  const counts = { M: 0, A: 0, N: 0, O: 0, LEAVE: 0 };

  for (const entry of entries) {
    if (entry.shift_code in counts) counts[entry.shift_code as keyof typeof counts] += 1;
  }

  function navigate(dir: -1 | 1) {
    let nextMonth = month + dir;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    }
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    router.push(`/dashboard/my-schedule?month=${nextMonth}&year=${nextYear}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-[#0F172A]">
          {new Date(year, month - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </h2>
        <Button variant="outline" size="icon" onClick={() => navigate(1)} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-2 text-center text-xs font-semibold uppercase text-slate-500">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {blankDays.map((day) => (
            <div key={day} className="min-h-28 border-r border-t border-slate-100 bg-slate-50/50" />
          ))}
          {days.map((day) => {
            const entry = entryMap.get(day.iso);
            const code = entry?.shift_code ?? "O";
            const style = SHIFT_STYLES[code] ?? SHIFT_STYLES.O;
            return (
              <div key={day.iso} className={cn("min-h-28 border-r border-t border-slate-100 p-2", day.isWeekend && "bg-slate-50/70")}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-slate-900">{day.dayNumber}</span>
                  {day.isHoliday ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">HOL</span> : null}
                </div>
                <div className={`mt-3 rounded-md px-2 py-2 text-center ${style.bg}`}>
                  <p className={`text-sm font-extrabold ${style.text}`}>{code}</p>
                  <p className={`text-[11px] ${style.text}`}>{style.label}</p>
                </div>
                <p className="mt-2 min-h-4 text-center text-xs text-slate-500">{entry?.leave_type ?? style.hours}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Object.entries(counts).map(([code, count]) => {
          const style = SHIFT_STYLES[code] ?? SHIFT_STYLES.O;
          return (
            <div key={code} className={`rounded-lg border border-slate-200 px-3 py-3 text-center ${style.bg}`}>
              <div className={`font-mono text-xl font-bold ${style.text}`}>{count}</div>
              <div className={`text-xs ${style.text}`}>{style.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
