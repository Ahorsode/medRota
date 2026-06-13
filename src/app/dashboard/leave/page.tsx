import { PageHeader } from "@/components/layout/PageHeader";
import { LeaveCalendar } from "@/components/leave/LeaveCalendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDepartments } from "@/lib/actions/departments";
import { createLeaveRequest, getLeaveRequests, reviewLeaveRequest } from "@/lib/actions/leave";
import { getStaff } from "@/lib/actions/staff";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const [staff, departments, leaves] = await Promise.all([getStaff(), getDepartments(), getLeaveRequests()]);

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

  async function review(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "pending");
    if (!id || (status !== "approved" && status !== "rejected")) return;
    await reviewLeaveRequest(id, status);
  }

  return (
    <div>
      <PageHeader title="Leave Management" description="Capture, approve, reject, and visualize staff leave blocks." />
      <div className="space-y-5 p-5">
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
        <Card>
          <CardHeader>
            <CardTitle>All Leaves</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.map((leave) => {
                  const person = staff.find((item) => item.id === leave.staff_id);
                  const department = departments.find((item) => item.id === person?.department_id);
                  return (
                    <TableRow key={leave.id}>
                      <TableCell className="font-bold text-slate-950">{person?.full_name}</TableCell>
                      <TableCell>{department?.name}</TableCell>
                      <TableCell>{leave.leave_type}</TableCell>
                      <TableCell>{leave.start_date}</TableCell>
                      <TableCell>{leave.end_date}</TableCell>
                      <TableCell>
                        <Badge variant={leave.status === "approved" ? "success" : leave.status === "pending" ? "warning" : "danger"}>{leave.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={review} className="inline-flex gap-2">
                          <input type="hidden" name="id" value={leave.id} />
                          <Button size="sm" variant="outline" name="status" value="approved" type="submit">
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" name="status" value="rejected" type="submit">
                            Reject
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Leave Calendar · June 2026</CardTitle>
          </CardHeader>
          <CardContent>
            <LeaveCalendar leaves={leaves} staff={staff} year={2026} month={6} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
