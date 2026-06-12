"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LeaveCalendar } from "@/components/leave/LeaveCalendar";
import { LeaveForm } from "@/components/leave/LeaveForm";
import { LeaveTable } from "@/components/leave/LeaveTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { departments, leaveRequests as initialLeaveRequests, staff } from "@/lib/data/mock";
import type { LeaveStatus } from "@/lib/types";

export default function LeavePage() {
  const [leaves, setLeaves] = useState(initialLeaveRequests);

  function handleStatusChange(id: string, status: LeaveStatus) {
    setLeaves((current) =>
      current.map((leave) =>
        leave.id === id
          ? {
              ...leave,
              status,
              reviewed_at: new Date().toISOString(),
            }
          : leave,
      ),
    );
  }

  return (
    <div>
      <PageHeader title="Leave Management" description="Capture, approve, reject, and visualize staff leave blocks." />
      <div className="space-y-5 p-5">
        <Card>
          <CardHeader><CardTitle>New Leave Request</CardTitle></CardHeader>
          <CardContent><LeaveForm staff={staff} onAdd={(leave) => setLeaves((current) => [leave, ...current])} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>All Leaves</CardTitle></CardHeader>
          <CardContent><LeaveTable leaves={leaves} staff={staff} departments={departments} onStatusChange={handleStatusChange} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Leave Calendar · June 2026</CardTitle></CardHeader>
          <CardContent><LeaveCalendar leaves={leaves} staff={staff} year={2026} month={6} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
