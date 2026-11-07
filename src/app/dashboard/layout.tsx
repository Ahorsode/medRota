import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { HODSidebar } from "@/components/layout/HODSidebar";
import { HRSidebar } from "@/components/layout/HRSidebar";
import { StaffSidebar } from "@/components/layout/StaffSidebar";
import { getUnreadCount } from "@/lib/actions/messages";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { SidebarProvider } from "@/lib/context/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.staffRecord?.must_change_password) redirect("/change-password");

  const unreadMessages = user.staffRecord ? await getUnreadCount(user.staffRecord.id) : 0;

  const SidebarComponent =
    user.role === "department_head" || user.role === "medical_director"
      ? HODSidebar
      : user.role === "doctor" || user.role === "nurse" || user.role === "staff"
        ? StaffSidebar
        : HRSidebar;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <SidebarComponent user={user} unreadMessages={unreadMessages} />
        <div className="flex min-w-0 flex-1 flex-col lg:pl-16">
          <Header user={user} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
