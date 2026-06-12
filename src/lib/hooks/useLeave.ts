"use client";

import { useQuery } from "@tanstack/react-query";
import { leaveRequests } from "@/lib/data/mock";

export function useLeave() {
  return useQuery({
    queryKey: ["leave-requests"],
    queryFn: () => leaveRequests,
  });
}
