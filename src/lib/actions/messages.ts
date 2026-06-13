"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeMessage, serializeMessageRecipient } from "@/lib/actions/serializers";

export async function getMessages(staffId: string) {
  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ sender_id: staffId }, { recipients: { some: { staff_id: staffId } } }],
      },
      include: {
        sender: true,
        recipients: { include: { staff: true } },
      },
      orderBy: { created_at: "desc" },
    });
    return messages.map(serializeMessage);
  } catch {
    return [];
  }
}

export async function getUnreadCount(staffId: string) {
  try {
    return prisma.messageRecipient.count({
      where: { staff_id: staffId, is_read: false },
    });
  } catch {
    return 0;
  }
}

export async function sendMessage(data: {
  sender_id: string;
  subject?: string;
  body: string;
  recipient_ids: string[];
  message_type?: string;
  department_id?: string;
}) {
  try {
    const { recipient_ids, ...messageData } = data;
    const message = await prisma.message.create({
      data: {
        ...messageData,
        recipients: {
          create: recipient_ids.map((staff_id) => ({ staff_id })),
        },
      },
      include: { sender: true, recipients: { include: { staff: true } } },
    });
    revalidatePath("/dashboard/messages");
    return serializeMessage(message);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to send message" };
  }
}

export async function markMessageRead(messageId: string, staffId: string) {
  try {
    const recipient = await prisma.messageRecipient.update({
      where: { message_id_staff_id: { message_id: messageId, staff_id: staffId } },
      data: { is_read: true, read_at: new Date() },
      include: { staff: true },
    });
    revalidatePath("/dashboard/messages");
    return serializeMessageRecipient(recipient);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to mark message read" };
  }
}
