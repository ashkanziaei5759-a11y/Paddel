import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /* ---- Persian Padel brand: سرمه‌ای + سفید، لیمویی کم ---- */
        /* پالت از متغیرهای CSS خوانده می‌شود تا با تعویض تم، همه‌ی کامپوننت‌ها
           بدون تغییر کلاس‌هایشان عوض شوند. مقادیر به‌صورت «R G B» هستند تا
           پیراینده‌های شفافیت (مثل text-brand-800/60) کار کنند. */
        brand: {
          DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)',
          50: 'rgb(var(--c-brand-50) / <alpha-value>)',
          100: 'rgb(var(--c-brand-100) / <alpha-value>)',
          200: 'rgb(var(--c-brand-200) / <alpha-value>)',
          300: 'rgb(var(--c-brand-300) / <alpha-value>)',
          400: 'rgb(var(--c-brand-400) / <alpha-value>)',
          500: 'rgb(var(--c-brand-500) / <alpha-value>)',
          600: 'rgb(var(--c-brand-600) / <alpha-value>)',
          700: 'rgb(var(--c-brand-700) / <alpha-value>)',
          800: 'rgb(var(--c-brand-800) / <alpha-value>)',
          900: 'rgb(var(--c-brand-900) / <alpha-value>)',
          950: 'rgb(var(--c-brand-950) / <alpha-value>)',
        },
        sky: {
          light: 'rgb(var(--c-sky-light) / <alpha-value>)',
        },
        /* آبی روشن‌ترِ همان خانواده‌ی سرمه‌ای لوگو — حالت فعال و درخشش */
        electric: {
          DEFAULT: '#2F45C8',
          300: '#9AA8F0',
          400: '#5C70DE',
          500: '#2F45C8',
          600: '#24369F',
          700: '#1C2D7D',
          900: '#0C1240',
          950: '#070B26',
        },
        /* رنگ تأکید طبق راهنمای برند پرشین پدل: سفید و آبی رنگ اصلی‌اند و
           زرد لیمویی (رنگ توپ) فقط در جزئیات کوچک. پس فقط DEFAULT/300/400/500
           لیمویی‌اند (نقطه‌ی اعلان، نوار پیشرفت، نشان‌ها)؛ پله‌های کم‌رنگ و
           متنی (۵۰ تا ۲۰۰ و ۶۰۰/۷۰۰) آبی‌اند تا کارت‌ها و برچسب‌ها زرد نشوند. */
        accent: {
          DEFAULT: '#D8DB36',
          50: '#EEF1FB',
          100: '#DCE2F6',
          200: '#BCC6EE',
          300: '#E6E86E',
          400: '#D8DB36',
          500: '#BFC21F',
          600: '#2F45C8',
          700: '#1C2D7D',
        },
        surface: {
          DEFAULT: 'rgb(var(--c-card) / <alpha-value>)',
          muted: 'rgb(var(--c-inset) / <alpha-value>)',
          sunken: 'rgb(var(--c-sunken) / <alpha-value>)',
        },
        /* زمینه‌ی خود صفحه — از inset جداست چون در تم تیره باید تیره‌تر از کارت‌ها باشد */
        app: 'rgb(var(--c-app) / <alpha-value>)',
        'on-accent': 'rgb(var(--c-on-accent) / <alpha-value>)',
        scrim: 'rgb(var(--c-scrim) / <alpha-value>)',
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        'on-primary': 'rgb(var(--c-on-primary) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Dana', 'Vazirmatn', 'IRANSans', 'Tahoma', 'system-ui', 'sans-serif'],
        display: ['Dana', 'Vazirmatn', 'Tahoma', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,45,125,.05), 0 8px 24px -12px rgba(28,45,125,.20)',
        'card-hover': '0 2px 6px rgba(28,45,125,.07), 0 18px 40px -16px rgba(28,45,125,.30)',
        premium: '0 24px 60px -28px rgba(28,45,125,.55)',
        glow: '0 0 0 4px rgba(47,69,200,.16)',
        'glow-electric': '0 0 0 4px rgba(47,69,200,.20)',
        'lift-electric': '0 18px 40px -20px rgba(47,69,200,.65)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.08)',
      },
      backgroundImage: {
        /* سرمه‌ای برند پرشین پدل (C100 M100 Y10 K15) */
        'brand-gradient': 'linear-gradient(135deg,#17236A 0%,#1C2D7D 50%,#2A3FA8 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg,#111A52 0%,#1C2D7D 55%,#26389A 100%)',
        /* لیمویی توپ — فقط برای نشان‌ها و نوارهای کوچک */
        'accent-gradient': 'linear-gradient(135deg,#E6E86E 0%,#D8DB36 55%,#C3C622 100%)',
        'electric-gradient': 'linear-gradient(135deg,#1C2D7D 0%,#2F45C8 60%,#4A60DA 100%)',
        /* زمینه‌ی تیره‌ی کارت‌های شاخص — مثل پس‌زمینه‌ی کاتالوگ برند */
        'night-gradient': 'linear-gradient(150deg,#070B26 0%,#111A52 50%,#1C2D7D 100%)',
        'sky-gradient': 'linear-gradient(160deg,#FFFFFF 0%,#F2F4FB 60%,#DCE2F6 100%)',
        'court-lines':
          'repeating-linear-gradient(90deg, rgba(220,226,246,.08) 0 1px, transparent 1px 64px), repeating-linear-gradient(0deg, rgba(220,226,246,.08) 0 1px, transparent 1px 64px)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(-100%)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(216,219,54,.5)' },
          '70%': { boxShadow: '0 0 0 12px rgba(216,219,54,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(216,219,54,0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.22,.61,.36,1) both',
        'fade-in': 'fade-in .3s ease both',
        'scale-in': 'scale-in .25s cubic-bezier(.22,.61,.36,1) both',
        'slide-up': 'slide-up .3s cubic-bezier(.22,.61,.36,1) both',
        'pulse-ring': 'pulse-ring 2s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
