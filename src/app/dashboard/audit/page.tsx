import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { getAuditLogs } from "@/lib/actions/audit";

export const dynamic = "force-dynamic";

const actionVariants: Record<string, "default" | "warning" | "blue" | "success" | "purple" | "danger"> = {
  roster_published: "success",
  roster_submitted: "warning",
  roster_hod_signed: "purple",
  roster_director_signed: "blue",
  roster_entry_updated: "default",
  leave_hr_approved: "success",
  leave_hr_rejected: "danger",
  leave_hod_approved: "blue",
  leave_hod_rejected: "danger",
  staff_created: "purple",
  staff_updated: "blue",
  locum_shift_posted: "warning",
  locum_shift_accepted: "success",
  locum_shift_cancelled: "danger",
};

function labelForAction(action: string) {
  return action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function AuditPage() {
  const logs = await getAuditLogs({ limit: 200 });

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        description="System activity log for roster, leave, staff, and locum workflows."
        actions={<ShieldCheck className="h-5 w-5 text-[#2E86AB]" />}
      />

      <div className="p-5">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-800">Recent Actions</h2>
            <span className="text-sm text-slate-400">{logs.length} entries</span>
          </div>
          <div className="divide-y divide-slate-50">
            {logs.map((log) => (
              <div key={log.id} className="grid gap-3 px-5 py-4 hover:bg-slate-50/70 lg:grid-cols-[190px_1fr_170px]">
                <div>
                  <Badge variant={actionVariants[log.action] ?? "default"}>{labelForAction(log.action)}</Badge>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize text-slate-800">
                    {log.entity_type.replaceAll("_", " ")}
                    {log.entity_id ? <span className="ml-2 font-mono text-xs font-normal text-slate-400">{log.entity_id.slice(0, 8)}</span> : null}
                  </p>
                  {log.new_value ? (
                    <p className="mt-1 truncate font-mono text-xs text-slate-400">{JSON.stringify(log.new_value)}</p>
                  ) : null}
                </div>
                <div className="text-left lg:text-right">
                  <p className="text-xs font-medium text-slate-500">
                    {new Date(log.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(log.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {log.ip_address ? <p className="font-mono text-xs text-slate-300">{log.ip_address}</p> : null}
                </div>
              </div>
            ))}
            {logs.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-400">No audit entries yet.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
