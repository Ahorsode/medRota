import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acknowledgeHandover, createHandoverReport, getHandoverReports } from "@/lib/actions/handover";
import { getDepartments } from "@/lib/actions/departments";
import { getStaff } from "@/lib/actions/staff";
import { createClient } from "@/lib/supabase/server";
import { formatDateLabel } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function HandoverPage() {
  const [departments, staff] = await Promise.all([getDepartments(), getStaff()]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserStaff = user ? staff.find((person) => person.user_id === user.id) : null;
  const activeDepartment =
    (currentUserStaff?.department_id
      ? departments.find((department) => department.id === currentUserStaff.department_id)
      : null) ??
    departments[0] ??
    null;
  const reports = activeDepartment ? await getHandoverReports(activeDepartment.id, today()) : [];

  async function createReport(formData: FormData) {
    "use server";

    const departmentId = String(formData.get("department_id") ?? "");
    const fromStaffId = String(formData.get("from_staff_id") ?? "");
    const toStaffId = String(formData.get("to_staff_id") ?? "");
    const reportBody = String(formData.get("report_body") ?? "");
    if (!departmentId || !fromStaffId || !toStaffId || !reportBody.trim()) return;

    await createHandoverReport({
      department_id: departmentId,
      shift_date: String(formData.get("shift_date") ?? today()),
      shift_code: String(formData.get("shift_code") ?? "M"),
      from_staff_id: fromStaffId,
      to_staff_id: toStaffId,
      report_body: reportBody,
      patients_count: Number(formData.get("patients_count") ?? "") || undefined,
      critical_notes: String(formData.get("critical_notes") ?? "") || undefined,
    });
  }

  return (
    <div>
      <PageHeader title="Handover Reports" description="Shift-to-shift clinical handover notes and acknowledgements." />
      <div className="grid gap-5 p-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create Handover</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createReport} className="grid gap-3">
              <select name="department_id" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" defaultValue={activeDepartment?.id ?? ""}>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 md:grid-cols-2">
                <input name="shift_date" type="date" defaultValue={today()} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                <select name="shift_code" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                  <option value="M">Morning</option>
                  <option value="A">Afternoon</option>
                  <option value="N">Night</option>
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select name="from_staff_id" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      From: {person.full_name}
                    </option>
                  ))}
                </select>
                <select name="to_staff_id" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      To: {person.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                name="report_body"
                className="min-h-36 rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Patient census, critical cases, pending tasks, equipment issues..."
                required
              />
              <input name="patients_count" type="number" min={0} className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="Patient count" />
              <textarea name="critical_notes" className="min-h-24 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm" placeholder="Critical notes" />
              <Button type="submit" disabled={!activeDepartment}>
                <ClipboardCheck className="h-4 w-4" />
                Save Handover
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Reports</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {reports.length > 0 ? (
              reports.map((report) => (
                <article key={report.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">{formatDateLabel(report.shift_date)} · {report.shift_code}</p>
                      <p className="text-xs text-slate-500">
                        {report.from_staff?.full_name ?? "Unknown"} to {report.to_staff?.full_name ?? "Unknown"}
                      </p>
                    </div>
                    <Badge variant={report.is_acknowledged ? "success" : "warning"}>
                      {report.is_acknowledged ? "Acknowledged" : "Pending"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{report.report_body}</p>
                  {report.critical_notes ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-800">{report.critical_notes}</p> : null}
                  {!report.is_acknowledged ? (
                    <form
                      action={async () => {
                        "use server";
                        await acknowledgeHandover(report.id);
                      }}
                      className="mt-3"
                    >
                      <Button type="submit" size="sm" variant="outline">
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Acknowledge Handover
                      </Button>
                    </form>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">No handover reports for today.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
