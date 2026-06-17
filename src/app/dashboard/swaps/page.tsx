import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getShiftSwaps, reviewSwap } from "@/lib/actions/swaps";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SwapsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "doctor" || user.role === "nurse" || user.role === "staff") redirect("/dashboard/my-swaps");

  const departmentFilter = user.role === "department_head" ? user.departmentId ?? undefined : undefined;
  const shiftSwaps = await getShiftSwaps(departmentFilter);

  async function review(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!id || (status !== "approved" && status !== "rejected")) return;
    await reviewSwap(id, status);
  }

  return (
    <div>
      <PageHeader title="Shift Swap Management" description="Validate qualification, hours, and rest period issues before approval." />
      <div className="p-5">
        <Card>
          <CardContent className="p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>Their Shift</TableHead>
                  <TableHead>Replacement</TableHead>
                  <TableHead>Replacement Shift</TableHead>
                  <TableHead>Validation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shiftSwaps.map((swap) => (
                  <TableRow key={swap.id}>
                    <TableCell className="font-bold">{swap.requester?.full_name}</TableCell>
                    <TableCell>
                      {swap.requester_entry?.shift_date} · {swap.requester_entry?.shift_code}
                    </TableCell>
                    <TableCell>{swap.replacement?.full_name}</TableCell>
                    <TableCell>
                      {swap.replacement_entry?.shift_date} · {swap.replacement_entry?.shift_code}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="success">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Qualification
                        </Badge>
                        <Badge variant="success">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Hours
                        </Badge>
                        <Badge variant="warning">
                          <XCircle className="mr-1 h-3 w-3" />
                          Rest review
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={swap.status === "approved" ? "success" : swap.status === "rejected" ? "danger" : "warning"}>{swap.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={review} className="inline-flex gap-2">
                        <input type="hidden" name="id" value={swap.id} />
                        <Button size="sm" name="status" value="approved" type="submit">
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" name="status" value="rejected" type="submit">
                          Reject
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {shiftSwaps.length === 0 ? <p className="mt-4 text-sm text-slate-500">No shift swap requests yet.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
