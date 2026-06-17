const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending_hod: { label: "Awaiting HOD", className: "bg-amber-100 text-amber-700" },
  pending_hr: { label: "Awaiting HR", className: "bg-blue-100 text-blue-700" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  rejected_hod: { label: "Rejected by HOD", className: "bg-red-100 text-red-700" },
  rejected_hr: { label: "Rejected by HR", className: "bg-red-100 text-red-700" },
};

export function LeaveStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
