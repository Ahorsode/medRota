"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseMedical, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { acceptLocumShift, cancelLocumShift, postLocumShift } from "@/lib/actions/locum";
import { createClient } from "@/lib/supabase/client";
import type { Department, LocumShift } from "@/lib/types";

type LocumUser = {
  userId: string;
  role: string;
  staffId: string | null;
  departmentId: string | null;
  canPost: boolean;
  canAccept: boolean;
};

function hasError(result: LocumShift | { error: string }): result is { error: string } {
  return "error" in result;
}

export function LocumBoardClient({
  initialShifts,
  departments,
  user,
}: {
  initialShifts: LocumShift[];
  departments: Department[];
  user: LocumUser;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"open" | "filled">("open");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      const supabase = createClient();
      const channel = supabase
        .channel("locum-shifts")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "locum_shifts",
          },
          () => {
            router.refresh();
          },
        )
        .subscribe();

      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      unsubscribe = undefined;
    }

    return () => {
      unsubscribe?.();
    };
  }, [router]);

  const openShifts = useMemo(() => initialShifts.filter((shift) => shift.status === "open"), [initialShifts]);
  const filledShifts = useMemo(() => initialShifts.filter((shift) => shift.status === "filled"), [initialShifts]);
  const visibleShifts = tab === "open" ? openShifts : filledShifts;

  async function handlePost(formData: FormData) {
    setPosting(true);
    try {
      const result = await postLocumShift({
        department_id: String(formData.get("department_id") ?? ""),
        shift_date: String(formData.get("shift_date") ?? ""),
        shift_code: String(formData.get("shift_code") ?? "M"),
        requirements: String(formData.get("requirements") ?? "") || undefined,
        posted_by: user.userId,
      });

      if (hasError(result)) {
        toast.error(result.error);
        return;
      }

      toast.success("Locum shift posted");
      router.refresh();
    } finally {
      setPosting(false);
    }
  }

  async function handleAccept(shiftId: string) {
    if (!user.staffId) return;
    setPendingId(shiftId);
    try {
      const result = await acceptLocumShift(shiftId, user.staffId);
      if (hasError(result)) {
        toast.error(result.error);
        return;
      }

      toast.success("Locum shift accepted");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleCancel(shiftId: string) {
    setPendingId(shiftId);
    try {
      const result = await cancelLocumShift(shiftId, user.userId);
      if (hasError(result)) {
        toast.error(result.error);
        return;
      }

      toast.success("Locum shift cancelled");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="grid gap-5 p-5 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setTab("open")}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${tab === "open" ? "bg-white text-[#1A2B4A] shadow-sm" : "text-slate-500"}`}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setTab("filled")}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${tab === "filled" ? "bg-white text-[#1A2B4A] shadow-sm" : "text-slate-500"}`}
            >
              Filled
            </button>
          </div>
          <div className="text-sm text-slate-500">
            {openShifts.length} open · {filledShifts.length} filled
          </div>
        </div>

        <div className="grid gap-3">
          {visibleShifts.map((shift) => (
            <div key={shift.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-950">{shift.department?.name ?? "Department"}</h2>
                    <Badge variant={shift.status === "open" ? "warning" : "success"}>{shift.status}</Badge>
                    <Badge variant="blue">{shift.shift_code}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-sm text-slate-500">{shift.shift_date}</p>
                  {shift.requirements ? <p className="mt-2 text-sm text-slate-600">{shift.requirements}</p> : null}
                  {shift.filled_staff ? (
                    <p className="mt-2 text-sm text-slate-500">
                      Filled by <span className="font-semibold text-slate-800">{shift.filled_staff.full_name}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  {user.canAccept && shift.status === "open" ? (
                    <Button size="sm" onClick={() => void handleAccept(shift.id)} disabled={pendingId === shift.id}>
                      <Check className="h-4 w-4" />
                      Accept
                    </Button>
                  ) : null}
                  {user.canPost && shift.status === "open" ? (
                    <Button size="sm" variant="outline" onClick={() => void handleCancel(shift.id)} disabled={pendingId === shift.id}>
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {visibleShifts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
              No {tab} locum shifts.
            </div>
          ) : null}
        </div>
      </div>

      {user.canPost ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BriefcaseMedical className="h-5 w-5 text-[#2E86AB]" />
            <h2 className="font-bold text-slate-900">Post New Shift</h2>
          </div>
          <form action={handlePost} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-semibold text-slate-600">
              Department
              <select name="department_id" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" required>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-600">
              Date
              <input name="shift_date" type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" required />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-600">
              Shift
              <select name="shift_code" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="M">Morning</option>
                <option value="A">Afternoon</option>
                <option value="N">Night</option>
                <option value="H">Holiday</option>
                <option value="ON_CALL">On-call</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-600">
              Requirements
              <textarea
                name="requirements"
                className="min-h-28 rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Clinical area, grade, or special coverage notes"
              />
            </label>
            <Button type="submit" disabled={posting || departments.length === 0}>
              <Plus className="h-4 w-4" />
              Post Shift
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
