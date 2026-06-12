"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { RosterStatusBadge } from "@/components/roster/RosterStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { departments as initialDepartments, hospital, rosters, staff } from "@/lib/data/mock";
import type { Department } from "@/lib/types";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState(initialDepartments);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleCreateDepartment() {
    if (!name.trim()) return;

    const department: Department = {
      id: `department-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      hospital_id: hospital.id,
      name: name.trim(),
      description: description.trim() || null,
      is_active: true,
      created_at: "2026-06-12T00:00:00.000Z",
    };

    setDepartments((current) => [department, ...current]);
    setName("");
    setDescription("");
    setOpen(false);
    toast.success("Department created");
  }

  return (
    <div>
      <PageHeader
        title="Department Management"
        description="Manage clinical and operational units that publish duty rosters."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Department
          </Button>
        }
      />
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-2xl">
            <Dialog.Title className="text-lg font-extrabold text-slate-950">Create Department</Dialog.Title>
            <div className="mt-4 space-y-3">
              <Input placeholder="Department name" value={name} onChange={(event) => setName(event.target.value)} />
              <Input placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateDepartment}>Create</Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        {departments.map((department) => {
          const roster = rosters.find((item) => item.department_id === department.id);
          return (
            <Card key={department.id} className="transition hover:border-[#2E86AB] hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-extrabold text-slate-950">{department.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{department.description}</p>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm text-slate-500">{staff.filter((person) => person.department_id === department.id).length} staff</span>
                  {roster ? <RosterStatusBadge status={roster.status} /> : <Badge>No roster</Badge>}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/rosters/${department.id}/2026/6`}>Open Roster</Link>
                  </Button>
                  <Button size="sm" variant="ghost">Edit</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
