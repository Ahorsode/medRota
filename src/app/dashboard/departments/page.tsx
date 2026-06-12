import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RosterStatusBadge } from "@/components/roster/RosterStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { departments, rosters, staff } from "@/lib/data/mock";

export default function DepartmentsPage() {
  return (
    <div>
      <PageHeader title="Department Management" description="Manage clinical and operational units that publish duty rosters." actions={<Button><Plus className="h-4 w-4" />Create Department</Button>} />
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        {departments.map((department) => {
          const roster = rosters.find((item) => item.department_id === department.id);
          return (
            <Card key={department.id} className="transition hover:border-[#2E86AB] hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-extrabold text-slate-950">{department.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{department.description}</p>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm text-slate-500">{staff.filter((person) => person.department_id === department.id).length} staff</span>
                  {roster ? <RosterStatusBadge status={roster.status} /> : <Badge>No roster</Badge>}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/rosters/${department.id}/2026/6`}>Open Roster</Link>
                  </Button>
                  <Button size="sm" variant="ghost">Edit</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
