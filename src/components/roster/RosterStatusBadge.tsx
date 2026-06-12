import type { RosterStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const variants: Record<RosterStatus, "default" | "warning" | "blue" | "success"> = {
  draft: "default",
  submitted: "warning",
  approved: "blue",
  published: "success",
};

export function RosterStatusBadge({ status }: { status: RosterStatus }) {
  return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
}
