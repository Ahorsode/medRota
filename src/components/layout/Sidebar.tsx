"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  Home,
  Settings,
  Stethoscope,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/departments", label: "Departments", icon: Building2 },
  { href: "/dashboard/staff", label: "Staff Management", icon: Users },
  { href: "/dashboard/rosters", label: "Duty Rosters", icon: ClipboardList },
  { href: "/dashboard/leave", label: "Leave Management", icon: CalendarDays },
  { href: "/dashboard/swaps", label: "Shift Swaps", icon: ArrowLeftRight },
  { href: "/dashboard/reports", label: "Reports & Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 flex-col bg-[#1A2B4A] text-white lg:flex">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#A8DADC] text-[#1A2B4A]">
          <Stethoscope className="h-6 w-6" />
        </div>
        <div>
          <p className="text-lg font-extrabold">MedRota</p>
          <p className="text-xs text-white/65">SDA Hospital, Koforidua</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-5">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white",
                active && "bg-[#2E86AB] text-white shadow-sm",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="rounded-lg bg-white/8 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UserRoundCheck className="h-4 w-4 text-[#A8DADC]" />
            Dept Head View
          </div>
          <p className="mt-1 text-xs leading-5 text-white/60">Realtime roster workspace ready for Supabase sync.</p>
        </div>
      </div>
    </aside>
  );
}
