import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { MyScheduleCalendar } from "@/components/staff/MyScheduleCalendar";
import { getRosterEntriesForStaff } from "@/lib/actions/rosters";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { monthNames } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export default async function MySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const user = await getSessionUser();
  if (!user?.staffRecord) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const month = Number(params.month ?? now.getMonth() + 1);
  const year = Number(params.year ?? now.getFullYear());
  const entries = await getRosterEntriesForStaff(user.staffRecord.id, year, month);

  return (
    <div>
      <PageHeader
        title="My Schedule"
        description={`Your duty roster for ${monthNames[month - 1]} ${year}.`}
      />
      <div className="p-5">
        <MyScheduleCalendar entries={entries} month={month} year={year} staffId={user.staffRecord.id} />
      </div>
    </div>
  );
}
