"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LeaveRequest, Staff } from "@/lib/types";

const leaveSchema = z.object({
  staff_id: z.string().min(1, "Staff is required"),
  leave_type: z.string().min(2, "Leave type is required"),
  start_date: z.string().min(8, "Start date is required"),
  end_date: z.string().min(8, "End date is required"),
  reason: z.string().optional(),
}).refine((values) => values.end_date >= values.start_date, {
  message: "End date must be on or after start date",
  path: ["end_date"],
});

type LeaveFormValues = z.infer<typeof leaveSchema>;

export function LeaveForm({
  staff,
  onAdd,
}: {
  staff: Staff[];
  onAdd: (leave: LeaveRequest) => void;
}) {
  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      staff_id: staff[0]?.id ?? "",
      leave_type: "Annual",
      start_date: "",
      end_date: "",
      reason: "",
    },
  });

  return (
    <form
      className="grid gap-3 md:grid-cols-5"
      onSubmit={form.handleSubmit((values) => {
        onAdd({
          id: `leave-${values.staff_id}-${values.start_date}-${values.end_date}`,
          staff_id: values.staff_id,
          leave_type: values.leave_type,
          start_date: values.start_date,
          end_date: values.end_date,
          reason: values.reason || null,
          status: "pending",
          requested_at: "2026-06-12T00:00:00.000Z",
          reviewed_by: null,
          reviewed_at: null,
          notes: null,
        });
        form.reset();
        toast.success("Leave request submitted");
      })}
    >
      <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" {...form.register("staff_id")}>
        {staff.map((person) => (
          <option key={person.id} value={person.id}>
            {person.full_name}
          </option>
        ))}
      </select>
      <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" {...form.register("leave_type")}>
        {["Annual", "Sick", "Study", "Maternity", "Paternity", "Compassionate", "Emergency"].map((type) => (
          <option key={type}>{type}</option>
        ))}
      </select>
      <Input type="date" {...form.register("start_date")} />
      <Input type="date" {...form.register("end_date")} />
      <Input placeholder="Reason" {...form.register("reason")} />
      <Button className="md:col-span-5" type="submit" disabled={form.formState.isSubmitting}>
        New Leave Request
      </Button>
    </form>
  );
}
