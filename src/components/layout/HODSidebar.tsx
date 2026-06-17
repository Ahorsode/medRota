"use client";

import {
  ArrowLeftRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  CalendarOff,
  Clock,
  LayoutDashboard,
  MessageSquare,
  UserCheck,
  Users,
} from "lucide-react";
import { DashboardSidebar, type DashboardNavItem } from "@/components/layout/DashboardSidebar";
import type { SessionUser } from "@/lib/auth/getSessionUser";

const items: DashboardNavItem[] = [
  { href: "/dashboard", label: "My Department", icon: LayoutDashboard },
  { href: "/dashboard/rosters", label: "Duty Roster", icon: CalendarDays },
  { href: "/dashboard/staff", label: "My Staff", icon: Users },
  { href: "/dashboard/leave", label: "Leave Requests", icon: CalendarOff },
  { href: "/dashboard/swaps", label: "Shift Swaps", icon: ArrowLeftRight },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  { href: "/dashboard/handover", label: "Handover Reports", icon: BookOpenCheck },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/reports", label: "Department Reports", icon: BarChart3 },
  { href: "/dashboard/locum-board", label: "Locum Board", icon: UserCheck },
];

export function HODSidebar({ user }: { user: SessionUser }) {
  const badge =
    user.role === "medical_director"
      ? "Hospital-wide director view"
      : `Managing: ${user.staffRecord?.department_name ?? "Department"}`;

  return <DashboardSidebar items={items} badge={badge} />;
}
