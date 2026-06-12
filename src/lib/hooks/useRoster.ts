"use client";

import { useQuery } from "@tanstack/react-query";
import { rosterEntries, rosters } from "@/lib/data/mock";

export function useRoster(departmentId: string, year: number, month: number) {
  return useQuery({
    queryKey: ["roster", departmentId, year, month],
    queryFn: () => {
      const roster = rosters.find((item) => item.department_id === departmentId && item.year === year && item.month === month);
      return {
        roster,
        entries: rosterEntries.filter((entry) => entry.roster_id === roster?.id),
      };
    },
  });
}
