'use client';

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
  type SpringOptions,
} from 'framer-motion';
import {
  Children,
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

/**
 * داک شناور با بزرگ‌نمایی نزدیک نشانگر ماوس.
 *
 * تفاوت مهم با نسخه‌ی اصلی: نسخه‌ی اصلی فقط با hover کار می‌کند و روی موبایل
 * عملاً بی‌اثر است. اینجا بزرگ‌نمایی صرفاً یک بهبود برای دسکتاپ است و روی لمس،
 * اندازه‌ی هدف‌ها ثابت و حداقل ۴۴ پیکسل می‌ماند تا قابل استفاده باشد.
 */

const DOCK_HEIGHT = 112;
const DEFAULT_MAGNIFICATION = 68;
const DEFAULT_DISTANCE = 130;
const DEFAULT_PANEL_HEIGHT = 60;
/** حداقل اندازه‌ی هدف لمسی طبق راهنمای دسترس‌پذیری */
const BASE_ITEM_SIZE = 58;

type DockContextType = {
  mouseX: MotionValue;
  spring: SpringOptions;
  magnification: number;
  distance: number;
  hoverEnabled: boolean;
};

const DockContext = createContext<DockContextType | undefined>(undefined);

function useDock() {
  const context = useContext(DockContext);
  if (!context) throw new Error('useDock باید درون Dock استفاده شود.');
  return context;
}

/** آیا دستگاه واقعاً از hover دقیق پشتیبانی می‌کند؟ */
function useHoverCapable() {
  const [capable, setCapable] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setCapable(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setCapable(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return capable;
}

export function Dock({
  children,
  className,
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  panelHeight = DEFAULT_PANEL_HEIGHT,
}: {
  children: React.ReactNode;
  className?: string;
  spring?: SpringOptions;
  magnification?: number;
  distance?: number;
  panelHeight?: number;
}) {
  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);
  const hoverEnabled = useHoverCapable();

  const maxHeight = useMemo(
    () => Math.max(DOCK_HEIGHT, magnification + magnification / 2 + 4),
    [magnification],
  );

  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div
      style={{ height: hoverEnabled ? height : panelHeight, scrollbarWidth: 'none' }}
      className="flex max-w-full items-end overflow-x-visible"
    >
      <motion.div
        onMouseMove={({ pageX }) => {
          if (!hoverEnabled) return;
          isHovered.set(1);
          mouseX.set(pageX);
        }}
        onMouseLeave={() => {
          if (!hoverEnabled) return;
          isHovered.set(0);
          mouseX.set(Infinity);
        }}
        className={cn('mx-auto flex w-fit items-end gap-1.5 rounded-3xl px-2', className)}
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label="ناوبری اصلی"
      >
        <DockContext.Provider value={{ mouseX, spring, distance, magnification, hoverEnabled }}>
          {children}
        </DockContext.Provider>
      </motion.div>
    </motion.div>
  );
}

export function DockItem({
  children,
  className,
  active = false,
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { distance, magnification, mouseX, spring, hoverEnabled } = useDock();
  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - rect.x - rect.width / 2;
  });

  const widthTransform = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [BASE_ITEM_SIZE, magnification, BASE_ITEM_SIZE],
  );
  const width = useSpring(widthTransform, spring);

  return (
    <motion.div
      ref={ref}
      style={{ width: hoverEnabled ? width : BASE_ITEM_SIZE }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      className={cn(
        'relative inline-flex items-center justify-center',
        /* روی دسکتاپ مربعی می‌ماند تا بزرگ‌نمایی درست کار کند؛ روی لمس، ارتفاع کامل */
        hoverEnabled ? 'aspect-square' : 'h-full',
        className,
      )}
      data-active={active || undefined}
    >
      {Children.map(children, (child) =>
        cloneElement(child as React.ReactElement, { width, isHovered, active } as never),
      )}
    </motion.div>
  );
}

export function DockLabel({
  children,
  className,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const props = rest as Record<string, unknown>;
  const isHovered = props['isHovered'] as MotionValue<number> | undefined;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isHovered) return;
    const unsubscribe = isHovered.on('change', (latest) => setIsVisible(latest === 1));
    return () => unsubscribe();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: -8 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18 }}
          className={cn(
            'absolute -top-8 left-1/2 w-fit whitespace-pre rounded-xl bg-brand-800 px-2.5 py-1 text-[10px] font-bold text-white shadow-card',
            className,
          )}
          role="tooltip"
          style={{ x: '-50%' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DockIcon({
  children,
  className,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const props = rest as Record<string, unknown>;
  const width = props['width'] as MotionValue<number> | undefined;
  const scaled = useTransform(width ?? useMotionValue(BASE_ITEM_SIZE), (val) => val / 2.1);

  return (
    <motion.div
      style={{ width: scaled, height: scaled }}
      className={cn('flex items-center justify-center', className)}
    >
      {children}
    </motion.div>
  );
}
