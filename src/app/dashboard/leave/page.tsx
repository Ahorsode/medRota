import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { LeaveCalendar } from "@/components/leave/LeaveCalendar";
import { LeaveStatusBadge } from "@/components/staff/LeaveStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDepartments } from "@/lib/actions/departments";
import { createLeaveRequest, getLeaveRequests, hodReviewLeave, reviewLeaveRequest } from "@/lib/actions/leave";
import { getStaff } from "@/lib/actions/staff";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import type { LeaveRequest } from "@/lib/types";
import { monthNames } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "pending";
}

function priorityFor(role: string, leave: LeaveRequest) {
  if (role === "department_head" && leave.status === "pending_hod") return 0;
  if ((role === "admin" || role === "hr_officer") && leave.status === "pending_hr") return 0;
  if (leave.status === "pending_hod" || leave.status === "pending_hr") return 1;
  return 2;
}

export default async function LeavePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "doctor" || user.role === "nurse" || user.role === "staff") redirect("/dashboard/my-leave");

  const isHod = user.role === "department_head";
  const isHr = user.role === "admin" || user.role === "hr_officer";
  const userId = user.id;
  const departmentFilter = isHod ? user.departmentId ?? undefined : undefined;
  const [staff, departments, leaves] = await Promise.all([
    getStaff(departmentFilter),
    getDepartments(),
    getLeaveRequests(undefined, departmentFilter),
  ]);
  const orderedLeaves = [...leaves].sort((a, b) => priorityFor(user.role, a) - priorityFor(user.role, b));
  const pendingHod = leaves.filter((leave) => leave.status === "pending_hod").length;
  const pendingHr = leaves.filter((leave) => leave.status === "pending_hr").length;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  async function addLeave(formData: FormData) {
    "use server";
    const staffId = String(formData.get("staff_id") ?? "");
    if (!staffId) return;
    await createLeaveRequest({
      staff_id: staffId,
      leave_type: String(formData.get("leave_type") ?? "Annual"),
      start_date: String(formData.get("start_date") ?? ""),
      end_date: String(formData.get("end_date") ?? ""),
      reason: String(formData.get("reason") ?? "") || undefined,
    });
  }

  async function hodReview(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const decision = String(formData.get("decision") ?? "");
    if (!id || (decision !== "approve" && decision !== "reject")) return;
    await hodReviewLeave(id, decision, userId, String(formData.get("notes") ?? "") || undefined);
  }

  async function hrReview(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!id || (status !== "approved" && status !== "rejected_hr")) return;
    await reviewLeaveRequest(id, status, userId, String(formData.get("notes") ?? "") || undefined);
  }

  return (
    <div>
      <PageHeader
        title={isHod ? "Department Leave Requests" : "Leave Management"}
        description={isHod ? "Approve department leave before HR confirmation." : "Confirm HOD-approved leave and maintain the approval trail."}
      />
      <div className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-slate-500">Awaiting HOD</p>
              <p className="mt-2 font-mono text-3xl font-extrabold text-amber-700">{pendingHod}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-slate-500">Awaiting HR</p>
              <p className="mt-2 font-mono text-3xl font-extrabold text-blue-700">{pendingHr}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-slate-500">Approved</p>
              <p className="mt-2 font-mono text-3xl font-extrabold text-emerald-700">{leaves.filter((leave) => leave.status === "approved").length}</p>
            </CardContent>
          </Card>
        </div>

        {isHr ? (
          <Card>
            <CardHeader>
              <CardTitle>New Leave Request</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addLeave} className="grid gap-3 md:grid-cols-5">
                <select name="staff_id" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
                    </option>
                  ))}
                </select>
                <select name="leave_type" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                  {["Annual", "Sick", "Study", "Maternity", "Paternity", "Compassionate", "Emergency"].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <input name="start_date" type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" required />
                <input name="end_date" type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" required />
                <input name="reason" className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="Reason" />
                <Button className="md:col-span-5" type="submit">
                  New Leave Request
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{isHod ? "Department Leave Queue" : "All Leaves"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval Trail</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderedLeaves.map((leave) => {
                    const person = staff.find((item) => item.id === leave.staff_id) ?? leave.staff ?? null;
                    const department = departments.find((item) => item.id === person?.department_id);
                    const highlighted = (isHod && leave.status === "pending_hod") || (isHr && leave.status === "pending_hr");
                    return (
                      <TableRow key={leave.id} className={highlighted ? "bg-amber-50/50" : undefined}>
                        <TableCell className="font-bold text-slate-950">{person?.full_name}</TableCell>
                        <TableCell>{department?.name ?? person?.department?.name}</TableCell>
                        <TableCell>{leave.leave_type}</TableCell>
                        <TableCell>
                          <p className="text-sm text-slate-700">{leave.start_date}</p>
                          <p className="text-xs text-slate-500">to {leave.end_date}</p>
                        </TableCell>
                        <TableCell>
                          <LeaveStatusBadge status={leave.status} />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs text-slate-500">
                            <p><span className="font-semibold text-slate-700">Staff submitted</span> {formatDateTime(leave.requested_at)}</p>
                            <p>
                              <span className="font-semibold text-slate-700">HOD review</span>{" "}
                              {leave.hod_reviewed_at ? formatDateTime(leave.hod_reviewed_at) : "pending"}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-700">HR confirmation</span>{" "}
                              {leave.reviewed_at ? formatDateTime(leave.reviewed_at) : "pending"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isHod && leave.status === "pending_hod" ? (
                            <form action={hodReview} className="inline-grid min-w-48 gap-2">
                              <input type="hidden" name="id" value={leave.id} />
                              <input name="notes" className="h-8 rounded-md border border-slate-200 px-2 text-xs" placeholder="HOD notes" />
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" name="decision" value="approve" type="submit">
                                  Approve to HR
                                </Button>
                                <Button size="sm" variant="ghost" name="decision" value="reject" type="submit">
                                  Reject
                                </Button>
                              </div>
                            </form>
                          ) : null}
                          {isHr && leave.status === "pending_hr" ? (
                            <form action={hrReview} className="inline-grid min-w-48 gap-2">
                              <input type="hidden" name="id" value={leave.id} />
                              <input name="notes" className="h-8 rounded-md border border-slate-200 px-2 text-xs" placeholder="HR notes" />
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" name="status" value="approved" type="submit">
                                  Confirm
                                </Button>
                                <Button size="sm" variant="ghost" name="status" value="rejected_hr" type="submit">
                                  Reject
                                </Button>
                              </div>
                            </form>
                          ) : null}
                          {!highlighted ? <Badge>Read only</Badge> : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave Calendar - {monthNames[month - 1]} {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <LeaveCalendar leaves={leaves} staff={staff} year={year} month={month} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
