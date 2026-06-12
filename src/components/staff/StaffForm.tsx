"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const staffSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  staffNumber: z.string().min(2, "Staff number is required"),
  rank: z.string().min(1, "Rank is required"),
});

type StaffFormValues = z.infer<typeof staffSchema>;

export function StaffForm() {
  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { fullName: "", staffNumber: "", rank: "" },
  });

  return (
    <form
      className="grid gap-3 sm:grid-cols-4"
      onSubmit={form.handleSubmit((values) => toast.success(`${values.fullName} is ready to add once Supabase is connected`))}
    >
      <Input placeholder="Full name" {...form.register("fullName")} />
      <Input placeholder="Staff number" {...form.register("staffNumber")} />
      <Input placeholder="Rank" {...form.register("rank")} />
      <Button type="submit">Add Staff</Button>
    </form>
  );
}
