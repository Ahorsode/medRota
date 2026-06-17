"use server";

import { revalidatePath } from "next/cache";
import { serializeNotification } from "@/lib/actions/serializers";
import { getSessionUser, type UserRoleName } from "@/lib/auth/getSessionUser";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/lib/types";

const privilegedRoles: UserRoleName[] = ["admin", "hr_officer", "department_head", "medical_director"];
const notificationTypes: NotificationType[] = ["info", "success", "warning", "error", "leave", "roster", "swap", "message"];

function normalizeType(type: string | undefined): NotificationType {
  if (type && notificationTypes.includes(type as NotificationType)) {
    return type as NotificationType;
  }

  return "info";
}

async function canAccessStaffNotifications(staffId: string) {
  const user = await getSessionUser();
  if (!user) return false;
  if (user.staffRecord?.id === staffId) return true;
  return privilegedRoles.includes(user.role);
}

export async function createNotification(data: {
  staff_id: string;
  title: string;
  body?: string;
  type?: string;
  link?: string;
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        staff_id: data.staff_id,
        title: data.title,
        body: data.body,
        type: normalizeType(data.type),
        link: data.link,
      },
    });

    return serializeNotification(notification);
  } catch {
    return undefined;
  }
}

export async function getNotifications(staffId: string, unreadOnly = false) {
  try {
    if (!(await canAccessStaffNotifications(staffId))) return [];

    const notifications = await prisma.notification.findMany({
      where: {
        staff_id: staffId,
        ...(unreadOnly ? { is_read: false } : {}),
      },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    return notifications.map(serializeNotification);
  } catch {
    return [];
  }
}

export async function markNotificationRead(id: string) {
  try {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification?.staff_id) return;
    if (!(await canAccessStaffNotifications(notification.staff_id))) return;

    await prisma.notification.update({
      where: { id },
      data: { is_read: true, read_at: new Date() },
    });

    revalidatePath("/dashboard");
  } catch {
    // Notification read state should not block navigation.
  }
}

export async function markAllNotificationsRead(staffId: string) {
  try {
    if (!(await canAccessStaffNotifications(staffId))) return;

    await prisma.notification.updateMany({
      where: { staff_id: staffId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });

    revalidatePath("/dashboard");
  } catch {
    // Notification read state should not block navigation.
  }
}
