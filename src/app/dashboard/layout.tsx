import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/lib/context/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col lg:pl-16">
          <Header />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
