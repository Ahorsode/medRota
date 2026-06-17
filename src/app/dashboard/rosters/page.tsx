import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RosterStatusBadge } from "@/components/roster/RosterStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDepartments } from "@/lib/actions/departments";
import { createRoster, getRosters } from "@/lib/actions/rosters";
import { getStaff } from "@/lib/actions/staff";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { monthNames } from "@/lib/utils/dates";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RosterOverviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "doctor" || user.role === "nurse" || user.role === "staff") redirect("/dashboard/my-schedule");

  const departmentFilter = user.role === "department_head" ? user.departmentId ?? undefined : undefined;
  const userRole = user.role;
  const userDepartmentId = user.departmentId;
  const [allDepartments, rosters, staff] = await Promise.all([getDepartments(), getRosters(departmentFilter), getStaff(departmentFilter)]);
  const departments = departmentFilter ? allDepartments.filter((department) => department.id === departmentFilter) : allDepartments;

  async function addRoster(formData: FormData) {
    "use server";
    const departmentId = String(formData.get("department_id") ?? "");
    const month = Number(formData.get("month") ?? 0);
    const year = Number(formData.get("year") ?? 0);
    if (!departmentId || !month || !year) return;
    if (userRole === "department_head" && departmentId !== userDepartmentId) return;
    await createRoster({ department_id: departmentId, month, year });
  }

  return (
    <div>
      <PageHeader title="Duty Rosters" description="Create, edit, approve, publish, and export monthly duty rosters." />
      <div className="space-y-5 p-5">
        <Card>
          <CardHeader>
            <CardTitle>Create Roster</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addRoster} className="grid gap-3 md:grid-cols-4">
              <select name="department_id" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <select name="month" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" defaultValue="6">
                {monthNames.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
              <Input name="year" type="number" min={2026} defaultValue={2026} />
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Create Roster
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rosters.map((roster) => {
            const department = departments.find((item) => item.id === roster.department_id);
            return (
              <Card key={roster.id} className="transition hover:border-[#2E86AB] hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-950">{department?.name ?? "Unknown department"}</h2>
                      <p className="text-sm text-slate-500">
                        {monthNames[roster.month - 1]} {roster.year}
                      </p>
                    </div>
                    <RosterStatusBadge status={roster.status} />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-slate-500">Staff</p>
                      <p className="font-mono text-xl font-extrabold">{staff.filter((person) => person.department_id === roster.department_id).length}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-slate-500">Entries</p>
                      <p className="font-mono text-xl font-extrabold">{roster._count?.entries ?? 0}</p>
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
    </div>
  );
}
