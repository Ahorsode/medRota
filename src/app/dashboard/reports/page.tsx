import { Download, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportsCharts } from "@/components/reports/ReportsCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ReportsPage() {
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
            <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="date" defaultValue="2026-06-01" />
            <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="date" defaultValue="2026-06-30" />
            <select className="h-10 rounded-md border border-slate-200 px-3 text-sm">
              <option>All departments</option>
              <option>OPD</option>
              <option>Security</option>
            </select>
          </CardContent>
        </Card>
        <ReportsCharts />
      </div>
    </div>
  );
}
