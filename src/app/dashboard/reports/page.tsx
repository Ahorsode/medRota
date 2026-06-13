import { Download, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportsCharts } from "@/components/reports/ReportsCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDepartments } from "@/lib/actions/departments";
import { getLeaveRequests } from "@/lib/actions/leave";
import { getRosterEntries } from "@/lib/actions/rosters";
import { getStaff } from "@/lib/actions/staff";

export const dynamic = "force-dynamic";

const leaveColors: Record<string, string> = {
  Annual: "#7C3AED",
  Study: "#2E86AB",
  Sick: "#F59E0B",
  Maternity: "#10B981",
  Paternity: "#A8DADC",
  Compassionate: "#EF4444",
  Emergency: "#D97706",
};

export default async function ReportsPage() {
  const startDate = "2026-06-01";
  const endDate = "2026-06-30";
  const [departments, staff, rosterEntries, leaveRequests] = await Promise.all([
    getDepartments(),
    getStaff(),
    getRosterEntries(startDate, endDate),
    getLeaveRequests(),
  ]);

  const staffing = departments.map((department) => {
    const staffIds = new Set(staff.filter((person) => person.department_id === department.id).map((person) => person.id));
    const entries = rosterEntries.filter((entry) => entry.staff_id && staffIds.has(entry.staff_id));
    return {
      department: department.name.length > 16 ? `${department.name.slice(0, 16)}...` : department.name,
      Morning: entries.filter((entry) => entry.shift_code === "M").length,
      Afternoon: entries.filter((entry) => entry.shift_code === "A").length,
      Night: entries.filter((entry) => entry.shift_code === "N").length,
    };
  });

  const absenteeism = [1, 2, 3, 4, 5].map((week) => ({
    week: `Week ${week}`,
    leave: rosterEntries.filter((entry) => entry.shift_code === "LEAVE" && Math.ceil(Number(entry.shift_date.slice(-2)) / 7) === week).length,
  }));

  const leave = Object.entries(
    leaveRequests.reduce<Record<string, number>>((totals, request) => {
      totals[request.leave_type] = (totals[request.leave_type] ?? 0) + 1;
      return totals;
    }, {}),
  ).map(([name, value]) => ({ name, value, color: leaveColors[name] }));

  const nightFairness = staff
    .map((person) => ({
      name: person.full_name,
      nights: rosterEntries.filter((entry) => entry.staff_id === person.id && entry.shift_code === "N").length,
    }))
    .filter((item) => item.nights > 0);

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Staffing, absenteeism, overtime, leave, fairness, and coverage reports."
        actions={
          <>
            <Button variant="outline">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </>
        }
      />
      <div className="space-y-5 p-5">
        <Card>
          <CardContent className="grid gap-3 p-5 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 px-3 py-2 text-sm">{startDate}</div>
            <div className="rounded-md border border-slate-200 px-3 py-2 text-sm">{endDate}</div>
            <div className="rounded-md border border-slate-200 px-3 py-2 text-sm">All departments</div>
          </CardContent>
        </Card>
        <ReportsCharts staffing={staffing} absenteeism={absenteeism} leave={leave} nightFairness={nightFairness} />
      </div>
    </div>
  );
}
