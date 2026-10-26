import 'server-only';
import type { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { prisma } from './db';
import { sendPush } from './push';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
  imageUrl?: string | null;
  data?: Prisma.InputJsonValue;
  channels?: NotificationChannel[];
}

const DEFAULT_CHANNELS: NotificationChannel[] = ['IN_APP', 'PUSH'];

/**
 * ایجاد اعلان درون‌برنامه‌ای و ارسال آن به گوشی‌های کاربر.
 *
 * ارسال به گوشی منتظر نمی‌ماند: سرور اعلانِ گوگل/اپل ممکن است کند یا از
 * سرور ایرانی در دسترس نباشد و نباید رزرو یا پرداخت را معطل کند.
 */
export async function notify(input: NotifyInput) {
  const channels = input.channels ?? DEFAULT_CHANNELS;

  const record = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      imageUrl: input.imageUrl ?? null,
      data: input.data,
      channels,
      sentAt: new Date(),
    },
  });

  if (channels.includes('PUSH')) {
    void sendPush([input.userId], {
      title: input.title,
      body: input.body,
      url: input.actionUrl,
      image: input.imageUrl,
      tag: record.id,
    }).catch((error) => console.warn('[push] dispatch failed:', error));
  }
  return record;
}

export async function notifyMany(inputs: NotifyInput[]) {
  return Promise.all(inputs.map((i) => notify(i)));
}

export interface BroadcastInput {
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string | null;
  imageUrl?: string | null;
}

/**
 * پیام یکسان برای تعداد زیادی کاربر: ردیف‌ها یک‌جا درج و اعلان گوشی در
 * پس‌زمینه ارسال می‌شود. با notify تک‌تک، اطلاعیه‌ی همگانی برای هزار بازیکن
 * هزار تراکنش جدا می‌شد.
 */
export async function broadcast(input: BroadcastInput): Promise<number> {
  const userIds = [...new Set(input.userIds)];
  if (userIds.length === 0) return 0;

  const now = new Date();
  for (let i = 0; i < userIds.length; i += 1000) {
    await prisma.notification.createMany({
      data: userIds.slice(i, i + 1000).map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        channels: DEFAULT_CHANNELS,
        sentAt: now,
      })),
    });
  }

  void sendPush(userIds, {
    title: input.title,
    body: input.body,
    url: input.actionUrl,
    image: input.imageUrl,
  }).catch((error) => console.warn('[push] broadcast failed:', error));

  return userIds.length;
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
