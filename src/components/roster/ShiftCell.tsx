"use client";

import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { AlertTriangle } from "lucide-react";
import type { ShiftCode, ShiftConfiguration } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatDateLabel } from "@/lib/utils/dates";
import { shiftColorClasses, shiftOptions } from "@/lib/utils/shifts";

export function ShiftCell({
  code,
  staffName,
  date,
  editable,
  hasConflict,
  conflictReason,
  configuration,
  onChange,
}: {
  code: ShiftCode;
  staffName: string;
  date: string;
  editable: boolean;
  hasConflict?: boolean;
  conflictReason?: string;
  configuration?: ShiftConfiguration;
  onChange: (code: ShiftCode) => void;
}) {
  const label = configuration
    ? `${configuration.shift_name}${configuration.start_time ? ` (${configuration.start_time}-${configuration.end_time})` : ""}`
    : code === "LEAVE"
      ? "Leave"
      : code;

  const cell = (
    <button
      type="button"
      disabled={!editable}
      className={cn(
        "flex h-10 w-11 items-center justify-center rounded-md border font-mono text-sm font-bold transition hover:scale-[1.02] disabled:cursor-default",
        shiftColorClasses[code],
        hasConflict && "border-red-500 ring-2 ring-red-200",
      )}
    >
      <span>{code === "LEAVE" ? "L" : code}</span>
      {hasConflict ? <AlertTriangle className="ml-0.5 h-3 w-3 text-red-500" /> : null}
    </button>
  );

  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Popover.Root>
          <Tooltip.Trigger asChild>
            <Popover.Trigger asChild>{cell}</Popover.Trigger>
          </Tooltip.Trigger>
          {editable ? (
            <Popover.Portal>
              <Popover.Content
                align="start"
                className="z-50 grid w-48 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
              >
                {shiftOptions.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => onChange(option.code)}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-sm font-semibold transition hover:bg-slate-50",
                      shiftColorClasses[option.code],
                    )}
                  >
                    <span>{option.label}</span>
                    <span className="font-mono">{option.code}</span>
                  </button>
                ))}
              </Popover.Content>
            </Popover.Portal>
          ) : null}
        </Popover.Root>
        <Tooltip.Portal>
          <Tooltip.Content className="z-50 max-w-xs rounded-md bg-[#1A2B4A] px-3 py-2 text-xs text-white shadow-lg">
            <p className="font-semibold">{staffName}</p>
            <p>{formatDateLabel(date)}</p>
            <p>{label}</p>
            {conflictReason ? <p className="mt-1 text-red-200">{conflictReason}</p> : null}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
