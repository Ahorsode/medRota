"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createLeaveRequest } from "@/lib/actions/leave";

const LEAVE_TYPES = [
  "Annual Leave",
  "Sick Leave",
  "Study Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Compassionate Leave",
  "Emergency Leave",
];

export function StaffLeaveForm({ staffId }: { staffId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await createLeaveRequest({
      staff_id: staffId,
      leave_type: String(formData.get("leave_type")),
      start_date: String(formData.get("start_date")),
      end_date: String(formData.get("end_date")),
      reason: String(formData.get("reason") ?? "") || undefined,
    });
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Leave request submitted. Awaiting HOD approval.");
    setOpen(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-[#1A2B4A]">
        <PlusCircle className="h-4 w-4" />
        Request Leave
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Leave Request</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Leave Type</label>
              <select name="leave_type" required className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                {LEAVE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Start Date</label>
                <input name="start_date" type="date" required className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">End Date</label>
                <input name="end_date" type="date" required className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Reason</label>
              <textarea name="reason" rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Brief reason for leave" />
            </div>
            <Button type="submit" className="w-full bg-[#1A2B4A]" disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
