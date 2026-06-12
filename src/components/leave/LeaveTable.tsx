"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Department, LeaveRequest, LeaveStatus, Staff } from "@/lib/types";

export function LeaveTable({
  leaves,
  staff,
  departments,
  onStatusChange,
}: {
  leaves: LeaveRequest[];
  staff: Staff[];
  departments: Department[];
  onStatusChange: (id: string, status: LeaveStatus) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
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
                <TableCell className="space-x-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onStatusChange(leave.id, "approved");
                      toast.success("Leave approved");
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onStatusChange(leave.id, "rejected");
                      toast.error("Leave rejected");
                    }}
                  >
                    Reject
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
