"use client";

import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import type { PayrollSummary } from "@/lib/types";

export function PayrollTable({ summaries, month, year }: { summaries: PayrollSummary[]; month: number; year: number }) {
  function handleExportExcel() {
    const rows = summaries.map((summary) => ({
      "Staff Name": summary.staff?.full_name ?? "-",
      Department: summary.staff?.department?.name ?? "-",
      Morning: summary.morning_shifts,
      Afternoon: summary.afternoon_shifts,
      Night: summary.night_shifts,
      Weekend: summary.weekend_shifts,
      Holiday: summary.holiday_shifts,
      "On-Call": summary.on_call_shifts,
      "Total Shifts": summary.total_shifts,
      "Leave Days": summary.leave_days,
      "Absent Days": summary.absent_days,
      "Night Allowance (GHS)": summary.night_allowance.toFixed(2),
      "Weekend Allowance (GHS)": summary.weekend_allowance.toFixed(2),
      "Holiday Allowance (GHS)": summary.holiday_allowance.toFixed(2),
      "On-Call Allowance (GHS)": summary.on_call_allowance.toFixed(2),
      "Total Allowance (GHS)": summary.total_allowance.toFixed(2),
    }));

    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Payroll");
    XLSX.writeFile(book, `SDA_Hospital_Payroll_${String(month).padStart(2, "0")}_${year}.xlsx`);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="font-bold text-slate-800">Staff Allowance Breakdown</h2>
        <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={summaries.length === 0}>
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Staff", "Dept", "M", "A", "N", "WE", "H", "OC", "Shifts", "Leave", "Absent", "Night", "Weekend", "Holiday", "On-Call", "Total"].map(
                (heading) => (
                  <th key={heading} className="px-3 py-3 text-left text-xs font-bold uppercase text-slate-500">
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {summaries.map((summary) => (
              <tr key={summary.id} className="hover:bg-slate-50/70">
                <td className="px-3 py-3 font-semibold text-slate-800">{summary.staff?.full_name ?? "-"}</td>
                <td className="px-3 py-3 text-xs text-slate-500">{summary.staff?.department?.name ?? "-"}</td>
                <td className="px-3 py-3 text-center">{summary.morning_shifts}</td>
                <td className="px-3 py-3 text-center">{summary.afternoon_shifts}</td>
                <td className="px-3 py-3 text-center font-semibold text-indigo-600">{summary.night_shifts}</td>
                <td className="px-3 py-3 text-center">{summary.weekend_shifts}</td>
                <td className="px-3 py-3 text-center font-semibold text-orange-600">{summary.holiday_shifts}</td>
                <td className="px-3 py-3 text-center font-semibold text-rose-600">{summary.on_call_shifts}</td>
                <td className="px-3 py-3 text-center font-semibold">{summary.total_shifts}</td>
                <td className="px-3 py-3 text-center text-purple-600">{summary.leave_days}</td>
                <td className="px-3 py-3 text-center text-red-600">{summary.absent_days}</td>
                <td className="px-3 py-3 text-right">{summary.night_allowance.toFixed(2)}</td>
                <td className="px-3 py-3 text-right">{summary.weekend_allowance.toFixed(2)}</td>
                <td className="px-3 py-3 text-right">{summary.holiday_allowance.toFixed(2)}</td>
                <td className="px-3 py-3 text-right">{summary.on_call_allowance.toFixed(2)}</td>
                <td className="px-3 py-3 text-right font-bold text-emerald-700">{summary.total_allowance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          {summaries.length > 0 ? (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={15} className="px-3 py-3 font-bold text-slate-700">
                  Grand Total
                </td>
                <td className="px-3 py-3 text-right text-base font-extrabold text-emerald-700">
                  GHS {summaries.reduce((sum, summary) => sum + summary.total_allowance, 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {summaries.length === 0 ? <div className="px-5 py-10 text-center text-sm text-slate-400">No payroll summaries generated for this period.</div> : null}
    </div>
  );
}
