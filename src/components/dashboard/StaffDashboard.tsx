import Link from "next/link";
import { Banknote, CalendarDays, CalendarOff, ClipboardList, Clock, UserCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LeaveStatusBadge } from "@/components/staff/LeaveStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAttendanceRecords } from "@/lib/actions/attendance";
import { getLeaveRequests } from "@/lib/actions/leave";
import { getShiftAllowanceSummary } from "@/lib/actions/payroll";
import { getRosterEntriesForStaff } from "@/lib/actions/rosters";
import { getShiftSwapsForStaff } from "@/lib/actions/swaps";
import type { SessionUser } from "@/lib/auth/getSessionUser";
import { monthNames } from "@/lib/utils/dates";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftHours(code?: string | null) {
  const hours: Record<string, string> = {
    M: "07:30 - 14:00",
    A: "14:00 - 20:30",
    N: "20:30 - 07:30",
    O: "",
    LEAVE: "",
  };

  return code ? hours[code] ?? "" : "";
}

export async function StaffDashboard({ user }: { user: SessionUser }) {
  const staffRecord = user.staffRecord;

  if (!staffRecord) {
    return (
      <div>
        <PageHeader title="My Dashboard" description="No staff record is linked to this login yet." />
        <div className="p-5">
          <Card>
            <CardContent className="p-5 text-sm text-slate-500">Ask HR to link your MedRota user account to a staff profile.</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const today = isoDate(now);

  const [entries, leaves, swaps, attendance, allowance] = await Promise.all([
    getRosterEntriesForStaff(staffRecord.id, year, month),
    getLeaveRequests(staffRecord.id),
    getShiftSwapsForStaff(staffRecord.id),
    getAttendanceRecords(staffRecord.id),
    getShiftAllowanceSummary(staffRecord.id, year, month),
  ]);

  const todayEntry = entries.find((entry) => entry.shift_date === today);
  const workingShifts = entries.filter((entry) => ["M", "A", "N"].includes(entry.shift_code)).length;
  const daysOff = entries.filter((entry) => entry.shift_code === "O" || entry.shift_code === "%").length;
  const approvedLeaves = leaves.filter((leave) => leave.status === "approved").length;
  const pendingRequests = leaves.filter((leave) => leave.status === "pending_hod" || leave.status === "pending_hr").length + swaps.filter((swap) => swap.status === "pending").length;
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() + index);
    const iso = isoDate(date);
    return {
      iso,
      label: date.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase(),
      entry: entries.find((entry) => entry.shift_date === iso),
    };
  });

  return (
    <div>
      <PageHeader
        title="My Dashboard"
        description={`Your roster, leave, attendance, and allowance snapshot for ${monthNames[month - 1]} ${year}.`}
        actions={
          <Button asChild>
            <Link href="/dashboard/my-leave">Request Leave</Link>
          </Button>
        }
      />
      <div className="space-y-5 p-5">
        <section className="rounded-lg border border-slate-200 bg-[#1A2B4A] p-5 text-white shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#A8DADC] text-[#1A2B4A]">
                <UserCircle className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold">{staffRecord.full_name}</h2>
                <p className="text-sm text-white/75">
                  {staffRecord.rank ?? staffRecord.position ?? "Staff"} · {staffRecord.department_name}
                </p>
                <p className="mt-1 text-sm text-white/75">
                  Staff No. {staffRecord.staff_number || "Unassigned"} · {staffRecord.employment_type ?? "Employment type not set"}
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-white/10 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-[#A8DADC]">Today</p>
              <p className="mt-1 text-lg font-extrabold">{todayEntry ? `${todayEntry.shift_code} shift` : "No rostered shift"}</p>
              <p className="text-sm text-white/70">{shiftHours(todayEntry?.shift_code) || "Rest or leave day"}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric icon={CalendarDays} label="Shifts This Month" value={workingShifts} />
          <Metric icon={CalendarOff} label="Days Off This Month" value={daysOff} />
          <Metric icon={ClipboardList} label="Leave Balance" value={Math.max(30 - approvedLeaves, 0)} />
          <Metric icon={Clock} label="Pending Requests" value={pendingRequests} />
          <Metric icon={Banknote} label="Allowances" value={allowance.total} detail="GHS estimate" />
        </div>

        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-extrabold text-slate-950">This Week&apos;s Schedule</h2>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/my-schedule">Open Month</Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {weekDays.map((day) => (
                <div key={day.iso} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-xs font-bold text-slate-500">{day.label}</p>
                  <Badge className="mt-2" variant={day.entry?.shift_code === "N" ? "purple" : day.entry?.shift_code === "A" ? "warning" : day.entry?.shift_code === "M" ? "blue" : "default"}>
                    {day.entry?.shift_code ?? "O"}
                  </Badge>
                  <p className="mt-2 min-h-4 text-xs text-slate-500">{shiftHours(day.entry?.shift_code)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardContent className="p-5">
              <h2 className="font-extrabold text-slate-950">Recent Notifications</h2>
              <div className="mt-4 grid gap-3">
                {leaves.slice(0, 2).map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-bold text-slate-950">{leave.leave_type}</p>
                      <p className="text-xs text-slate-500">
                        {leave.start_date} to {leave.end_date}
                      </p>
                    </div>
                    <LeaveStatusBadge status={leave.status} />
                  </div>
                ))}
                {leaves.length === 0 ? <p className="text-sm text-slate-500">No leave notifications yet.</p> : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="font-extrabold text-slate-950">Attendance This Month</h2>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {["present", "absent", "late"].map((status) => (
                  <div key={status} className="rounded-lg bg-slate-50 p-3">
                    <p className="font-mono text-2xl font-extrabold text-slate-950">{attendance.filter((record) => record.status === status).length}</p>
                    <p className="text-xs capitalize text-slate-500">{status}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: number; detail?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <Icon className="h-5 w-5 text-[#2E86AB]" />
        <p className="mt-4 text-sm font-semibold text-slate-500">{label}</p>
        <p className="mt-1 font-mono text-3xl font-extrabold text-slate-950">{value}</p>
        {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}
