import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StaffTable } from "@/components/staff/StaffTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createStaff, getStaff } from "@/lib/actions/staff";
import { getDepartments } from "@/lib/actions/departments";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const [staff, departments] = await Promise.all([getStaff(), getDepartments()]);

  async function addStaff(formData: FormData) {
    "use server";
    const departmentId = String(formData.get("department_id") ?? "");
    const fullName = String(formData.get("full_name") ?? "");
    const staffNumber = String(formData.get("staff_number") ?? "");
    if (!departmentId || !fullName || !staffNumber) return;

    await createStaff({
      department_id: departmentId,
      full_name: fullName,
      staff_number: staffNumber,
      rank: String(formData.get("rank") ?? "") || undefined,
      position: String(formData.get("position") ?? "") || undefined,
      employment_type: String(formData.get("employment_type") ?? "") || undefined,
      phone: String(formData.get("phone") ?? "") || undefined,
      email: String(formData.get("email") ?? "") || undefined,
    });
  }

  return (
    <div>
      <PageHeader title="Staff Management" description="Search, filter, add, edit, and deactivate hospital staff." />
      <div className="space-y-5 p-5">
        <Card>
          <CardHeader>
            <CardTitle>Quick Add</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addStaff} className="grid gap-3 md:grid-cols-4">
              <input name="full_name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="Full name" required />
              <input name="staff_number" className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="Staff number" required />
              <input name="rank" className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="Rank" />
              <input name="position" className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="Position" />
              <select name="department_id" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" required>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <select name="employment_type" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" defaultValue="Full-time">
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Locum</option>
              </select>
              <input name="phone" className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="Phone" />
              <input name="email" type="email" className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="Email" />
              <Button className="md:col-span-4" type="submit">
                <Plus className="h-4 w-4" />
                Add Staff
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <StaffTable staff={staff} departments={departments} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
