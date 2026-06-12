import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RosterStatusBadge } from "@/components/roster/RosterStatusBadge";
import { departments, leaveRequests, rosterEntries, rosters, staff } from "@/lib/data/mock";
import { monthlyShiftTotals } from "@/lib/utils/shifts";

export default function DashboardPage() {
  const activeStaff = staff.filter((person) => person.is_active);
  const pendingLeaves = leaveRequests.filter((leave) => leave.status === "pending");
  const todaysEntries = rosterEntries.filter((entry) => entry.shift_date === "2026-06-12");
  const todayTotals = monthlyShiftTotals(todaysEntries);

  return (
    <div>
      <PageHeader
        title="Hospital Operations Dashboard"
        description="Live workforce overview for SDA Hospital, Koforidua."
        actions={
          <Button asChild>
            <Link href="/dashboard/rosters/opd/2026/6">Open OPD Roster</Link>
          </Button>
        }
      />
      <div className="grid gap-5 p-5 lg:grid-cols-4">
        <MetricCard icon={Users} label="Total Active Staff" value={activeStaff.length} detail="Across 9 departments" />
        <MetricCard icon={Building2} label="Departments" value={departments.length} detail="All active" />
        <MetricCard icon={CalendarClock} label="Pending Leave Requests" value={pendingLeaves.length} detail="Needs supervisor review" warning={pendingLeaves.length > 0} />
        <MetricCard icon={AlertTriangle} label="Unassigned Shifts" value={0} detail="Current month coverage complete" />
      </div>
      <div className="grid gap-5 px-5 pb-5 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Shift Coverage</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              ["Morning", todayTotals.M, "bg-blue-100 text-blue-700"],
              ["Afternoon", todayTotals.A, "bg-amber-100 text-amber-700"],
              ["Night", todayTotals.N, "bg-indigo-100 text-indigo-700"],
            ].map(([label, count, className]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <span className="font-semibold">{label}</span>
                <span className={`rounded-md px-3 py-1 font-mono font-bold ${className}`}>{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly Roster Status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {rosters.map((roster) => (
              <Link key={roster.id} href={`/dashboard/rosters/${roster.department_id}/${roster.year}/${roster.month}`} className="rounded-lg border border-slate-200 p-4 transition hover:border-[#2E86AB] hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{departments.find((department) => department.id === roster.department_id)?.name}</p>
                    <p className="text-sm text-slate-500">June 2026</p>
                  </div>
                  <RosterStatusBadge status={roster.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  warning,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  detail: string;
  warning?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#A8DADC]/60 text-[#1A2B4A]">
            <Icon className="h-5 w-5" />
          </div>
          {warning ? <Badge variant="warning">Action</Badge> : null}
        </div>
        <p className="mt-5 text-sm font-semibold text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-extrabold text-slate-950">{value}</p>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}
