'use client';
import Link from 'next/link';

interface Props {
  category: string;
  tags?: string[];
  sourceRef?: string | null;
}

const WIDGET_CONFIG: Record<string, { title: string; desc: string; href: string; icon: string; cta: string }[]> = {
  apt: [
    { title: '아파트 검색', desc: '관심 단지의 실거래가·시세를 확인하세요', href: '/apt/search', icon: '🔍', cta: '단지 검색하기' },
    { title: '청약 캘린더', desc: '이번 달 청약 일정 한눈에 보기', href: '/apt', icon: '📅', cta: '청약 일정 보기' },
  ],
  stock: [
    { title: '종목 시세', desc: '실시간 시세와 AI 분석을 확인하세요', href: '/stock', icon: '📈', cta: '종목 보기' },
    { title: '투자 계산기', desc: '수익률·세금 계산을 해보세요', href: '/calc', icon: '🧮', cta: '계산기 열기' },
  ],
  unsold: [
    { title: '미분양 현황', desc: '전국 미분양 아파트를 지역별로 확인', href: '/apt/search', icon: '🏚️', cta: '미분양 검색' },
    { title: '청약 가점 계산', desc: '내 가점으로 당첨 가능성 확인', href: '/apt/diagnose', icon: '✅', cta: '가점 계산하기' },
  ],
  finance: [
    { title: '금융 계산기', desc: '대출·이자·연금·절세 계산을 한곳에서', href: '/calc', icon: '🧮', cta: '계산기 모음' },
    { title: '주식 시세', desc: '관심 종목 시세와 AI 투자 분석', href: '/stock', icon: '📈', cta: '종목 보기' },
  ],
};

const DEFAULT_WIDGETS = [
  { title: '카더라 둘러보기', desc: '주식·부동산·청약 정보를 한곳에서', href: '/feed', icon: '🏠', cta: '피드 보기' },
  { title: '계산기', desc: '대출·수익률·세금 계산', href: '/calc', icon: '🧮', cta: '계산기 열기' },
];

export default function BlogServiceWidget({ category, tags, sourceRef }: Props) {
  const widgets = WIDGET_CONFIG[category] || DEFAULT_WIDGETS;

  return (
    <div style={{
      margin: '24px 0 16px',
      padding: '16px',
      borderRadius: 'var(--radius-card)',
      background: 'linear-gradient(135deg, rgba(59,123,246,0.04), rgba(16,185,129,0.04))',
      border: '1px solid rgba(59,123,246,0.1)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>
        📌 관련 서비스
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {widgets.map((w) => (
          <Link key={w.href} href={w.href} style={{
            display: 'block', padding: '12px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            textDecoration: 'none', transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ fontSize: 14, marginBottom: 4 }}>
              <span>{w.icon}</span>{' '}
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{w.title}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, lineHeight: 1.4 }}>{w.desc}</div>
            <div style={{
              fontSize: 12, fontWeight: 700, color: 'var(--brand)',
            }}>{w.cta} →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
