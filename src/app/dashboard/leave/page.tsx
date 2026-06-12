import { PageHeader } from "@/components/layout/PageHeader";
import { LeaveCalendar } from "@/components/leave/LeaveCalendar";
import { LeaveForm } from "@/components/leave/LeaveForm";
import { LeaveTable } from "@/components/leave/LeaveTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { departments, leaveRequests, staff } from "@/lib/data/mock";

export default function LeavePage() {
  return (
    <div>
      <PageHeader title="Leave Management" description="Capture, approve, reject, and visualize staff leave blocks." />
      <div className="space-y-5 p-5">
        <Card>
          <CardHeader><CardTitle>New Leave Request</CardTitle></CardHeader>
          <CardContent><LeaveForm /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>All Leaves</CardTitle></CardHeader>
          <CardContent><LeaveTable leaves={leaveRequests} staff={staff} departments={departments} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Leave Calendar · June 2026</CardTitle></CardHeader>
          <CardContent><LeaveCalendar leaves={leaveRequests} staff={staff} year={2026} month={6} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
