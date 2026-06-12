import type { DaySummary } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

const rows = [
  { key: "M", label: "Morning", className: "text-blue-700" },
  { key: "A", label: "Afternoon", className: "text-amber-700" },
  { key: "N", label: "Night", className: "text-indigo-700" },
] as const;

export function ShiftSummaryBar({ summaries }: { summaries: DaySummary[] }) {
  return (
    <div className="min-w-max border-t border-slate-200 bg-white">
      {rows.map((row) => (
        <div
          key={row.key}
          className="grid min-h-9 items-center border-b border-slate-100 text-xs"
          style={{ gridTemplateColumns: `290px repeat(${summaries.length}, 44px)` }}
        >
          <div className={cn("sticky left-0 z-10 bg-white px-4 font-bold", row.className)}>{row.label}</div>
          {summaries.map((summary) => (
            <div key={`${row.key}-${summary.date}`} className="text-center font-mono font-semibold text-slate-700">
              {summary[row.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
