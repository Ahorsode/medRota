"use client";

import { CheckCircle2, FileSpreadsheet, PenLine, Printer, RotateCcw, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { UserRoleName } from "@/lib/auth/getSessionUser";
import type { Department, Roster, RosterEntry, RosterStatus, Staff } from "@/lib/types";
import { exportRosterToExcel, exportRosterToPdf } from "@/lib/utils/export";

export function RosterToolbar({
  roster,
  department,
  staff,
  entries,
  userRole,
  onStatusChange,
  onPersistStatus,
  onSign,
  onAutoGenerate,
}: {
  roster: Roster;
  department: Department;
  staff: Staff[];
  entries: RosterEntry[];
  userRole: UserRoleName;
  onStatusChange: (status: RosterStatus) => void;
  onPersistStatus?: (status: RosterStatus) => void;
  onSign?: (signerRole: "hod" | "director") => void;
  onAutoGenerate: () => void;
}) {
  const canPublish = roster.status === "director_signed" && (userRole === "admin" || userRole === "hr_officer");

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
      {roster.status === "draft" ? (
        <Button
          size="sm"
          variant="default"
          onClick={() => {
            onStatusChange("submitted");
            onPersistStatus?.("submitted");
            toast.success("Roster submitted");
          }}
        >
          <Send className="h-4 w-4" />
          Submit for Approval
        </Button>
      ) : null}
      {roster.status === "submitted" && userRole === "department_head" ? (
        <Button size="sm" variant="navy" onClick={() => onSign?.("hod")}>
          <PenLine className="h-4 w-4" />
          Sign as HOD
        </Button>
      ) : null}
      {roster.status === "hod_signed" && userRole === "medical_director" ? (
        <Button size="sm" variant="navy" onClick={() => onSign?.("director")}>
          <PenLine className="h-4 w-4" />
          Director Sign-off
        </Button>
      ) : null}
      {canPublish ? (
        <Button
          size="sm"
          variant="navy"
          onClick={() => {
            onStatusChange("published");
            onPersistStatus?.("published");
            toast.success("Roster published");
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          Publish
        </Button>
      ) : null}
    </div>
  );
}
