"use client";

import { Download, FileSpreadsheet, Printer, RotateCcw, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Department, Roster, RosterEntry, Staff } from "@/lib/types";
import { exportRosterToExcel, exportRosterToPdf } from "@/lib/utils/export";

export function RosterToolbar({
  roster,
  department,
  staff,
  entries,
}: {
  roster: Roster;
  department: Department;
  staff: Staff[];
  entries: RosterEntry[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => toast.success("Auto-generation preview applied")}>
        <Sparkles className="h-4 w-4" />
        Auto-Generate
      </Button>
      <Button size="sm" variant="outline" onClick={() => toast.warning("Month cleared in local preview")}>
        <RotateCcw className="h-4 w-4" />
        Clear Month
      </Button>
      <Button size="sm" variant="outline" onClick={() => exportRosterToPdf({ roster, department, staff, entries })}>
        <Printer className="h-4 w-4" />
        Export PDF
      </Button>
      <Button size="sm" variant="outline" onClick={() => exportRosterToExcel({ roster, department, staff, entries })}>
        <FileSpreadsheet className="h-4 w-4" />
        Export Excel
      </Button>
      <Button size="sm" onClick={() => toast.success("Roster submitted for approval")}>
        <Send className="h-4 w-4" />
        Submit
      </Button>
      <Button size="sm" variant="navy" onClick={() => toast.success("Published roster notifications queued")}>
        <Download className="h-4 w-4" />
        Publish
      </Button>
    </div>
  );
}
