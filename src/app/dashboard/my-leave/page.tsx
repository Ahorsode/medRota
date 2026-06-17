import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { LeaveStatusBadge } from "@/components/staff/LeaveStatusBadge";
import { StaffLeaveForm } from "@/components/staff/StaffLeaveForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getLeaveRequests } from "@/lib/actions/leave";
import { getSessionUser } from "@/lib/auth/getSessionUser";

export const dynamic = "force-dynamic";

export default async function MyLeavePage() {
  const user = await getSessionUser();
  if (!user?.staffRecord) redirect("/dashboard");

  const myLeaves = await getLeaveRequests(user.staffRecord.id);
  const approvedDays = myLeaves
    .filter((leave) => leave.status === "approved")
    .reduce((total, leave) => {
      const days = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return total + days;
    }, 0);

  return (
    <div>
      <PageHeader
        title="My Leave Requests"
        description="Submit and track your leave applications."
        actions={<StaffLeaveForm staffId={user.staffRecord.id} />}
      />
      <div className="space-y-5 p-5">
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">Leave days remaining</p>
              <p className="font-mono text-3xl font-extrabold text-purple-700">{Math.max(30 - approvedDays, 0)}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Summary label="Awaiting HOD" value={myLeaves.filter((leave) => leave.status === "pending_hod").length} />
              <Summary label="Awaiting HR" value={myLeaves.filter((leave) => leave.status === "pending_hr").length} />
              <Summary label="Approved" value={myLeaves.filter((leave) => leave.status === "approved").length} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HOD Review</TableHead>
                    <TableHead>HR Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLeaves.map((leave) => {
                    const days = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    return (
                      <TableRow key={leave.id}>
                        <TableCell className="font-medium">{leave.leave_type}</TableCell>
                        <TableCell>{leave.start_date}</TableCell>
                        <TableCell>{leave.end_date}</TableCell>
                        <TableCell>{days}</TableCell>
                        <TableCell>
                          <LeaveStatusBadge status={leave.status} />
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {leave.hod_reviewed_at ? new Date(leave.hod_reviewed_at).toLocaleDateString() : "Awaiting"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {leave.reviewed_at ? new Date(leave.reviewed_at).toLocaleDateString() : leave.status === "pending_hr" ? "Awaiting HR" : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {myLeaves.length === 0 ? <p className="mt-4 text-sm text-slate-500">No leave requests yet.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="font-mono text-xl font-extrabold text-slate-950">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
