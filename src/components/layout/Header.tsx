"use client";

import { Bell, LogOut, Menu, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { closeLoginSession } from "@/lib/actions/sessions";
import type { SessionUser } from "@/lib/auth/getSessionUser";
import { useSidebar } from "@/lib/context/sidebar";
import { createClient } from "@/lib/supabase/client";

export function Header({ user }: { user?: SessionUser }) {
  const router = useRouter();
  const { setMobileOpen } = useSidebar();

  async function handleLogout() {
    try {
      const sessionId = window.localStorage.getItem("medrota_login_session_id");
      if (sessionId) {
        await closeLoginSession(sessionId);
        window.localStorage.removeItem("medrota_login_session_id");
      }
      await createClient().auth.signOut();
    } catch {
      toast.info("Signed out locally. Supabase keys are not configured yet.");
    }

    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative hidden w-80 md:block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Search staff, rosters, departments..." />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {user ? (
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-bold text-slate-950">{user.staffRecord?.full_name ?? user.email}</p>
            <p className="truncate text-xs capitalize text-slate-500">{user.role.replace("_", " ")}</p>
          </div>
        ) : null}
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
