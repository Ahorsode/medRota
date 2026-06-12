"use client";

import { useQuery } from "@tanstack/react-query";
import { staff } from "@/lib/data/mock";

export function useStaff(departmentId?: string) {
  return useQuery({
    queryKey: ["staff", departmentId ?? "all"],
    queryFn: () => (departmentId ? staff.filter((person) => person.department_id === departmentId) : staff),
  });
}
