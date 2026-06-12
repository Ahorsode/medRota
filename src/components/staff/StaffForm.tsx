"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Department, Staff } from "@/lib/types";

const staffSchema = z.object({
  full_name: z.string().min(2, "Name is required"),
  staff_number: z.string().min(2, "Staff number is required"),
  rank: z.string().min(1, "Rank is required"),
  position: z.string().min(2, "Position is required"),
  department_id: z.string().min(1, "Department is required"),
  employment_type: z.string().min(1, "Employment type is required"),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
});

type StaffFormValues = z.infer<typeof staffSchema>;

export function StaffForm({
  departments,
  onAdd,
}: {
  departments: Department[];
  onAdd: (staff: Staff) => void;
}) {
  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      full_name: "",
      staff_number: "",
      rank: "",
      position: "",
      department_id: departments[0]?.id ?? "",
      employment_type: "Full-time",
      phone: "",
      email: "",
    },
  });

  return (
    <form
      className="grid gap-3 md:grid-cols-4"
      onSubmit={form.handleSubmit((values) => {
        const newStaff: Staff = {
          id: `staff-${values.staff_number.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          hospital_id: departments.find((department) => department.id === values.department_id)?.hospital_id ?? "",
          department_id: values.department_id,
          user_id: null,
          staff_number: values.staff_number,
          full_name: values.full_name,
          rank: values.rank,
          position: values.position,
          employment_type: values.employment_type,
          phone: values.phone || null,
          email: values.email || null,
          is_active: true,
          created_at: "2026-06-12T00:00:00.000Z",
        };
        onAdd(newStaff);
        form.reset();
        toast.success("Staff member added");
      })}
    >
      <Input placeholder="Full name" {...form.register("full_name")} />
      <Input placeholder="Staff number" {...form.register("staff_number")} />
      <Input placeholder="Rank" {...form.register("rank")} />
      <Input placeholder="Position" {...form.register("position")} />
      <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" {...form.register("department_id")}>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
      <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" {...form.register("employment_type")}>
        <option>Full-time</option>
        <option>Part-time</option>
        <option>Locum</option>
      </select>
      <Input placeholder="Phone" {...form.register("phone")} />
      <Input placeholder="Email" type="email" {...form.register("email")} />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        Add Staff
      </Button>
    </form>
  );
}
