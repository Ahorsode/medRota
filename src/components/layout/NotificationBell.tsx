"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types";

function notificationFromUnknown(value: unknown): Notification | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    (record.staff_id !== null && typeof record.staff_id !== "string") ||
    typeof record.title !== "string" ||
    (record.body !== null && record.body !== undefined && typeof record.body !== "string") ||
    typeof record.type !== "string" ||
    typeof record.is_read !== "boolean" ||
    (record.read_at !== null && record.read_at !== undefined && typeof record.read_at !== "string") ||
    (record.link !== null && record.link !== undefined && typeof record.link !== "string") ||
    typeof record.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    staff_id: record.staff_id ?? null,
    title: record.title,
    body: record.body ?? null,
    type: record.type as Notification["type"],
    is_read: record.is_read,
    read_at: record.read_at ?? null,
    link: record.link ?? null,
    created_at: record.created_at,
  };
}

export function NotificationBell({ staffId }: { staffId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    async function loadNotifications() {
      try {
        const response = await fetch(`/api/notifications?staffId=${staffId}`);
        const data: unknown = await response.json();
        if (!mounted || !Array.isArray(data)) return;
        setNotifications(data.map(notificationFromUnknown).filter((item): item is Notification => item !== null));
      } catch {
        if (mounted) setNotifications([]);
      }
    }

    void loadNotifications();

    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`notifications:${staffId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `staff_id=eq.${staffId}`,
          },
          (payload) => {
            const notification = notificationFromUnknown(payload.new);
            if (notification) {
              setNotifications((current) => [notification, ...current]);
            }
          },
        )
        .subscribe();

      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      unsubscribe = undefined;
    }

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [staffId]);

  const unread = notifications.filter((notification) => !notification.is_read).length;

  async function handleMarkAllRead() {
    await markAllNotificationsRead(staffId);
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
        read_at: notification.read_at ?? new Date().toISOString(),
      })),
    );
  }

  async function handleNotificationClick(notification: Notification) {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                is_read: true,
                read_at: item.read_at ?? new Date().toISOString(),
              }
            : item,
        ),
      );
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-full p-2 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-700">Notifications</h3>
            {unread > 0 ? (
              <button type="button" className="text-xs font-semibold text-[#2E86AB] hover:underline" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-80 divide-y divide-slate-50 overflow-y-auto">
            {notifications.slice(0, 10).map((notification) => {
              const content = (
                <div className={`flex gap-3 px-4 py-3 text-sm ${notification.is_read ? "bg-white" : "bg-blue-50/50"}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${notification.is_read ? "text-slate-600" : "text-slate-900"}`}>
                      {notification.title}
                    </p>
                    {notification.body ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{notification.body}</p> : null}
                    <p className="mt-1 text-xs text-slate-300">{new Date(notification.created_at).toLocaleString()}</p>
                  </div>
                  {!notification.is_read ? <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2E86AB]" /> : null}
                </div>
              );

              return notification.link ? (
                <Link key={notification.id} href={notification.link} onClick={() => void handleNotificationClick(notification)}>
                  {content}
                </Link>
              ) : (
                <button
                  key={notification.id}
                  type="button"
                  className="block w-full text-left"
                  onClick={() => void handleNotificationClick(notification)}
                >
                  {content}
                </button>
              );
            })}
            {notifications.length === 0 ? <div className="px-4 py-8 text-center text-sm text-slate-400">No notifications</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
