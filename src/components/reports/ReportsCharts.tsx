"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type StaffingDatum = {
  department: string;
  Morning: number;
  Afternoon: number;
  Night: number;
};

type LeaveDatum = {
  name: string;
  value: number;
  color?: string;
};

type AbsenteeismDatum = {
  week: string;
  leave: number;
};

type NightFairnessDatum = {
  name: string;
  nights: number;
};

export function ReportsCharts({
  staffing,
  absenteeism,
  leave,
  nightFairness,
}: {
  staffing: StaffingDatum[];
  absenteeism: AbsenteeismDatum[];
  leave: LeaveDatum[];
  nightFairness: NightFairnessDatum[];
}) {
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
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="leave" stroke="#EF4444" strokeWidth={3} />
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
                {leave.map((entry) => <Cell key={entry.name} fill={entry.color ?? "#2E86AB"} />)}
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
            <BarChart data={nightFairness}>
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
