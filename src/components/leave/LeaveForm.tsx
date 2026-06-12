"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const leaveSchema = z.object({
  staffName: z.string().min(2),
  leaveType: z.string().min(2),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
});

type LeaveFormValues = z.infer<typeof leaveSchema>;

export function LeaveForm() {
  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { staffName: "", leaveType: "", startDate: "", endDate: "" },
  });

  return (
    <form
      className="grid gap-3 md:grid-cols-5"
      onSubmit={form.handleSubmit((values) => toast.success(`${values.leaveType} leave request captured for ${values.staffName}`))}
    >
      <Input placeholder="Staff name" {...form.register("staffName")} />
      <Input placeholder="Leave type" {...form.register("leaveType")} />
      <Input type="date" {...form.register("startDate")} />
      <Input type="date" {...form.register("endDate")} />
      <Button type="submit">New Leave Request</Button>
    </form>
  );
}
