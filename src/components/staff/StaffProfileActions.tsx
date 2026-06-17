"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetStaffPassword } from "@/lib/actions/staff";
import type { Staff } from "@/lib/types";

export function StaffProfileActions({ staff, canResetPassword = false }: { staff: Staff; canResetPassword?: boolean }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(staff.full_name);
  const [rank, setRank] = useState(staff.rank ?? "");
  const [position, setPosition] = useState(staff.position ?? "");
  const [resetting, setResetting] = useState(false);

  async function handleResetPassword() {
    setResetting(true);
    const result = await resetStaffPassword(staff.id);
    setResetting(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success(`Temporary password reset to staff number: ${result.temporaryPassword}`, {
      duration: 10000,
    });
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        {canResetPassword ? (
          <Button disabled={resetting} onClick={handleResetPassword} type="button" variant="outline">
            <KeyRound className="h-4 w-4" />
            {resetting ? "Resetting..." : "Reset Password"}
          </Button>
        ) : null}
        <Button onClick={() => setOpen(true)} type="button">
          Edit
        </Button>
      </div>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-2xl">
            <Dialog.Title className="text-lg font-extrabold text-slate-950">Edit Staff Profile</Dialog.Title>
            <div className="mt-4 space-y-3">
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
              <Input value={rank} onChange={(event) => setRank(event.target.value)} />
              <Input value={position} onChange={(event) => setPosition(event.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    setOpen(false);
                    toast.success("Staff profile updated in local preview");
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
