import { HODDashboard } from "@/components/dashboard/HODDashboard";
import { HRDashboard } from "@/components/dashboard/HRDashboard";
import { StaffDashboard } from "@/components/dashboard/StaffDashboard";
import { getSessionUser } from "@/lib/auth/getSessionUser";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;

  if (user.role === "department_head" || user.role === "medical_director") {
    return <HODDashboard user={user} />;
  }

  if (user.role === "doctor" || user.role === "nurse" || user.role === "staff") {
    return <StaffDashboard user={user} />;
  }

  return <HRDashboard user={user} />;
}
