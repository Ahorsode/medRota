import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RosterWorkspace } from "@/components/roster/RosterWorkspace";
import { Button } from "@/components/ui/button";
import { departments, rosterEntries, rosters, shiftConfigurations, staff } from "@/lib/data/mock";
import { monthNames } from "@/lib/utils/dates";

export default async function RosterEditorPage({
  params,
}: {
  params: Promise<{ deptId: string; year: string; month: string }>;
}) {
  const { deptId, year, month } = await params;
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const department = departments.find((item) => item.id === deptId);
  const roster =
    rosters.find((item) => item.department_id === deptId && item.year === numericYear && item.month === numericMonth) ??
    (department
      ? {
          id: `roster-${deptId}-${numericYear}-${numericMonth}`,
          department_id: deptId,
          month: numericMonth,
          year: numericYear,
          status: "draft" as const,
          created_by: null,
          approved_by: null,
          created_at: new Date().toISOString(),
          published_at: null,
        }
      : null);

  if (!department || !roster) notFound();

  const entries = rosterEntries.filter((entry) => entry.roster_id === roster.id);

  return (
    <div>
      <PageHeader
        title={`${department.name} Duty Roster`}
        description={`${monthNames[numericMonth - 1]} ${numericYear} · premium digital grid inspired by the SDA paper roster.`}
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
        roster={roster}
        department={department}
        initialEntries={entries}
        staff={staff}
        shiftConfigurations={shiftConfigurations}
      />
    </div>
  );
}
