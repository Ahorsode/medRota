import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { departments, hospital, shiftConfigurations } from "@/lib/data/mock";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Hospital profile, shifts, holidays, users, and role assignment." />
      <div className="grid gap-5 p-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Hospital Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input defaultValue={hospital.name} />
            <Input defaultValue={hospital.location ?? ""} />
            <Button>Save Profile</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ghana Public Holidays</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {["New Year's Day", "Constitution Day", "Independence Day", "May Day", "Founders' Day", "Christmas"].map((holiday) => (
              <Badge key={holiday} variant="warning">{holiday}</Badge>
            ))}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Shift Configuration Per Department</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {departments.slice(0, 5).map((department) => (
              <div key={department.id} className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-extrabold text-slate-950">{department.name}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {shiftConfigurations.filter((shift) => shift.department_id === department.id).map((shift) => (
                    <Badge key={shift.id} variant={shift.shift_code === "N" ? "purple" : shift.shift_code === "A" ? "warning" : "teal"}>
                      {shift.shift_code}: {shift.start_time ?? "Off"}{shift.start_time ? `-${shift.end_time}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
