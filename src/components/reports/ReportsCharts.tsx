"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const staffing = [
  { department: "OPD", Morning: 42, Afternoon: 30, Night: 28 },
  { department: "Security", Morning: 31, Afternoon: 0, Night: 29 },
  { department: "Records", Morning: 36, Afternoon: 18, Night: 0 },
  { department: "Prescribers", Morning: 24, Afternoon: 16, Night: 10 },
];

const absenteeism = [
  { month: "Jan", rate: 2.1 },
  { month: "Feb", rate: 2.4 },
  { month: "Mar", rate: 1.8 },
  { month: "Apr", rate: 2.9 },
  { month: "May", rate: 2.2 },
  { month: "Jun", rate: 1.7 },
];

const leave = [
  { name: "Annual", value: 46, color: "#7C3AED" },
  { name: "Study", value: 18, color: "#2E86AB" },
  { name: "Sick", value: 12, color: "#F59E0B" },
  { name: "Maternity", value: 8, color: "#10B981" },
];

export function ReportsCharts() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="h-80 animate-pulse bg-slate-100" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Staffing Summary</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={staffing}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="Morning" fill="#2E86AB" />
              <Bar dataKey="Afternoon" fill="#F59E0B" />
              <Bar dataKey="Night" fill="#312E81" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Absenteeism Rate</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={absenteeism}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="#EF4444" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Leave Distribution</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={leave} dataKey="value" nameKey="name" outerRadius={100} label>
                {leave.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Night Shift Fairness</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[{ name: "R. Opoku", nights: 5 }, { name: "A. Amo", nights: 4 }, { name: "Sandra", nights: 6 }, { name: "E. Asante", nights: 5 }]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="nights" fill="#312E81" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
