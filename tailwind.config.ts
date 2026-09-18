import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  // s273-cc Issue C fix: darkMode 'class' 명시 — TSX 의 dark: 119건 변형이 prod CSS 에 컴파일되도록.
  // 이전엔 darkMode 미설정 → Tailwind v3+ default media 모드 → .dark\: 0건 컴파일.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1E40AF',
          light: '#3B82F6',
          dark: '#1E3A8A',
        },
        navy: {
          50: '#F0F4FA',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1E40AF',
          800: '#1E3A5F',
          900: '#0F1D35',
          950: '#0B1426',
        },
        bull: '#EF4444',
        bear: '#3B82F6',
        surface: {
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
        },
      },
      /* TY3 T4-0 테일윈드 브리지 (FINAL_TYFB_20260918 §4 · 판정 증분-2).
         기본 스케일(xs 12 · sm 14 · base 16 …)이 --fs 사다리와 «제3 체계» 로 병존했다.
         사용 실측 7키만 사다리로 재정의해 유틸 ~360건을 무치환 수렴시킨다.
         ⛔ theme.fontSize 통째 교체 금지 — 미매핑 기본 키(4xl·5xl 등)가 사라진다. extend 만 쓴다.
         ⚠️ 매핑은 «렌더 기준» 이다. text-xs 는 globals.css 가드가 14px 로 끌어올리고 있었다
            (그래서 --fs-2xs 가 아니라 --fs-xs). 그 가드 줄은 이 커밋에서 같이 걷었다.
         각 키는 [크기, { lineHeight }] 튜플 — 기본 lh 동봉이 사라지지 않게 행간 사다리
         {1, 1.3, 1.5, 1.6} 의 최근접 값을 싣는다(기본 lh 비율 기준). */
      fontSize: {
        xs: ['var(--fs-xs)', { lineHeight: '1.3' }],
        sm: ['var(--fs-xs)', { lineHeight: '1.5' }],
        base: ['var(--fs-sm)', { lineHeight: '1.5' }],
        lg: ['var(--fs-base)', { lineHeight: '1.6' }],
        xl: ['var(--fs-md)', { lineHeight: '1.3' }],
        '2xl': ['var(--fs-xl)', { lineHeight: '1.3' }],
        '3xl': ['var(--fs-2xl)', { lineHeight: '1.3' }],
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
