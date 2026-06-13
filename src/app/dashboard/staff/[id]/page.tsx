import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { StaffProfileActions } from "@/components/staff/StaffProfileActions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAssessments } from "@/lib/actions/assessments";
import { getLeaveRequests } from "@/lib/actions/leave";
import { getStaffById } from "@/lib/actions/staff";
import { getTrainingRecords } from "@/lib/actions/training";

export const dynamic = "force-dynamic";

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [person, leaves, assessments, trainingRecords] = await Promise.all([
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
        actions={<StaffProfileActions staff={person} />}
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
                  <Badge variant={leave.status === "approved" ? "success" : leave.status === "pending" ? "warning" : "danger"}>{leave.status}</Badge>
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
