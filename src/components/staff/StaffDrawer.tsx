"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RosterEntry, Staff } from "@/lib/types";
import { formatDateLabel } from "@/lib/utils/dates";

export function StaffDrawer({
  staff,
  entries,
  open,
  onOpenChange,
}: {
  staff: Staff | null;
  entries: RosterEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!staff) return null;
  const upcoming = entries.filter((entry) => entry.staff_id === staff.id).slice(0, 8);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-extrabold text-slate-950">{staff.full_name}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                {staff.position} · {staff.staff_number}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label="Close drawer">
                <X className="h-5 w-5" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Rank</p>
              <p className="font-bold">{staff.rank}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Employment</p>
              <p className="font-bold">{staff.employment_type}</p>
            </div>
            <div className="col-span-2 rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Contact</p>
              <p className="font-semibold">{staff.phone}</p>
              <p className="text-sm text-slate-500">{staff.email}</p>
            </div>
          </div>
          <h3 className="mt-6 text-sm font-extrabold uppercase text-slate-500">Upcoming shifts</h3>
          <div className="mt-3 space-y-2">
            {upcoming.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <span className="text-sm font-medium">{formatDateLabel(entry.shift_date)}</span>
                <Badge variant={entry.shift_code === "LEAVE" ? "purple" : "teal"}>{entry.shift_code}</Badge>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
