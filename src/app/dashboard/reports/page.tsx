import { PageHeader } from "@/components/layout/PageHeader";
import { ReportsActions } from "@/components/reports/ReportsActions";
import { ReportsCharts } from "@/components/reports/ReportsCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDepartments } from "@/lib/actions/departments";
import { getLeaveRequests } from "@/lib/actions/leave";
import { getRosterEntries } from "@/lib/actions/rosters";
import { getStaff } from "@/lib/actions/staff";
import { getShiftAllowanceSummaryForDepartment } from "@/lib/actions/payroll";
import { getSessionUser, isStaffRole } from "@/lib/auth/getSessionUser";
import { monthNames } from "@/lib/utils/dates";
import { redirect } from "next/navigation";

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

function searchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; year?: string | string[] }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isStaffRole(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const requestedMonth = Number(searchValue(params.month));
  const requestedYear = Number(searchValue(params.year));
  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : now.getMonth() + 1;
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 ? requestedYear : now.getFullYear();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const periodLabel = `${monthNames[month - 1]} ${year}`;
  const departmentFilter = user.role === "department_head" ? user.departmentId ?? undefined : undefined;
  const [allDepartments, staff, rosterEntries, leaveRequests, allowance] = await Promise.all([
    getDepartments(),
    getStaff(departmentFilter),
    getRosterEntries(startDate, endDate, departmentFilter),
    getLeaveRequests(undefined, departmentFilter),
    getShiftAllowanceSummaryForDepartment(departmentFilter, year, month),
  ]);
  const departments = departmentFilter ? allDepartments.filter((department) => department.id === departmentFilter) : allDepartments;

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
          <ReportsActions
            periodLabel={periodLabel}
            fileSuffix={`${String(month).padStart(2, "0")}_${year}`}
            staffing={staffing}
            leave={leave}
            nightFairness={nightFairness}
          />
        }
      />
      <div className="space-y-5 p-5">
        <Card>
          <CardContent className="grid gap-3 p-5 md:grid-cols-4">
            <form className="flex flex-wrap items-center gap-2 md:col-span-2">
              <select name="month" defaultValue={month} aria-label="Month" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                {monthNames.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <input name="year" type="number" min={2024} defaultValue={year} aria-label="Year" className="h-10 w-24 rounded-md border border-slate-200 px-3 text-sm" />
              <Button type="submit" variant="outline">
                Apply
              </Button>
              <span className="text-xs text-slate-500">
                {startDate} to {endDate}
              </span>
            </form>
            <div className="rounded-md border border-slate-200 px-3 py-2 text-sm">{departmentFilter ? departments[0]?.name ?? "Department" : "All departments"}</div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              Shift allowance ({periodLabel}): GHS {allowance.total.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <ReportsCharts staffing={staffing} absenteeism={absenteeism} leave={leave} nightFairness={nightFairness} />
      </div>
    </div>
  );
}
