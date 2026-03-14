import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FF4B36',
          light: '#FF6B58',
          dark: '#E8341F',
        },
        bull: '#E8341F',
        bear: '#2563EB',
        surface: {
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
        },
      },
      fontFamily: {
        pretendard: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      maxWidth: {
        mobile: '430px',
      },
      spacing: {
        'bottom-nav': '64px',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      },
      animation: {
        'spin-slow': 'spin 0.6s linear infinite',
        'slide-up': 'slideUp 0.3s ease-out both',
        'fade-in': 'fadeIn 0.25s ease-out both',
        'ticker': 'ticker 30s linear infinite',
        'pulse-soft': 'pulse 2.4s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'float-badge': 'floatBadge 2s ease-in-out infinite',
        'legend-pulse': 'legendPulse 2s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        ticker: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' },
        },
        floatBadge: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-3px) scale(1.06)' },
        },
        legendPulse: {
          '0%, 100%': { boxShadow: '0 0 12px 3px #FFD70066, 0 0 32px 8px #F59E0B33' },
          '50%': { boxShadow: '0 0 24px 8px #FFD700AA, 0 0 56px 16px #F59E0B66' },
        },
      },
    },
  },
  plugins: [],
}

export default config
