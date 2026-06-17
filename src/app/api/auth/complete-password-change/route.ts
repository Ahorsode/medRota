import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await prisma.staff.updateMany({
    where: { user_id: user.id },
    data: {
      must_change_password: false,
      password_changed_at: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
