"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Department, Staff } from "@/lib/types";

export function StaffTable({ staff, departments }: { staff: Staff[]; departments: Department[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      staff.filter(
        (person) =>
          person.full_name.toLowerCase().includes(query.toLowerCase()) ||
          (person.staff_number ?? "").toLowerCase().includes(query.toLowerCase()),
      ),
    [query, staff],
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search name or staff number" />
        </div>
        <Input className="sm:w-52" placeholder="Filter by rank" />
        <Input className="sm:w-60" placeholder="Filter by employment" />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Staff No.</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Employment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((person) => (
              <TableRow key={person.id}>
                <TableCell className="font-bold text-slate-950">
                  <Link className="hover:text-[#2E86AB]" href={`/dashboard/staff/${person.id}`}>
                    {person.full_name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{person.staff_number}</TableCell>
                <TableCell>{person.rank}</TableCell>
                <TableCell>{departments.find((department) => department.id === person.department_id)?.name}</TableCell>
                <TableCell>{person.employment_type}</TableCell>
                <TableCell>
                  <Badge variant={person.is_active ? "success" : "default"}>{person.is_active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/staff/${person.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
