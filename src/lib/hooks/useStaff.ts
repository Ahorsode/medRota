"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStaff, getStaff, updateStaff, type StaffInput } from "@/lib/actions/staff";

export function useStaff(departmentId?: string) {
  return useQuery({
    queryKey: ["staff", departmentId ?? "all"],
    queryFn: () => getStaff(departmentId),
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StaffInput) => createStaff(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateStaff>[1] }) => updateStaff(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });
}
