import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { StaffPasswordForm } from "@/components/staff/StaffPasswordForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { updateStaff, getStaffById } from "@/lib/actions/staff";
import { getSessionUser } from "@/lib/auth/getSessionUser";

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
  const user = await getSessionUser();
  if (!user?.staffRecord) redirect("/dashboard");

  const staffId = user.staffRecord.id;
  const staff = await getStaffById(staffId);
  if (!staff) redirect("/dashboard");

  async function updateContact(formData: FormData) {
    "use server";
    await updateStaff(staffId, {
      phone: String(formData.get("phone") ?? "") || undefined,
      email: String(formData.get("email") ?? "") || undefined,
    });
  }

  return (
    <div>
      <PageHeader title="My Profile" description="Manage your contact details and view your employment record." />
      <div className="grid gap-5 p-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Personal Info</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateContact} className="grid gap-3">
              <label className="text-sm font-semibold text-slate-600">Phone</label>
              <input name="phone" defaultValue={staff.phone ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
              <label className="text-sm font-semibold text-slate-600">Email</label>
              <input name="email" type="email" defaultValue={staff.email ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
              <Button type="submit">Save Contact Info</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment Info</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <Info label="Staff No." value={staff.staff_number ?? ""} />
            <Info label="Rank" value={staff.rank ?? ""} />
            <Info label="Position" value={staff.position ?? ""} />
            <Info label="Department" value={staff.department?.name ?? "Unassigned"} />
            <Info label="Employment" value={staff.employment_type ?? ""} />
            <Info label="Status" value={staff.is_active ? "Active" : "Inactive"} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>My Qualifications / Training</CardTitle>
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
                {(staff.training_records ?? []).map((record) => (
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
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>My Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Competency</TableHead>
                  <TableHead>Efficiency</TableHead>
                  <TableHead>Overall</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(staff.assessments ?? []).map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell className="font-bold text-slate-950">{assessment.period}</TableCell>
                    <TableCell>{assessment.assessment_date}</TableCell>
                    <TableCell>{assessment.competency_score ?? "-"}</TableCell>
                    <TableCell>{assessment.efficiency_score ?? "-"}</TableCell>
                    <TableCell>{assessment.overall_score ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <StaffPasswordForm />
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
