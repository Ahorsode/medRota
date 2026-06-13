"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRosterWithEntries, updateRosterEntry, updateRosterStatus } from "@/lib/actions/rosters";
import type { RosterStatus, ShiftCode } from "@/lib/types";

export function useRoster(departmentId: string, year: number, month: number) {
  return useQuery({
    queryKey: ["roster", departmentId, year, month],
    queryFn: () => getRosterWithEntries(departmentId, year, month),
  });
}

export function useUpdateRosterEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      rosterId,
      staffId,
      shiftDate,
      shiftCode,
      opts,
    }: {
      rosterId: string;
      staffId: string;
      shiftDate: string;
      shiftCode: ShiftCode;
      opts?: { isLeave?: boolean; leaveType?: string; notes?: string };
    }) => updateRosterEntry(rosterId, staffId, shiftDate, shiftCode, opts),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roster"] }),
  });
}

export function useUpdateRosterStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, approvedBy }: { id: string; status: RosterStatus; approvedBy?: string }) =>
      updateRosterStatus(id, status, approvedBy),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roster"] }),
  });
}
