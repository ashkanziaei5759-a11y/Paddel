import {
  Award,
  BadgePercent,
  Banknote,
  Bell,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Crown,
  Handshake,
  LandPlot,
  Layers,
  type LucideIcon,
  Receipt,
  Settings,
  Star,
  Ticket,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * نگاشت مفهوم → آیکون برداری.
 *
 * پیش‌تر در رابط کاربری از ایموجی به‌جای آیکون استفاده می‌شد. ایموجی روی هر
 * سیستم‌عامل شکل متفاوتی دارد، وزن بصری‌اش با تایپوگرافی هماهنگ نیست و برای
 * صفحه‌خوان‌ها نویز تولید می‌کند. آیکون‌های برداری این مشکل‌ها را ندارند.
 */
export const ICONS = {
  booking: CalendarDays,
  court: LandPlot,
  tournament: Trophy,
  wallet: Wallet,
  points: Star,
  users: Users,
  admin: Crown,
  partner: Handshake,
  notification: Bell,
  history: ClipboardList,
  receipt: Receipt,
  revenue: TrendingUp,
  money: Banknote,
  bank: CircleDollarSign,
  ticket: Ticket,
  settings: Settings,
  rank: Award,
  pricing: BadgePercent,
  group: Layers,
  offline: WifiOff,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className,
  strokeWidth = 1.9,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  const Cmp = ICONS[name];
  return <Cmp className={cn('h-5 w-5', className)} strokeWidth={strokeWidth} aria-hidden="true" />;
}
