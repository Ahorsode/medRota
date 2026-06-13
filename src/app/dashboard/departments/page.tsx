import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RosterStatusBadge } from "@/components/roster/RosterStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createDepartment, getDepartments } from "@/lib/actions/departments";
import { getRosters } from "@/lib/actions/rosters";
import { getStaff } from "@/lib/actions/staff";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const [departments, rosters, staff] = await Promise.all([getDepartments(), getRosters(), getStaff()]);
  const locumStaff = staff.filter((person) => person.employment_type === "Locum");
  const hospitalId = departments.find((department) => department.hospital_id)?.hospital_id ?? "";

  async function addDepartment(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "");
    const hospital_id = String(formData.get("hospital_id") ?? "");
    if (!name || !hospital_id) return;
    await createDepartment({
      hospital_id,
      name,
      description: String(formData.get("description") ?? "") || undefined,
      department_type: String(formData.get("department_type") ?? "department"),
      parent_id: String(formData.get("parent_id") ?? "") || undefined,
    });
  }

  return (
    <div>
      <PageHeader title="Department Management" description="Manage departments, units, special clinics, and locum coverage." />
      <div className="space-y-5 p-5">
        <Card>
          <CardHeader>
            <CardTitle>Create Department or Unit</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addDepartment} className="grid gap-3 md:grid-cols-5">
              <input type="hidden" name="hospital_id" value={hospitalId} />
              <input name="name" className="h-10 rounded-md border border-slate-200 px-3 text-sm md:col-span-2" placeholder="Name" required />
              <input name="description" className="h-10 rounded-md border border-slate-200 px-3 text-sm md:col-span-3" placeholder="Description" />
              <select name="department_type" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="department">Department</option>
                <option value="unit">Unit</option>
                <option value="special_clinic">Special clinic</option>
                <option value="autonomous_centre">Autonomous centre</option>
              </select>
              <select name="parent_id" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm md:col-span-3" defaultValue="">
                <option value="">No parent</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={!hospitalId}>
                <Plus className="h-4 w-4" />
                Create
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                    <Badge variant={department.department_type === "department" ? "success" : "blue"}>{department.department_type.replace("_", " ")}</Badge>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm text-slate-500">{department._count?.staff ?? staff.filter((person) => person.department_id === department.id).length} staff</span>
                    {roster ? <RosterStatusBadge status={roster.status} /> : <Badge>No roster</Badge>}
                  </div>
                  <Button asChild className="mt-4" size="sm" variant="outline">
                    <Link href={`/dashboard/rosters/${department.id}/2026/6`}>Open Roster</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Locum Pool</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {locumStaff.length > 0 ? (
              locumStaff.map((person) => (
                <div key={person.id} className="rounded-lg border border-dashed border-rose-300 bg-rose-50/40 p-4">
                  <p className="font-bold text-slate-950">{person.full_name}</p>
                  <p className="text-sm text-slate-500">{person.position ?? person.rank}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No locum staff recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
