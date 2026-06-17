import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createShiftSwapRequest, getShiftSwapsForStaff, respondToSwap } from "@/lib/actions/swaps";
import { getRosterEntriesForStaff } from "@/lib/actions/rosters";
import { getStaff } from "@/lib/actions/staff";
import { getSessionUser } from "@/lib/auth/getSessionUser";

export const dynamic = "force-dynamic";

export default async function MySwapsPage() {
  const user = await getSessionUser();
  if (!user?.staffRecord) redirect("/dashboard");

  const now = new Date();
  const staffId = user.staffRecord.id;
  const departmentId = user.staffRecord.department_id;
  const [swaps, myEntries, colleagues] = await Promise.all([
    getShiftSwapsForStaff(staffId),
    getRosterEntriesForStaff(staffId, now.getFullYear(), now.getMonth() + 1),
    getStaff(departmentId),
  ]);

  async function requestSwap(formData: FormData) {
    "use server";
    const requesterEntryId = String(formData.get("requester_entry_id") ?? "");
    const replacementId = String(formData.get("replacement_id") ?? "");
    if (!requesterEntryId || !replacementId) return;
    await createShiftSwapRequest({
      requester_id: staffId,
      replacement_id: replacementId,
      requester_entry_id: requesterEntryId,
    });
  }

  async function respond(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const decision = String(formData.get("decision") ?? "");
    if (!id || (decision !== "accept" && decision !== "decline")) return;
    await respondToSwap(id, staffId, decision);
  }

  return (
    <div>
      <PageHeader title="Shift Swaps" description="View your swap requests and respond to requests from colleagues." />
      <div className="grid gap-5 p-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Request a Swap</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={requestSwap} className="grid gap-3">
              <select name="requester_entry_id" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" required>
                <option value="">Select your shift</option>
                {myEntries
                  .filter((entry) => ["M", "A", "N", "ON_CALL"].includes(entry.shift_code))
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.shift_date} - {entry.shift_code}
                    </option>
                  ))}
              </select>
              <select name="replacement_id" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" required>
                <option value="">Select colleague</option>
                {colleagues
                  .filter((person) => person.id !== staffId)
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
                    </option>
                  ))}
              </select>
              <textarea name="reason" className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Reason (optional)" />
              <Button type="submit">Submit Swap Request</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Swap Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requester</TableHead>
                    <TableHead>Their Shift</TableHead>
                    <TableHead>Replacement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {swaps.map((swap) => (
                    <TableRow key={swap.id}>
                      <TableCell className="font-bold">{swap.requester?.full_name}</TableCell>
                      <TableCell>{swap.requester_entry ? `${swap.requester_entry.shift_date} - ${swap.requester_entry.shift_code}` : "-"}</TableCell>
                      <TableCell>{swap.replacement?.full_name}</TableCell>
                      <TableCell>
                        <Badge variant={swap.status === "approved" ? "success" : swap.status === "rejected" ? "danger" : "warning"}>{swap.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {swap.replacement_id === staffId && swap.status === "pending" ? (
                          <form action={respond} className="inline-flex gap-2">
                            <input type="hidden" name="id" value={swap.id} />
                            <Button size="sm" name="decision" value="accept" type="submit">
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" name="decision" value="decline" type="submit">
                              Decline
                            </Button>
                          </form>
                        ) : (
                          <span className="text-xs text-slate-500">No action</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {swaps.length === 0 ? <p className="mt-4 text-sm text-slate-500">No swap requests yet.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
