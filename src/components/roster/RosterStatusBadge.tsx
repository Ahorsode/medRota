import type { RosterStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const variants: Record<RosterStatus, "default" | "warning" | "blue" | "success" | "purple"> = {
  draft: "default",
  submitted: "warning",
  approved: "blue",
  hod_signed: "purple",
  director_signed: "blue",
  published: "success",
};

export function RosterStatusBadge({ status }: { status: RosterStatus }) {
  return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
}
