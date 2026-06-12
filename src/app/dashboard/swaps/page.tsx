"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rosterEntries, shiftSwaps, staff } from "@/lib/data/mock";

export default function SwapsPage() {
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
                {shiftSwaps.map((swap) => {
                  const requester = staff.find((person) => person.id === swap.requester_id);
                  const replacement = staff.find((person) => person.id === swap.replacement_id);
                  const requesterEntry = rosterEntries.find((entry) => entry.id === swap.requester_entry_id);
                  const replacementEntry = rosterEntries.find((entry) => entry.id === swap.replacement_entry_id);
                  return (
                    <TableRow key={swap.id}>
                      <TableCell className="font-bold">{requester?.full_name}</TableCell>
                      <TableCell>{requesterEntry?.shift_date} · {requesterEntry?.shift_code}</TableCell>
                      <TableCell>{replacement?.full_name}</TableCell>
                      <TableCell>{replacementEntry?.shift_date} · {replacementEntry?.shift_code}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Qualification</Badge>
                          <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Hours</Badge>
                          <Badge variant="danger"><XCircle className="mr-1 h-3 w-3" />Rest period</Badge>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="warning">{swap.status}</Badge></TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button size="sm" onClick={() => toast.success("Swap approved")}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => toast.error("Swap rejected")}>Reject</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
