"use client";

import {
  ArrowLeftRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarDays,
  Clock,
  ClipboardList,
  DollarSign,
  Home,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { DashboardSidebar, type DashboardNavItem } from "@/components/layout/DashboardSidebar";

const items: DashboardNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/departments", label: "Departments", icon: Building2 },
  { href: "/dashboard/staff", label: "Staff Management", icon: Users },
  { href: "/dashboard/rosters", label: "Duty Rosters", icon: ClipboardList },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  { href: "/dashboard/leave", label: "Leave Management", icon: CalendarDays },
  { href: "/dashboard/swaps", label: "Shift Swaps", icon: ArrowLeftRight },
  { href: "/dashboard/locum-board", label: "Locum Board", icon: UserCheck },
  { href: "/dashboard/payroll", label: "Payroll & Allowances", icon: DollarSign },
  { href: "/dashboard/audit", label: "Audit Trail", icon: ShieldCheck },
  { href: "/dashboard/handover", label: "Handover Reports", icon: BookOpenCheck },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/reports", label: "Reports & Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function HRSidebar() {
  return <DashboardSidebar items={items} badge="HR operations" />;
}
