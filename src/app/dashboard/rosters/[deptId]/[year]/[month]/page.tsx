import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RosterWorkspace } from "@/components/roster/RosterWorkspace";
import { Button } from "@/components/ui/button";
import { getDepartments } from "@/lib/actions/departments";
import { getRosterWithEntries, getShiftConfigurations } from "@/lib/actions/rosters";
import { getStaff } from "@/lib/actions/staff";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { monthNames } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export default async function RosterEditorPage({
  params,
}: {
  params: Promise<{ deptId: string; year: string; month: string }>;
}) {
  const { deptId, year, month } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "doctor" || user.role === "nurse" || user.role === "staff") redirect("/dashboard/my-schedule");
  if (user.role === "department_head" && user.departmentId !== deptId) notFound();

  const numericYear = Number(year);
  const numericMonth = Number(month);
  const [departments, rosterData, staff, shiftConfigurations] = await Promise.all([
    getDepartments(),
    getRosterWithEntries(deptId, numericYear, numericMonth),
    getStaff(deptId),
    getShiftConfigurations(deptId),
  ]);
  const department = departments.find((item) => item.id === deptId);

  if (!department || !rosterData.roster) notFound();

  return (
    <div>
      <PageHeader
        title={`${department.name} Duty Roster`}
        description={`${monthNames[numericMonth - 1]} ${numericYear} · digital grid for SDA Hospital coverage.`}
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/rosters">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />
      <RosterWorkspace
        roster={rosterData.roster}
        department={department}
        initialEntries={rosterData.entries}
        staff={staff}
        shiftConfigurations={shiftConfigurations}
        currentUser={user}
      />
    </div>
  );
}
