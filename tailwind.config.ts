import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /* ---- Persian Padel brand ---- */
        brand: {
          DEFAULT: '#003049',
          50: '#E9F3F8',
          100: '#CAF0F8',
          200: '#9BD8E8',
          300: '#63B5CF',
          400: '#2F8AAE',
          500: '#0B5F87',
          600: '#00456A',
          700: '#003049',
          800: '#002438',
          900: '#001824',
          950: '#000F17',
        },
        sky: {
          light: '#CAF0F8',
        },
        /* آبی الکتریک — نمونه‌برداری‌شده از لوگو و پوستر باشگاه.
           رنگ «انرژی» است: حالت فعال، درخشش و تأکیدهای پرشتاب. */
        electric: {
          DEFAULT: '#007FFF',
          300: '#66B2FF',
          400: '#3399FF',
          500: '#007FFF',
          600: '#0064CC',
          700: '#0047A3',
          900: '#000E2A',
          950: '#00071A',
        },
        accent: {
          DEFAULT: '#FCA311',
          50: '#FFF7E8',
          100: '#FFEBC4',
          200: '#FEDA8E',
          300: '#FDC451',
          400: '#FCA311',
          500: '#E08C05',
          600: '#B36E04',
          700: '#8A5403',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F5F9FC',
          sunken: '#EDF4F8',
        },
        success: '#128F63',
        danger: '#D33F3F',
        warning: '#E08C05',
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
        card: '0 1px 2px rgba(0,48,73,.04), 0 8px 24px -12px rgba(0,48,73,.18)',
        'card-hover': '0 2px 6px rgba(0,48,73,.06), 0 18px 40px -16px rgba(0,48,73,.28)',
        premium: '0 24px 60px -28px rgba(0,48,73,.55)',
        glow: '0 0 0 4px rgba(252,163,17,.18)',
        'glow-electric': '0 0 0 4px rgba(0,127,255,.20)',
        'lift-electric': '0 18px 40px -20px rgba(0,127,255,.65)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.08)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg,#003049 0%,#00456A 48%,#0B5F87 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg,#002438 0%,#003049 55%,#014A6E 100%)',
        'accent-gradient': 'linear-gradient(135deg,#FCA311 0%,#E08C05 100%)',
        'electric-gradient': 'linear-gradient(135deg,#0047A3 0%,#007FFF 55%,#3399FF 100%)',
        /* زمینه‌ی تیره‌ی کارت‌های شاخص — هم‌رنگ پوستر باشگاه */
        'night-gradient': 'linear-gradient(150deg,#00071A 0%,#000E2A 45%,#002A55 100%)',
        'sky-gradient': 'linear-gradient(160deg,#FFFFFF 0%,#EDF7FB 60%,#CAF0F8 100%)',
        'court-lines':
          'repeating-linear-gradient(90deg, rgba(202,240,248,.08) 0 1px, transparent 1px 64px), repeating-linear-gradient(0deg, rgba(202,240,248,.08) 0 1px, transparent 1px 64px)',
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
          '0%': { boxShadow: '0 0 0 0 rgba(252,163,17,.45)' },
          '70%': { boxShadow: '0 0 0 12px rgba(252,163,17,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(252,163,17,0)' },
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
