import { NextRequest, NextResponse } from "next/server";
import { getNotifications } from "@/lib/actions/notifications";
import { getSessionUser } from "@/lib/auth/getSessionUser";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const staffId = request.nextUrl.searchParams.get("staffId");
  if (!staffId) return NextResponse.json([]);

  const user = await getSessionUser();
  if (!user || user.staffRecord?.id !== staffId) {
    return NextResponse.json([]);
  }

  const notifications = await getNotifications(staffId, false);
  return NextResponse.json(notifications);
}
