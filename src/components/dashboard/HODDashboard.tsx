import Link from "next/link";
import { AlertTriangle, ArrowRight, Banknote, CalendarCheck, CalendarClock, ClipboardList, Clock, Moon, Send, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RosterStatusBadge } from "@/components/roster/RosterStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAttendanceRecords } from "@/lib/actions/attendance";
import { getLeaveRequests } from "@/lib/actions/leave";
import { sendMessage } from "@/lib/actions/messages";
import { getShiftAllowanceSummaryForDepartment } from "@/lib/actions/payroll";
import { getRosterEntries, getRosters } from "@/lib/actions/rosters";
import { getStaff } from "@/lib/actions/staff";
import { getShiftSwaps } from "@/lib/actions/swaps";
import type { SessionUser } from "@/lib/auth/getSessionUser";
import { monthNames } from "@/lib/utils/dates";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function HODDashboard({ user }: { user: SessionUser }) {
  const now = new Date();
  const today = isoDate(now);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const departmentId = user.role === "department_head" ? user.departmentId ?? undefined : undefined;
  const [staff, leaveRequests, rosters, attendance, upcomingEntries, swaps, allowance] = await Promise.all([
    getStaff(departmentId),
    getLeaveRequests(undefined, departmentId),
    getRosters(departmentId),
    getAttendanceRecords(undefined, departmentId, today),
    getRosterEntries(today, isoDate(nextWeek), departmentId),
    getShiftSwaps(departmentId),
    getShiftAllowanceSummaryForDepartment(departmentId, now.getFullYear(), now.getMonth() + 1),
  ]);

  const pendingHodLeaves = leaveRequests.filter((leave) => leave.status === "pending_hod");
  const pendingHrLeaves = leaveRequests.filter((leave) => leave.status === "pending_hr");
  const onDutyToday = upcomingEntries.filter((entry) => entry.shift_date === today && ["M", "A", "N"].includes(entry.shift_code)).length;
  const onLeaveToday = upcomingEntries.filter((entry) => entry.shift_date === today && entry.shift_code === "LEAVE").length;
  const absentToday = attendance.filter((record) => record.status === "absent").length;
  const pendingSwaps = swaps.filter((swap) => swap.status === "pending").length;
  const currentRoster = rosters.find((roster) => roster.month === now.getMonth() + 1 && roster.year === now.getFullYear());
  const upcomingNightShifts = upcomingEntries.filter((entry) => entry.shift_code === "N").slice(0, 6);
  const scopeLabel = user.role === "medical_director" ? "Hospital-wide director view" : user.staffRecord?.department_name ?? "My Department";

  async function broadcast(formData: FormData) {
    "use server";

    const senderId = user.staffRecord?.id;
    const body = String(formData.get("body") ?? "");
    if (!senderId || !body.trim()) return;

    const recipients = await getStaff(departmentId);
    await sendMessage({
      sender_id: senderId,
      subject: String(formData.get("subject") ?? "") || "Department broadcast",
      body,
      recipient_ids: recipients.map((person) => person.id),
      message_type: departmentId ? "department" : "broadcast",
      department_id: departmentId,
    });
  }

  return (
    <div>
      <PageHeader
        title={scopeLabel}
        description="Operational view for roster coverage, leave approvals, attendance, and department messages."
        actions={
          <Button asChild>
            <Link href="/dashboard/leave">Review Leave</Link>
          </Button>
        }
      />
      <div className="grid gap-5 p-5 lg:grid-cols-4">
        <MetricCard icon={Users} label="Active Staff" value={staff.length} detail={scopeLabel} />
        <MetricCard icon={CalendarCheck} label="On Duty Today" value={onDutyToday} detail="Morning, afternoon, and night coverage" tone="green" />
        <MetricCard icon={CalendarClock} label="On Leave Today" value={onLeaveToday} detail="Rostered leave entries" tone="purple" />
        <MetricCard icon={AlertTriangle} label="Pending HOD Leave" value={pendingHodLeaves.length} detail={`${pendingHrLeaves.length} waiting for HR`} tone="amber" />
        <MetricCard icon={ClipboardList} label="This Month's Roster" value={currentRoster ? 1 : 0} detail={currentRoster ? `${monthNames[currentRoster.month - 1]} ${currentRoster.year}` : "No roster for this month"} />
        <MetricCard icon={Clock} label="Absent Today" value={absentToday} detail="Marked absent in attendance" tone="red" />
        <MetricCard icon={ArrowRight} label="Pending Swaps" value={pendingSwaps} detail="Shift swap requests requiring review" />
        <MetricCard icon={Banknote} label="Dept Allowances" value={allowance.total} detail="Estimated GHS this month" tone="green" />
      </div>

      <div className="grid gap-5 px-5 pb-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild variant="outline" className="justify-between">
              <Link href="/dashboard/rosters">Create/Edit Roster <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="justify-between">
              <Link href="/dashboard/leave">Approve Pending Leaves <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="justify-between">
              <Link href="/dashboard/handover">Write Handover Report <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <details className="rounded-lg border border-slate-200">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">Broadcast Message to Dept</summary>
              <form action={broadcast} className="grid gap-3 p-4">
                <input name="subject" className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="Subject" />
                <textarea name="body" className="min-h-28 rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Message body" required />
                <Button type="submit" disabled={!user.staffRecord}>
                  <Send className="h-4 w-4" />
                  Send Broadcast
                </Button>
              </form>
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Night Shifts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {currentRoster ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                <div>
                  <p className="font-bold text-slate-950">Current roster</p>
                  <p className="text-sm text-slate-500">
                    {monthNames[currentRoster.month - 1]} {currentRoster.year}
                  </p>
                </div>
                <RosterStatusBadge status={currentRoster.status} />
              </div>
            ) : null}
            {upcomingNightShifts.length > 0 ? (
              upcomingNightShifts.map((entry) => {
                const person = staff.find((item) => item.id === entry.staff_id);
                return (
                  <div key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="font-bold text-slate-950">{person?.full_name ?? "Unassigned"}</p>
                      <p className="text-xs text-slate-500">{entry.shift_date}</p>
                    </div>
                    <Badge variant="purple">
                      <Moon className="mr-1 h-3 w-3" />
                      Night
                    </Badge>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">No night shifts in the next 7 days.</p>
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
  tone = "blue",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  detail: string;
  tone?: "blue" | "green" | "purple" | "amber" | "red";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  }[tone];

  return (
    <Card>
      <CardContent className="p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-5 text-sm font-semibold text-slate-500">{label}</p>
        <p className="mt-1 font-mono text-3xl font-extrabold text-slate-950">{value}</p>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}
