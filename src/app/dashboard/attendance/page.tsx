import { Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clockIn, clockOut, getAttendanceRecords, markAbsent } from "@/lib/actions/attendance";
import { getDepartments } from "@/lib/actions/departments";
import { getStaff } from "@/lib/actions/staff";
import { formatDateLabel } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function timeLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "-";
}

export default async function AttendancePage() {
  const [departments, staff, records] = await Promise.all([getDepartments(), getStaff(), getAttendanceRecords(undefined, undefined, today())]);

  async function markAbsentAction(formData: FormData) {
    "use server";
    const staffId = String(formData.get("staff_id") ?? "");
    if (!staffId) return;
    await markAbsent(staffId, String(formData.get("shift_date") ?? today()), String(formData.get("notes") ?? "") || undefined);
  }

  async function clockInAction(formData: FormData) {
    "use server";
    const staffId = String(formData.get("staff_id") ?? "");
    if (!staffId) return;
    await clockIn(staffId, today());
  }

  async function clockOutAction(formData: FormData) {
    "use server";
    const staffId = String(formData.get("staff_id") ?? "");
    if (!staffId) return;
    await clockOut(staffId, today());
  }

  return (
    <div>
      <PageHeader title="Attendance" description="Daily clock-in, absence, and shift presence tracking." />
      <div className="grid gap-5 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-slate-500">Departments</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950">{departments.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-slate-500">Attendance Records Today</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950">{records.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-slate-500">Active Staff</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950">{staff.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{formatDateLabel(today())}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((person) => {
                    const record = records.find((item) => item.staff_id === person.id);
                    return (
                      <TableRow key={person.id}>
                        <TableCell>
                          <p className="font-bold text-slate-950">{person.full_name}</p>
                          <p className="text-xs text-slate-500">{person.rank ?? person.position}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={record?.status === "absent" ? "danger" : record?.status === "late" ? "warning" : "success"}>
                            {record?.status ?? "not marked"}
                          </Badge>
                        </TableCell>
                        <TableCell>{timeLabel(record?.clock_in ?? null)}</TableCell>
                        <TableCell>{timeLabel(record?.clock_out ?? null)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <form action={clockInAction}>
                              <input type="hidden" name="staff_id" value={person.id} />
                              <Button
                                size="sm"
                                variant="outline"
                                type="submit"
                                disabled={!!record?.clock_in}
                                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              >
                                <Clock className="mr-1 h-3 w-3" />
                                In
                              </Button>
                            </form>
                            <form action={clockOutAction}>
                              <input type="hidden" name="staff_id" value={person.id} />
                              <Button
                                size="sm"
                                variant="outline"
                                type="submit"
                                disabled={!record?.clock_in || !!record?.clock_out}
                                className="text-slate-700"
                              >
                                <Clock className="mr-1 h-3 w-3" />
                                Out
                              </Button>
                            </form>
                            <form action={markAbsentAction}>
                              <input type="hidden" name="staff_id" value={person.id} />
                              <input type="hidden" name="shift_date" value={today()} />
                              <Button size="sm" variant="outline" type="submit" className="border-red-200 text-red-700 hover:bg-red-50">
                                Absent
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
