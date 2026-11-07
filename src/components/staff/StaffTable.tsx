"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Department, Staff } from "@/lib/types";

export function StaffTable({
  staff,
  departments,
  initialQuery = "",
}: {
  staff: Staff[];
  departments: Department[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [rank, setRank] = useState("");
  const [employment, setEmployment] = useState("");
  const ranks = useMemo(() => uniqueValues(staff.map((person) => person.rank)), [staff]);
  const employmentTypes = useMemo(() => uniqueValues(staff.map((person) => person.employment_type)), [staff]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return staff.filter((person) => {
      const matchesQuery =
        !needle ||
        person.full_name.toLowerCase().includes(needle) ||
        (person.staff_number ?? "").toLowerCase().includes(needle) ||
        (person.email ?? "").toLowerCase().includes(needle);
      const matchesRank = !rank || person.rank === rank;
      const matchesEmployment = !employment || person.employment_type === employment;
      return matchesQuery && matchesRank && matchesEmployment;
    });
  }, [query, rank, employment, staff]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search name, staff number or email" />
        </div>
        <select
          aria-label="Filter by rank"
          value={rank}
          onChange={(event) => setRank(event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm sm:w-52"
        >
          <option value="">All ranks</option>
          {ranks.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by employment"
          value={employment}
          onChange={(event) => setEmployment(event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm sm:w-60"
        >
          <option value="">All employment types</option>
          {employmentTypes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
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
        {filtered.length === 0 ? <div className="px-5 py-10 text-center text-sm text-slate-400">No staff match these filters.</div> : null}
      </div>
    </div>
  );
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => !!value))).sort();
}
