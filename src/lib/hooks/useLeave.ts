"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLeaveRequest, getLeaveRequests, reviewLeaveRequest } from "@/lib/actions/leave";

export function useLeave(staffId?: string, departmentId?: string) {
  return useQuery({
    queryKey: ["leave-requests", staffId ?? "all", departmentId ?? "all"],
    queryFn: () => getLeaveRequests(staffId, departmentId),
  });
}

export function useCreateLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLeaveRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave-requests"] }),
  });
}

export function useReviewLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reviewedBy, notes }: { id: string; status: "approved" | "rejected_hr"; reviewedBy: string; notes?: string }) =>
      reviewLeaveRequest(id, status, reviewedBy, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave-requests"] }),
  });
}
