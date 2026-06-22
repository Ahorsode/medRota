import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ error: "Missing phone parameter" }, { status: 400 });
  }

  // Find a staff record with this phone number
  const staff = await prisma.staff.findFirst({
    where: { phone: phone.trim(), is_active: true },
    select: { email: true },
  });

  if (!staff || !staff.email) {
    return NextResponse.json({ error: "No staff record found with this phone number" }, { status: 404 });
  }

  return NextResponse.json({ email: staff.email });
}
