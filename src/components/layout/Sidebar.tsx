"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MouseEvent, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ArrowLeftRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarDays,
  Clock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Home,
  MessageSquare,
  Settings,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/lib/context/sidebar";
import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/departments", label: "Departments", icon: Building2 },
  { href: "/dashboard/staff", label: "Staff Management", icon: Users },
  { href: "/dashboard/rosters", label: "Duty Rosters", icon: ClipboardList },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  { href: "/dashboard/leave", label: "Leave Management", icon: CalendarDays },
  { href: "/dashboard/swaps", label: "Shift Swaps", icon: ArrowLeftRight },
  { href: "/dashboard/handover", label: "Handover Reports", icon: BookOpenCheck },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/reports", label: "Reports & Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { mobileOpen, setMobileOpen, collapsed, setCollapsed } = useSidebar();
  const [hovered, setHovered] = useState(false);
  const expanded = mobileOpen || !collapsed || hovered;

  function toggleFromEmptySpace(event: MouseEvent<HTMLElement>) {
    if (event.target === event.currentTarget) {
      setCollapsed(!collapsed);
    }
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation backdrop"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={toggleFromEmptySpace}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col bg-[#1A2B4A] text-white shadow-2xl transition-all duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          expanded ? "lg:w-72" : "lg:w-16",
        )}
      >
        <div
          className={cn("flex h-20 items-center gap-3 border-b border-white/10 px-4", !expanded && "lg:justify-center lg:px-2")}
          onClick={toggleFromEmptySpace}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#A8DADC] text-[#1A2B4A]">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div className={cn("min-w-0", !expanded && "lg:hidden")}>
            <p className="text-lg font-extrabold">MedRota</p>
            <p className="truncate text-xs text-white/65">SDA Hospital, Koforidua</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-white hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <Tooltip.Provider delayDuration={150}>
          <nav className="flex flex-1 flex-col gap-1 px-3 py-5" onClick={toggleFromEmptySpace}>
            {items.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              const navItem = (
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white",
                    active && "bg-[#2E86AB] text-white shadow-sm",
                    !expanded && "lg:justify-center lg:px-0",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn(!expanded && "lg:hidden")}>{item.label}</span>
                </Link>
              );

              return !expanded ? (
                <Tooltip.Root key={item.href}>
                  <Tooltip.Trigger asChild>{navItem}</Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content side="right" className="z-50 rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white">
                      {item.label}
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              ) : (
                <div key={item.href}>{navItem}</div>
              );
            })}
          </nav>
        </Tooltip.Provider>
        <div className="border-t border-white/10 p-3">
          <Button
            variant="ghost"
            className={cn("hidden w-full justify-center text-white hover:bg-white/10 hover:text-white lg:flex", expanded && "justify-between")}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className={cn("text-sm font-semibold", !expanded && "hidden")}>{collapsed ? "Expand" : "Collapse"}</span>
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        </div>
      </aside>
    </>
  );
}
