"use client";

import { CheckCircle2, Download, FileSpreadsheet, Printer, RotateCcw, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Department, Roster, RosterEntry, RosterStatus, Staff } from "@/lib/types";
import { exportRosterToExcel, exportRosterToPdf } from "@/lib/utils/export";

export function RosterToolbar({
  roster,
  department,
  staff,
  entries,
  onStatusChange,
  onPersistStatus,
  onAutoGenerate,
}: {
  roster: Roster;
  department: Department;
  staff: Staff[];
  entries: RosterEntry[];
  onStatusChange: (status: RosterStatus) => void;
  onPersistStatus?: (status: RosterStatus) => void;
  onAutoGenerate: () => void;
}) {
  function nextStatus() {
    const transitions: Partial<Record<RosterStatus, RosterStatus>> = {
      draft: "submitted",
      submitted: "hod_signed",
      hod_signed: "director_signed",
      director_signed: "published",
    };

    return transitions[roster.status];
  }

  const targetStatus = nextStatus();
  const workflowLabel: Partial<Record<RosterStatus, string>> = {
    submitted: "Submit for Approval",
    hod_signed: "Sign & Submit",
    director_signed: "Director Countersign",
    published: "Publish",
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={onAutoGenerate}>
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
      {targetStatus ? (
        <Button
          size="sm"
          variant={targetStatus === "published" ? "navy" : "default"}
          onClick={() => {
            onStatusChange(targetStatus);
            onPersistStatus?.(targetStatus);
            toast.success(`Roster marked ${targetStatus}`);
          }}
        >
          {targetStatus === "published" ? <Download className="h-4 w-4" /> : targetStatus === "approved" ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {workflowLabel[targetStatus]}
        </Button>
      ) : null}
    </div>
  );
}
