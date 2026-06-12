"use client";

import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportsCharts } from "@/components/reports/ReportsCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { departments, leaveRequests, rosterEntries, staff } from "@/lib/data/mock";

const leaveColors: Record<string, string> = {
  Annual: "#7C3AED",
  Study: "#2E86AB",
  Sick: "#F59E0B",
  Maternity: "#10B981",
  Paternity: "#A8DADC",
  Compassionate: "#EF4444",
  Emergency: "#D97706",
};

export default function ReportsPage() {
  const [startDate, setStartDate] = useState("2026-06-01");
  const [endDate, setEndDate] = useState("2026-06-30");
  const [departmentId, setDepartmentId] = useState("all");

  const filteredEntries = useMemo(
    () =>
      rosterEntries.filter((entry) => {
        const person = staff.find((item) => item.id === entry.staff_id);
        return entry.shift_date >= startDate && entry.shift_date <= endDate && (departmentId === "all" || person?.department_id === departmentId);
      }),
    [departmentId, endDate, startDate],
  );

  const filteredLeaves = useMemo(
    () =>
      leaveRequests.filter((leave) => {
        const person = staff.find((item) => item.id === leave.staff_id);
        return leave.end_date >= startDate && leave.start_date <= endDate && (departmentId === "all" || person?.department_id === departmentId);
      }),
    [departmentId, endDate, startDate],
  );

  const staffing = departments
    .filter((department) => departmentId === "all" || department.id === departmentId)
    .map((department) => {
      const staffIds = new Set(staff.filter((person) => person.department_id === department.id).map((person) => person.id));
      const entries = filteredEntries.filter((entry) => staffIds.has(entry.staff_id));
      return {
        department: department.name.length > 16 ? `${department.name.slice(0, 16)}...` : department.name,
        Morning: entries.filter((entry) => entry.shift_code === "M").length,
        Afternoon: entries.filter((entry) => entry.shift_code === "A").length,
        Night: entries.filter((entry) => entry.shift_code === "N").length,
      };
    });

  const absenteeism = [1, 2, 3, 4, 5].map((week) => ({
    week: `Week ${week}`,
    leave: filteredEntries.filter((entry) => entry.shift_code === "LEAVE" && Math.ceil(Number(entry.shift_date.slice(-2)) / 7) === week).length,
  }));

  const leave = Object.entries(
    filteredLeaves.reduce<Record<string, number>>((totals, request) => {
      totals[request.leave_type] = (totals[request.leave_type] ?? 0) + 1;
      return totals;
    }, {}),
  ).map(([name, value]) => ({ name, value, color: leaveColors[name] }));

  const nightFairness = staff
    .filter((person) => departmentId === "all" || person.department_id === departmentId)
    .map((person) => ({
      name: person.full_name,
      nights: filteredEntries.filter((entry) => entry.staff_id === person.id && entry.shift_code === "N").length,
    }))
    .filter((item) => item.nights > 0);

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Staffing, absenteeism, overtime, leave, fairness, and coverage reports."
        actions={
          <>
            <Button variant="outline"><Printer className="h-4 w-4" />Print</Button>
            <Button><Download className="h-4 w-4" />Export</Button>
          </>
        }
      />
      <div className="space-y-5 p-5">
        <Card>
          <CardContent className="grid gap-3 p-5 md:grid-cols-3">
            <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            <select className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="all">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
        <ReportsCharts staffing={staffing} absenteeism={absenteeism} leave={leave} nightFairness={nightFairness} />
      </div>
    </div>
  );
}
