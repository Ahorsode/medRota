"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { RosterStatusBadge } from "@/components/roster/RosterStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { departments, rosters as initialRosters, staff } from "@/lib/data/mock";
import type { Roster } from "@/lib/types";

export default function RosterOverviewPage() {
  const router = useRouter();
  const [rosters, setRosters] = useState(initialRosters);
  const [open, setOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [month, setMonth] = useState("6");
  const [year, setYear] = useState("2026");

  function handleCreateRoster() {
    const numericMonth = Number(month);
    const numericYear = Number(year);
    const exists = rosters.some((roster) => roster.department_id === departmentId && roster.month === numericMonth && roster.year === numericYear);

    if (exists) {
      toast.error("A roster already exists for that department and month");
      return;
    }

    const roster: Roster = {
      id: `roster-${departmentId}-${numericYear}-${numericMonth}`,
      department_id: departmentId,
      month: numericMonth,
      year: numericYear,
      status: "draft",
      created_by: null,
      approved_by: null,
      created_at: "2026-06-12T00:00:00.000Z",
      published_at: null,
    };

    setRosters((current) => [roster, ...current]);
    setOpen(false);
    toast.success("Roster created");
    router.push(`/dashboard/rosters/${departmentId}/${numericYear}/${numericMonth}`);
  }

  return (
    <div>
      <PageHeader
        title="Duty Rosters"
        description="Create, edit, approve, publish, and export monthly duty rosters."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Roster
          </Button>
        }
      />
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-2xl">
            <Dialog.Title className="text-lg font-extrabold text-slate-950">Create Roster</Dialog.Title>
            <div className="mt-4 space-y-3">
              <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
              <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={month} onChange={(event) => setMonth(event.target.value)}>
                {Array.from({ length: 12 }).map((_, index) => (
                  <option key={index + 1} value={index + 1}>{index + 1}</option>
                ))}
              </select>
              <Input type="number" min={2026} value={year} onChange={(event) => setYear(event.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateRoster}>Create</Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        {rosters.map((roster) => {
          const department = departments.find((item) => item.id === roster.department_id);
          return (
            <Card key={roster.id} className="transition hover:border-[#2E86AB] hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-950">{department?.name}</h2>
                    <p className="text-sm text-slate-500">June 2026</p>
                  </div>
                  <RosterStatusBadge status={roster.status} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Staff</p>
                    <p className="font-mono text-xl font-extrabold">{staff.filter((person) => person.department_id === roster.department_id).length}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Unassigned</p>
                    <p className="font-mono text-xl font-extrabold">0</p>
                  </div>
                </div>
                <Button asChild className="mt-5 w-full" variant="navy">
                  <Link href={`/dashboard/rosters/${roster.department_id}/${roster.year}/${roster.month}`}>Open Editor</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
