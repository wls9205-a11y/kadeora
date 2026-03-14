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
        // 카더라 브랜드 컬러
        brand: {
          DEFAULT: '#FF4B36',
          50: '#FFF1EF',
          100: '#FFE0DB',
          200: '#FFC1B8',
          300: '#FF9485',
          400: '#FF6B58',
          500: '#FF4B36',
          600: '#E8341F',
          700: '#C22817',
          800: '#9C2014',
          900: '#7A1C12',
        },
        // 다크 UI 기반
        surface: {
          DEFAULT: '#0F0F0F',
          50: '#1A1A1A',
          100: '#252525',
          200: '#2F2F2F',
          300: '#3A3A3A',
        },
        // 주식 컬러
        bull: '#FF4B36',   // 상승 (한국식 빨강)
        bear: '#2563EB',   // 하락 (한국식 파랑)
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      screens: {
        xs: '375px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
      maxWidth: {
        mobile: '430px',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'marquee': 'marquee 20s linear infinite',
        'pulse-brand': 'pulseBrand 2s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          from: { transform: 'translateY(-10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        marquee: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(-100%)' },
        },
        pulseBrand: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,75,54,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(255,75,54,0)' },
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #FF4B36 0%, #FF8C00 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0F0F0F 0%, #1A1A1A 100%)',
      },
    },
  },
  plugins: [],
}

export default config
