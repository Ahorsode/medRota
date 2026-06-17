import { notFound } from "next/navigation";
import { CheckCircle, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StaffProfileActions } from "@/components/staff/StaffProfileActions";
import { LeaveStatusBadge } from "@/components/staff/LeaveStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createAssessment, getAssessments } from "@/lib/actions/assessments";
import { getLeaveRequests } from "@/lib/actions/leave";
import { getStaffById } from "@/lib/actions/staff";
import { createTrainingRecord, getTrainingRecords } from "@/lib/actions/training";
import { getSessionUser } from "@/lib/auth/getSessionUser";

export const dynamic = "force-dynamic";

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [currentUser, person, leaves, assessments, trainingRecords] = await Promise.all([
    getSessionUser(),
    getStaffById(id),
    getLeaveRequests(id),
    getAssessments(id),
    getTrainingRecords(id),
  ]);

  if (!person) notFound();

  return (
    <div>
      <PageHeader
        title={person.full_name}
        description={`${person.position ?? "Staff"} · ${person.department?.name ?? "Unassigned"}`}
        actions={
          <StaffProfileActions
            canResetPassword={currentUser?.role === "admin" || currentUser?.role === "hr_officer"}
            staff={person}
          />
        }
      />
      <div className="grid gap-5 p-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Personal Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label="Staff No." value={person.staff_number ?? ""} />
            <Info label="Rank" value={person.rank ?? ""} />
            <Info label="Employment" value={person.employment_type ?? ""} />
            <Info label="Phone" value={person.phone ?? ""} />
            <Info label="Email" value={person.email ?? ""} />
            <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
              <span className="text-slate-500">Account</span>
              {person.must_change_password ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  <Clock className="h-3 w-3" />
                  Awaiting first login
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle className="h-3 w-3" />
                  Account active
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave History</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {leaves.length > 0 ? (
              leaves.map((leave) => (
                <div key={leave.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-bold text-slate-950">{leave.leave_type}</p>
                    <p className="text-xs text-slate-500">
                      {leave.start_date} to {leave.end_date}
                    </p>
                  </div>
                  <LeaveStatusBadge status={leave.status} />
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No leave history recorded.</p>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Competency</TableHead>
                  <TableHead>Efficiency</TableHead>
                  <TableHead>Professionalism</TableHead>
                  <TableHead>Ethics</TableHead>
                  <TableHead>Overall</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell className="font-bold text-slate-950">{assessment.period}</TableCell>
                    <TableCell>{assessment.assessment_date}</TableCell>
                    <TableCell>{assessment.competency_score ?? "-"}</TableCell>
                    <TableCell>{assessment.efficiency_score ?? "-"}</TableCell>
                    <TableCell>{assessment.professionalism_score ?? "-"}</TableCell>
                    <TableCell>{assessment.ethical_score ?? "-"}</TableCell>
                    <TableCell>{assessment.overall_score ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {assessments.length === 0 ? <p className="mt-3 text-sm text-slate-500">No assessments recorded.</p> : null}
            <details className="mt-4 rounded-lg border border-slate-200">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">+ Add Assessment</summary>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await createAssessment({
                    staff_id: id,
                    assessed_by: String(formData.get("assessed_by") ?? "") || undefined,
                    assessment_date: String(formData.get("assessment_date") ?? ""),
                    period: String(formData.get("period") ?? ""),
                    competency_score: Number(formData.get("competency_score")) || undefined,
                    efficiency_score: Number(formData.get("efficiency_score")) || undefined,
                    professionalism_score: Number(formData.get("professionalism_score")) || undefined,
                    ethical_score: Number(formData.get("ethical_score")) || undefined,
                    comments: String(formData.get("comments") ?? "") || undefined,
                  });
                }}
                className="grid gap-3 p-4 md:grid-cols-3"
              >
                <input name="period" placeholder="Period (e.g. Q1 2026)" className="h-10 rounded-md border border-slate-200 px-3 text-sm" required />
                <input name="assessment_date" type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" required />
                <input name="assessed_by" placeholder="Assessor ID" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                {["competency_score", "efficiency_score", "professionalism_score", "ethical_score"].map((field) => (
                  <input
                    key={field}
                    name={field}
                    type="number"
                    min={1}
                    max={5}
                    placeholder={`${field.replace("_score", "").replace("_", " ")} (1-5)`}
                    className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                  />
                ))}
                <textarea name="comments" placeholder="Comments" className="min-h-20 rounded-md border border-slate-200 px-3 py-2 text-sm md:col-span-3" />
                <Button type="submit" className="md:col-span-3">
                  Save Assessment
                </Button>
              </form>
            </details>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Training</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Dates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainingRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-bold text-slate-950">{record.training_title}</TableCell>
                    <TableCell>
                      <Badge variant={record.training_type === "given" ? "blue" : "teal"}>{record.training_type}</Badge>
                    </TableCell>
                    <TableCell>{record.provider ?? "-"}</TableCell>
                    <TableCell>
                      {record.start_date} to {record.end_date}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {trainingRecords.length === 0 ? <p className="mt-3 text-sm text-slate-500">No training records yet.</p> : null}
            <details className="mt-4 rounded-lg border border-slate-200">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">+ Add Training Record</summary>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await createTrainingRecord({
                    staff_id: id,
                    training_title: String(formData.get("training_title") ?? ""),
                    training_type: String(formData.get("training_type") ?? "attended"),
                    provider: String(formData.get("provider") ?? "") || undefined,
                    start_date: String(formData.get("start_date") ?? ""),
                    end_date: String(formData.get("end_date") ?? ""),
                    notes: String(formData.get("notes") ?? "") || undefined,
                  });
                }}
                className="grid gap-3 p-4 md:grid-cols-3"
              >
                <input
                  name="training_title"
                  placeholder="Training title"
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm md:col-span-2"
                  required
                />
                <select name="training_type" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                  <option value="attended">Attended</option>
                  <option value="given">Given</option>
                </select>
                <input name="provider" placeholder="Provider / Institution" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                <input name="start_date" type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" required />
                <input name="end_date" type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" required />
                <textarea name="notes" placeholder="Notes" className="min-h-20 rounded-md border border-slate-200 px-3 py-2 text-sm md:col-span-3" />
                <Button type="submit" className="md:col-span-3">
                  Save Training Record
                </Button>
              </form>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-lg border border-slate-200 p-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-950">{value}</span>
    </div>
  );
}
