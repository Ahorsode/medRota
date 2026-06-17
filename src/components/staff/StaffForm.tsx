"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createStaff } from "@/lib/actions/staff";
import type { Department, Staff } from "@/lib/types";

const staffSchema = z.object({
  full_name: z.string().min(2, "Name is required"),
  staff_number: z.string().min(2, "Staff number is required"),
  rank: z.string().min(1, "Rank is required"),
  position: z.string().min(2, "Position is required"),
  department_id: z.string().min(1, "Department is required"),
  employment_type: z.string().min(1, "Employment type is required"),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email"),
  role: z.enum(["staff", "doctor", "nurse", "department_head", "hr_officer", "medical_director", "admin"]),
});

type StaffFormValues = z.infer<typeof staffSchema>;

export function StaffForm({
  departments,
  onAdd,
}: {
  departments: Department[];
  onAdd?: (staff: Staff) => void;
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
      role: "staff",
    },
  });

  return (
    <form
      className="grid gap-3 md:grid-cols-4"
      onSubmit={form.handleSubmit(async (values) => {
        const result = await createStaff({
          department_id: values.department_id,
          full_name: values.full_name,
          staff_number: values.staff_number,
          rank: values.rank,
          position: values.position,
          employment_type: values.employment_type,
          phone: values.phone || undefined,
          email: values.email,
          role: values.role,
        });

        if ("error" in result) {
          toast.error(result.error);
          return;
        }

        onAdd?.(result);
        form.reset({
          full_name: "",
          staff_number: "",
          rank: "",
          position: "",
          department_id: departments[0]?.id ?? "",
          employment_type: "Full-time",
          phone: "",
          email: "",
          role: "staff",
        });
        toast.success(
          `${result.full_name} added. Login email: ${values.email} - Temporary password: ${values.staff_number}`,
          { duration: 10000 },
        );
      })}
    >
      <Input aria-label="Full name" placeholder="Full name" {...form.register("full_name")} />
      <Input aria-label="Staff number" placeholder="Staff number" {...form.register("staff_number")} />
      <Input aria-label="Rank" placeholder="Rank" {...form.register("rank")} />
      <Input aria-label="Position" placeholder="Position" {...form.register("position")} />
      <select aria-label="Department" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" {...form.register("department_id")}>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
      <select aria-label="Employment type" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" {...form.register("employment_type")}>
        <option>Full-time</option>
        <option>Part-time</option>
        <option>Locum</option>
      </select>
      <Input aria-label="Phone" placeholder="Phone" {...form.register("phone")} />
      <Input aria-label="Email" placeholder="Email" type="email" {...form.register("email")} />
      <select aria-label="System role" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm md:col-span-2" {...form.register("role")}>
        <option value="staff">Staff</option>
        <option value="doctor">Doctor</option>
        <option value="nurse">Nurse</option>
        <option value="department_head">Department Head</option>
        <option value="hr_officer">HR Officer</option>
        <option value="medical_director">Medical Director</option>
        <option value="admin">Administrator</option>
      </select>
      {Object.values(form.formState.errors)[0]?.message ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 md:col-span-4">
          {Object.values(form.formState.errors)[0]?.message}
        </p>
      ) : null}
      <Button className="md:col-span-2" type="submit" disabled={form.formState.isSubmitting}>
        Add Staff
      </Button>
    </form>
  );
}
