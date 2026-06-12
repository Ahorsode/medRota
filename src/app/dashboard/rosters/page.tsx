import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RosterStatusBadge } from "@/components/roster/RosterStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { departments, rosters, staff } from "@/lib/data/mock";

export default function RosterOverviewPage() {
  return (
    <div>
      <PageHeader title="Duty Rosters" description="Create, edit, approve, publish, and export monthly duty rosters." actions={<Button><Plus className="h-4 w-4" />Create Roster</Button>} />
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        {rosters.map((roster) => {
          const department = departments.find((item) => item.id === roster.department_id);
          return (
            <Card key={roster.id} className="transition hover:border-[#2E86AB] hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-950">{department?.name}</h2>
                    <p className="text-sm text-slate-500">June 2026</p>
                  </div>
                  <RosterStatusBadge status={roster.status} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Staff</p>
                    <p className="font-mono text-xl font-extrabold">{staff.filter((person) => person.department_id === roster.department_id).length}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Unassigned</p>
                    <p className="font-mono text-xl font-extrabold">0</p>
                  </div>
                </div>
                <Button asChild className="mt-5 w-full" variant="navy">
                  <Link href={`/dashboard/rosters/${roster.department_id}/${roster.year}/${roster.month}`}>Open Editor</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
