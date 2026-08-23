import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { PlayerLevel, Role } from '@prisma/client';
import { prisma } from '@/lib/db';

export const SESSION_COOKIE = 'pp_session';
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'AUTH_SECRET تعریف نشده یا کوتاه است. یک کلید تصادفی حداقل ۳۲ کاراکتری در .env قرار دهید.',
    );
  }
  return new TextEncoder().encode(secret);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionUser {
  id: string;
  username: string;
  role: Role;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
  level: PlayerLevel;
  points: number;
  phone: string | null;
  phoneVerified: boolean;
}

interface JwtPayload {
  sub: string;
  sid: string;
  role: Role;
}

/** ساخت نشست جدید: رکورد در پایگاه داده + کوکی امضاشده و HttpOnly */
export async function createSession(
  userId: string,
  role: Role,
  meta?: { userAgent?: string | null; ip?: string | null },
): Promise<void> {
  const rawToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
      userAgent: meta?.userAgent ?? null,
      ip: meta?.ip ?? null,
    },
  });

  const jwt = await new SignJWT({ sub: userId, sid: session.id, role } satisfies JwtPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('persian-padel')
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, `${jwt}.${rawToken}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

async function readCookieToken(): Promise<{ jwt: string; raw: string } | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const idx = value.lastIndexOf('.');
  if (idx < 0) return null;
  return { jwt: value.slice(0, idx), raw: value.slice(idx + 1) };
}

/** کاربر جاری یا null — منبع حقیقت پایگاه داده است نه محتوای توکن */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const parts = await readCookieToken();
  if (!parts) return null;

  let payload: JwtPayload;
  try {
    const verified = await jwtVerify(parts.jwt, secretKey(), { issuer: 'persian-padel' });
    payload = verified.payload as unknown as JwtPayload;
  } catch {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    include: { user: { include: { profile: true } } },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (session.tokenHash !== hashToken(parts.raw)) return null;
  if (session.userId !== payload.sub) return null;

  const { user } = session;
  if (!user || user.status !== 'ACTIVE' || !user.profile) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    firstName: user.profile.firstName,
    lastName: user.profile.lastName,
    fullName: `${user.profile.firstName} ${user.profile.lastName}`.trim(),
    avatarUrl: user.profile.avatarUrl,
    level: user.profile.level,
    points: user.profile.points,
    phone: user.phone,
    phoneVerified: Boolean(user.phoneVerifiedAt),
  };
}

export async function destroySession(): Promise<void> {
  const parts = await readCookieToken();
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  if (!parts) return;
  try {
    const verified = await jwtVerify(parts.jwt, secretKey(), { issuer: 'persian-padel' });
    const payload = verified.payload as unknown as JwtPayload;
    await prisma.session.updateMany({
      where: { id: payload.sid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    /* کوکی نامعتبر — چیزی برای ابطال نیست */
  }
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
