import { Badge } from "@/components/ui/badge";
import type { LeaveRequest, Staff } from "@/lib/types";
import { getMonthDays } from "@/lib/utils/dates";

export function LeaveCalendar({ leaves, staff, year, month }: { leaves: LeaveRequest[]; staff: Staff[]; year: number; month: number }) {
  const days = getMonthDays(year, month);

  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {days.map((day) => {
        const dayLeaves = leaves.filter((leave) => leave.start_date <= day.iso && leave.end_date >= day.iso);
        return (
          <div key={day.iso} className="min-h-28 border-b border-r border-slate-100 p-2">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-mono font-bold">{day.dayNumber}</span>
              <span className="text-slate-400">{day.dayName}</span>
            </div>
            <div className="space-y-1">
              {dayLeaves.map((leave) => (
                <Badge key={`${leave.id}-${day.iso}`} variant="purple">
                  {staff.find((person) => person.id === leave.staff_id)?.full_name.split(" ")[0]} · {leave.leave_type}
                </Badge>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
