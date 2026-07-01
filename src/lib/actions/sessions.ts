"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { markStaffFirstLogin } from "@/lib/actions/staff";
import { serializeLoginSession } from "@/lib/actions/serializers";

export async function createLoginSession(data: { user_id: string; staff_id?: string | null }) {
  try {
    const headerStore = await headers();
    const session = await prisma.loginSession.create({
      data: {
        user_id: data.user_id,
        staff_id: data.staff_id ?? null,
        ip_address: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        device: headerStore.get("user-agent"),
      },
    });
    await markStaffFirstLogin(data.user_id);
    return serializeLoginSession(session);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create login session" };
  }
}

export async function closeLoginSession(id: string) {
  try {
    const current = await prisma.loginSession.findUnique({ where: { id } });
    const logoutAt = new Date();
    const durationMinutes = current?.login_at ? Math.max(0, Math.floor((logoutAt.getTime() - current.login_at.getTime()) / 60000)) : null;
    const session = await prisma.loginSession.update({
      where: { id },
      data: { logout_at: logoutAt, duration_minutes: durationMinutes },
    });
    revalidatePath("/dashboard");
    return serializeLoginSession(session);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to close login session" };
  }
}

export async function getRecentLoginSessions(limit = 10) {
  try {
    const sessions = await prisma.loginSession.findMany({
      include: { staff: true },
      orderBy: { login_at: "desc" },
      take: limit,
    });
    return sessions.map(serializeLoginSession);
  } catch {
    return [];
  }
}
