"use client";

import {
  ArrowLeftRight,
  BriefcaseMedical,
  CalendarDays,
  CalendarOff,
  Clock,
  LayoutDashboard,
  MessageSquare,
  UserCircle,
} from "lucide-react";
import { DashboardSidebar, type DashboardNavItem } from "@/components/layout/DashboardSidebar";
import type { SessionUser } from "@/lib/auth/getSessionUser";

const items: DashboardNavItem[] = [
  { href: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/my-schedule", label: "My Schedule", icon: CalendarDays },
  { href: "/dashboard/my-leave", label: "My Leave", icon: CalendarOff },
  { href: "/dashboard/my-swaps", label: "Shift Swaps", icon: ArrowLeftRight },
  { href: "/dashboard/my-attendance", label: "My Attendance", icon: Clock },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/my-profile", label: "My Profile", icon: UserCircle },
];

export function StaffSidebar({ user }: { user: SessionUser }) {
  const navItems =
    user.staffRecord?.employment_type === "Locum"
      ? [...items, { href: "/dashboard/locum-board", label: "Locum Board", icon: BriefcaseMedical }]
      : items;

  return <DashboardSidebar items={navItems} badge={user.staffRecord?.department_name ?? "Staff portal"} />;
}
