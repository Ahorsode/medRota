import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { departments, rosterEntries, staff } from "@/lib/data/mock";
import { formatDateLabel } from "@/lib/utils/dates";

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = staff.find((item) => item.id === id);
  if (!person) notFound();
  const department = departments.find((item) => item.id === person.department_id);
  const entries = rosterEntries.filter((entry) => entry.staff_id === person.id).slice(0, 18);

  return (
    <div>
      <PageHeader title={person.full_name} description={`${person.position} · ${department?.name}`} />
      <div className="grid gap-5 p-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label="Staff No." value={person.staff_number} />
            <Info label="Rank" value={person.rank ?? ""} />
            <Info label="Employment" value={person.employment_type ?? ""} />
            <Info label="Phone" value={person.phone ?? ""} />
            <Info label="Email" value={person.email ?? ""} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Upcoming Shifts</CardTitle></CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <span className="text-sm font-semibold">{formatDateLabel(entry.shift_date)}</span>
                <Badge variant={entry.shift_code === "LEAVE" ? "purple" : "teal"}>{entry.shift_code}</Badge>
              </div>
            ))}
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
