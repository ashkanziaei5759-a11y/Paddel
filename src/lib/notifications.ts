import 'server-only';
import type { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { prisma } from './db';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
  data?: Prisma.InputJsonValue;
  channels?: NotificationChannel[];
}

/**
 * ایجاد اعلان درون‌برنامه‌ای.
 * لایه‌ی ارسال جداست تا در آینده Push و SMS بدون تغییر در فراخوانی‌ها اضافه شود.
 */
export async function notify(input: NotifyInput) {
  const channels = input.channels ?? (['IN_APP'] as NotificationChannel[]);

  const record = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      data: input.data,
      channels,
      sentAt: new Date(),
    },
  });

  await dispatchExternal(record.id, channels);
  return record;
}

export async function notifyMany(inputs: NotifyInput[]) {
  return Promise.all(inputs.map((i) => notify(i)));
}

/**
 * نقطه‌ی اتصال کانال‌های بیرونی.
 * پیاده‌سازی Push (Web Push / FCM) و SMS در آینده اینجا اضافه می‌شود.
 */
async function dispatchExternal(notificationId: string, channels: NotificationChannel[]) {
  if (channels.includes('PUSH')) {
    // TODO: ارسال Web Push — نیازمند ذخیره‌ی PushSubscription کاربر
  }
  if (channels.includes('SMS')) {
    // TODO: ارسال پیامک از طریق سرویس‌دهنده‌ی پیامکی
  }
  void notificationId;
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
