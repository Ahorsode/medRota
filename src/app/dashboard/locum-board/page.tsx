import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { LocumBoardClient } from "@/components/locum/LocumBoardClient";
import { getDepartments } from "@/lib/actions/departments";
import { getLocumShifts } from "@/lib/actions/locum";
import { getSessionUser } from "@/lib/auth/getSessionUser";

export const dynamic = "force-dynamic";

export default async function LocumBoardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const departmentFilter = user.role === "department_head" ? user.departmentId ?? undefined : undefined;
  const [allDepartments, shifts] = await Promise.all([getDepartments(), getLocumShifts(departmentFilter)]);
  const departments = departmentFilter ? allDepartments.filter((department) => department.id === departmentFilter) : allDepartments;
  const canPost = user.role === "admin" || user.role === "hr_officer" || user.role === "department_head" || user.role === "medical_director";
  const canAccept = user.staffRecord?.employment_type === "Locum";

  return (
    <div>
      <PageHeader title="Locum Request Board" description="Open shifts, accepted coverage, and department locum requests." />
      <LocumBoardClient
        initialShifts={shifts}
        departments={departments}
        user={{
          userId: user.id,
          role: user.role,
          staffId: user.staffRecord?.id ?? null,
          departmentId: user.departmentId,
          canPost,
          canAccept,
        }}
      />
    </div>
  );
}
