"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateStaffIdLoginAllowed } from "@/lib/actions/staff";
import type { Staff } from "@/lib/types";

export function StaffIdLoginCard({
  staff,
  canManage = false,
}: {
  staff: Staff;
  canManage?: boolean;
}) {
  const [enabled, setEnabled] = useState(staff.allow_staff_id_login);
  const [saving, setSaving] = useState(false);

  const canTurnOn = !staff.has_logged_in;
  const toggleDisabled = !canManage || saving || (!enabled && !canTurnOn);

  async function handleToggle() {
    if (!canManage) return;

    const nextEnabled = !enabled;
    if (nextEnabled && staff.has_logged_in) {
      toast.error("Staff ID login cannot be turned on again after this person has signed in.");
      return;
    }

    setSaving(true);
    const result = await updateStaffIdLoginAllowed(staff.id, nextEnabled);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setEnabled(result.allow_staff_id_login);
    toast.success(
      result.allow_staff_id_login
        ? "Staff can sign in with their staff number as the temporary password."
        : "Staff ID login disabled. They must use Google sign-in.",
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Staff ID Login
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-slate-600">
          When enabled, the staff member can sign in with their email or phone and their staff number as the
          temporary password. Turn this off to prevent anyone from guessing email + staff number.
        </p>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
          <div>
            <p className="font-semibold text-slate-950">
              {enabled ? "Staff ID login is on" : "Staff ID login is off"}
            </p>
            <p className="text-xs text-slate-500">
              {staff.has_logged_in
                ? "This person has signed in before. HR cannot turn staff ID login back on."
                : enabled
                  ? "They must change this password on first sign-in."
                  : "Use Google sign-in or enable staff ID login before their first sign-in."}
            </p>
          </div>
          {canManage ? (
            <Button
              type="button"
              variant={enabled ? "outline" : "default"}
              disabled={toggleDisabled}
              onClick={handleToggle}
            >
              {saving ? "Saving..." : enabled ? "Turn off" : "Turn on"}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              <ShieldCheck className="h-3 w-3" />
              HR only
            </span>
          )}
        </div>

        {canManage && staff.has_logged_in && !enabled ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This account has already been used. For security, staff ID login cannot be re-enabled.
          </p>
        ) : null}

        {canManage && !staff.has_logged_in && !enabled ? (
          <p className="text-xs text-slate-500">
            Turning this on sets their password to their staff number and requires a password change on first login.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
