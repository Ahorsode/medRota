import { PageHeader } from "@/components/layout/PageHeader";
import { StaffForm } from "@/components/staff/StaffForm";
import { StaffTable } from "@/components/staff/StaffTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStaff } from "@/lib/actions/staff";
import { getDepartments } from "@/lib/actions/departments";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "doctor" || user.role === "nurse" || user.role === "staff") redirect("/dashboard/my-profile");

  const isHod = user.role === "department_head";
  const canManageStaff = user.role === "admin" || user.role === "hr_officer";
  const departmentFilter = isHod ? user.departmentId ?? undefined : undefined;
  const [staff, allDepartments] = await Promise.all([getStaff(departmentFilter), getDepartments()]);
  const departments = departmentFilter ? allDepartments.filter((department) => department.id === departmentFilter) : allDepartments;

  return (
    <div>
      <PageHeader title="Staff Management" description="Search, filter, add, edit, and deactivate hospital staff." />
      <div className="space-y-5 p-5">
        {canManageStaff ? (
          <Card>
            <CardHeader>
              <CardTitle>Quick Add</CardTitle>
            </CardHeader>
            <CardContent>
              <StaffForm departments={departments} />
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardContent className="p-5">
            <StaffTable staff={staff} departments={departments} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
