import { cn } from "@/lib/utils/cn";

export function LeaveSpan({ label, length }: { label: string; length: number }) {
  return (
    <div
      className={cn(
        "flex h-10 items-center justify-center rounded-md border border-purple-200 bg-purple-100 px-3 text-center text-xs font-extrabold text-purple-700 shadow-sm",
        length <= 2 && "text-[10px]",
      )}
      style={{ gridColumn: `span ${length}` }}
    >
      {label}
    </div>
  );
}
