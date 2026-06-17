import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, Clock, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RosterStatusBadge } from "@/components/roster/RosterStatusBadge";
import { getDepartments } from "@/lib/actions/departments";
import { getLeaveRequests } from "@/lib/actions/leave";
import { getRosters } from "@/lib/actions/rosters";
import { getRecentLoginSessions } from "@/lib/actions/sessions";
import { getStaff } from "@/lib/actions/staff";
import type { SessionUser } from "@/lib/auth/getSessionUser";
import { monthNames } from "@/lib/utils/dates";

export async function HRDashboard({ user }: { user: SessionUser }) {
  const [staff, departments, leaveRequests, rosters, recentLogins] = await Promise.all([
    getStaff(),
    getDepartments(),
    getLeaveRequests(),
    getRosters(),
    getRecentLoginSessions(),
  ]);
  const pendingLeaves = leaveRequests.filter((leave) => leave.status === "pending_hod" || leave.status === "pending_hr");

  return (
    <div>
      <PageHeader
        title="Hospital Operations Dashboard"
        description={`Live workforce overview for SDA Hospital, Koforidua. Signed in as ${user.role.replace("_", " ")}.`}
        actions={
          <Button asChild>
            <Link href="/dashboard/rosters">Open Rosters</Link>
          </Button>
        }
      />
      <div className="grid gap-5 p-5 lg:grid-cols-4">
        <MetricCard icon={Users} label="Total Active Staff" value={staff.length} detail="Across all departments and units" />
        <MetricCard icon={Building2} label="Departments" value={departments.length} detail="Including units and clinics" />
        <MetricCard icon={CalendarClock} label="Pending Leave Requests" value={pendingLeaves.length} detail="Needs HOD or HR review" warning={pendingLeaves.length > 0} />
        <MetricCard icon={AlertTriangle} label="Published Rosters" value={rosters.filter((roster) => roster.status === "published").length} detail="Ready for staff access" />
      </div>
      <div className="grid gap-5 px-5 pb-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Roster Status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {rosters.length > 0 ? (
              rosters.slice(0, 8).map((roster) => {
                const department = departments.find((item) => item.id === roster.department_id);
                return (
                  <Link
                    key={roster.id}
                    href={`/dashboard/rosters/${roster.department_id}/${roster.year}/${roster.month}`}
                    className="rounded-lg border border-slate-200 p-4 transition hover:border-[#2E86AB] hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">{department?.name ?? "Unknown department"}</p>
                        <p className="text-sm text-slate-500">
                          {monthNames[roster.month - 1]} {roster.year}
                        </p>
                      </div>
                      <RosterStatusBadge status={roster.status} />
                    </div>
                  </Link>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">No rosters have been created yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Logins</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {recentLogins.length > 0 ? (
              recentLogins.map((session) => (
                <div key={session.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="font-bold text-slate-950">{session.staff?.full_name ?? session.user_id}</p>
                    <p className="text-xs text-slate-500">{new Date(session.login_at).toLocaleString()}</p>
                  </div>
                  <Badge variant={session.logout_at ? "default" : "success"}>
                    <Clock className="mr-1 h-3 w-3" />
                    {session.duration_minutes ?? 0}m
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No login sessions recorded yet.</p>
            )}
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
