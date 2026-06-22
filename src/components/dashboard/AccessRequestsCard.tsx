"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, UserPlus, Trash2, Clock, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolveAccessRequest } from "@/lib/actions/accessRequests";
import type { AccessRequest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

function accessRequestFromUnknown(value: unknown): AccessRequest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.attempted_email !== "string" ||
    typeof record.status !== "string" ||
    typeof record.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    attempted_email: record.attempted_email,
    google_name: (record.google_name as string) || null,
    status: record.status as AccessRequest["status"],
    resolved_by: (record.resolved_by as string) || null,
    resolved_at: (record.resolved_at as string) || null,
    created_at: record.created_at,
  };
}

export function AccessRequestsCard({
  initialRequests,
  resolvedByUserId,
}: {
  initialRequests: AccessRequest[];
  resolvedByUserId: string;
}) {
  const [requests, setRequests] = useState<AccessRequest[]>(initialRequests);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      const supabase = createClient();
      const channel = supabase
        .channel("access_requests_realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "access_requests",
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const req = accessRequestFromUnknown(payload.new);
              if (req && req.status === "pending") {
                setRequests((current) => {
                  if (current.some((r) => r.id === req.id)) return current;
                  return [req, ...current];
                });
              }
            } else if (payload.eventType === "UPDATE") {
              const req = accessRequestFromUnknown(payload.new);
              if (req) {
                if (req.status !== "pending") {
                  setRequests((current) => current.filter((r) => r.id !== req.id));
                } else {
                  setRequests((current) =>
                    current.map((r) => (r.id === req.id ? req : r))
                  );
                }
              }
            }
          }
        )
        .subscribe();

      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      unsubscribe = undefined;
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  async function handleDismiss(id: string) {
    setActionLoadingId(id);
    const result = await resolveAccessRequest(id, resolvedByUserId, true);
    setActionLoadingId(null);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Access request dismissed.");
      setRequests((current) => current.filter((r) => r.id !== id));
    }
  }

  async function handleResolve(id: string) {
    // Resolve manually without dismissing
    setActionLoadingId(id);
    const result = await resolveAccessRequest(id, resolvedByUserId, false);
    setActionLoadingId(null);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Access request marked as resolved.");
      setRequests((current) => current.filter((r) => r.id !== id));
    }
  }

  if (requests.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/20 shadow-md">
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-base text-slate-800 font-bold">
            Pending Access Requests ({requests.length})
          </CardTitle>
          <p className="text-xs text-slate-500">
            Unregistered users tried to log in using Google. Review and provision credentials if authorized.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-amber-100/50">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between first:pt-0 last:pb-0"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {request.attempted_email}
                </p>
                {request.google_name && (
                  <p className="text-xs text-slate-500">
                    Google Name: {request.google_name}
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(request.created_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Link
                  href={`/dashboard/staff?email=${encodeURIComponent(
                    request.attempted_email
                  )}&name=${encodeURIComponent(request.google_name || "")}`}
                >
                  <Button
                    size="sm"
                    className="gap-1.5 bg-[#1A2B4A] hover:bg-[#2A3B5A] text-white"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Go to Staff → Add Email
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  onClick={() => handleResolve(request.id)}
                  disabled={actionLoadingId === request.id}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Mark Resolved
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => handleDismiss(request.id)}
                  disabled={actionLoadingId === request.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
