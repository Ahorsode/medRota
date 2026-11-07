"use client";

import { Download, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";

type Row = Record<string, string | number>;

export function ReportsActions({
  periodLabel,
  fileSuffix,
  staffing,
  leave,
  nightFairness,
}: {
  periodLabel: string;
  fileSuffix: string;
  staffing: Row[];
  leave: Array<{ name: string; value: number }>;
  nightFairness: Array<{ name: string; nights: number }>;
}) {
  function handleExport() {
    const book = XLSX.utils.book_new();
    const sheets: Array<[string, Row[]]> = [
      ["Staffing", staffing],
      ["Leave", leave.map((item) => ({ "Leave Type": item.name, Requests: item.value }))],
      ["Night Fairness", nightFairness.map((item) => ({ Staff: item.name, "Night Shifts": item.nights }))],
    ];

    for (const [name, rows] of sheets) {
      const sheet = rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([[`No data for ${periodLabel}`]]);
      XLSX.utils.book_append_sheet(book, sheet, name);
    }

    XLSX.writeFile(book, `SDA_Hospital_Report_${fileSuffix}.xlsx`);
  }

  return (
    <>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Print
      </Button>
      <Button onClick={handleExport}>
        <Download className="h-4 w-4" />
        Export
      </Button>
    </>
  );
}
