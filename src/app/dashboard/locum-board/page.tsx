import { redirect } from "next/navigation";
import { BriefcaseMedical } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDepartments } from "@/lib/actions/departments";
import { acceptLocumShift, getLocumShifts, postLocumShift } from "@/lib/actions/locum";
import { getSessionUser } from "@/lib/auth/getSessionUser";

export const dynamic = "force-dynamic";

export default async function LocumBoardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const departmentFilter = user.role === "department_head" ? user.departmentId ?? undefined : undefined;
  const [allDepartments, shifts] = await Promise.all([getDepartments(), getLocumShifts(departmentFilter)]);
  const departments = departmentFilter ? allDepartments.filter((department) => department.id === departmentFilter) : allDepartments;
  const canPost = user.role === "admin" || user.role === "hr_officer" || user.role === "department_head";
  const canAccept = user.staffRecord?.employment_type === "Locum";
  const userId = user.id;
  const userRole = user.role;
  const userDepartmentId = user.departmentId;
  const staffId = user.staffRecord?.id ?? null;

  async function postShift(formData: FormData) {
    "use server";
    const departmentId = String(formData.get("department_id") ?? "");
    if (!departmentId) return;
    if (userRole === "department_head" && departmentId !== userDepartmentId) return;

    await postLocumShift({
      department_id: departmentId,
      shift_date: String(formData.get("shift_date") ?? ""),
      shift_code: String(formData.get("shift_code") ?? "M"),
      requirements: String(formData.get("requirements") ?? "") || undefined,
      posted_by: userId,
    });
  }

  async function acceptShift(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id || !staffId) return;
    await acceptLocumShift(id, staffId);
  }

  return (
    <div>
      <PageHeader title="Locum Request Board" description="Open shifts for locum staff and department coverage gaps." />
      <div className="grid gap-5 p-5 xl:grid-cols-[0.8fr_1.2fr]">
        {canPost ? (
          <Card>
            <CardHeader>
              <CardTitle>Post Open Shift</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={postShift} className="grid gap-3">
                <select name="department_id" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" required>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <input name="shift_date" type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" required />
                <select name="shift_code" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                  <option value="M">Morning</option>
                  <option value="A">Afternoon</option>
                  <option value="N">Night</option>
                  <option value="H">Holiday</option>
                </select>
                <textarea name="requirements" className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Requirements, ward notes, or skill needs" />
                <Button type="submit">
                  <BriefcaseMedical className="h-4 w-4" />
                  Post Shift
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card className={canPost ? "" : "xl:col-span-2"}>
          <CardHeader>
            <CardTitle>Open Locum Shifts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Requirements</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell>{shift.shift_date}</TableCell>
                      <TableCell className="font-bold">{shift.shift_code}</TableCell>
                      <TableCell>{shift.department?.name ?? "Department"}</TableCell>
                      <TableCell>{shift.requirements ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant={shift.status === "open" ? "warning" : shift.status === "filled" ? "success" : "default"}>{shift.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canAccept && shift.status === "open" ? (
                          <form action={acceptShift}>
                            <input type="hidden" name="id" value={shift.id} />
                            <Button size="sm" type="submit">Accept</Button>
                          </form>
                        ) : shift.filled_staff ? (
                          <span className="text-xs text-slate-500">{shift.filled_staff.full_name}</span>
                        ) : (
                          <span className="text-xs text-slate-500">No action</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {shifts.length === 0 ? <p className="mt-4 text-sm text-slate-500">No locum shifts posted yet.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
