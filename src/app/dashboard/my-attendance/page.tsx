import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clockIn, clockOut, getAttendanceRecords } from "@/lib/actions/attendance";
import { getSessionUser } from "@/lib/auth/getSessionUser";

export const dynamic = "force-dynamic";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function timeLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "-";
}

export default async function MyAttendancePage() {
  const user = await getSessionUser();
  if (!user?.staffRecord) redirect("/dashboard");

  const staffId = user.staffRecord.id;
  const records = await getAttendanceRecords(staffId);
  const todayRecord = records.find((record) => record.shift_date === today());

  async function clockInAction() {
    "use server";
    await clockIn(staffId, today());
  }

  async function clockOutAction() {
    "use server";
    await clockOut(staffId, today());
  }

  return (
    <div>
      <PageHeader title="My Attendance" description="Your clock-in, clock-out, and monthly attendance record." />
      <div className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Summary label="Present" value={records.filter((record) => record.status === "present").length} variant="success" />
          <Summary label="Absent" value={records.filter((record) => record.status === "absent").length} variant="danger" />
          <Summary label="Late" value={records.filter((record) => record.status === "late").length} variant="warning" />
          <Card>
            <CardContent className="flex flex-col gap-3 p-5">
              <p className="text-sm font-semibold text-slate-500">Today</p>
              <div className="flex gap-2">
                <form action={clockInAction}>
                  <Button size="sm" variant="outline" disabled={!!todayRecord?.clock_in}>
                    <Clock className="h-4 w-4" />
                    In
                  </Button>
                </form>
                <form action={clockOutAction}>
                  <Button size="sm" variant="outline" disabled={!todayRecord?.clock_in || !!todayRecord?.clock_out}>
                    <Clock className="h-4 w-4" />
                    Out
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-5">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.shift_date}</TableCell>
                      <TableCell>{timeLabel(record.clock_in)}</TableCell>
                      <TableCell>{timeLabel(record.clock_out)}</TableCell>
                      <TableCell>
                        <Badge variant={record.status === "absent" ? "danger" : record.status === "late" ? "warning" : "success"}>{record.status}</Badge>
                      </TableCell>
                      <TableCell>{record.notes ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {records.length === 0 ? <p className="mt-4 text-sm text-slate-500">No attendance records yet.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Summary({ label, value, variant }: { label: string; value: number; variant: "success" | "danger" | "warning" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <Badge variant={variant}>{label}</Badge>
        <p className="mt-3 font-mono text-3xl font-extrabold text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}
