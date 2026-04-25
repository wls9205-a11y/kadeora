'use client';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

type Pill = {
  label: string;
  value: string;
  delta?: string;
  deltaColor?: string;
  href?: string;
};

export default function FeedMarketBar() {
  const { userId } = useAuth();

  const pills: Pill[] = [
    { label: '코스피', value: '2,847', delta: '+1.2%', deltaColor: '#FF4D4D' },
    { label: '코스닥', value: '892', delta: '-0.4%', deltaColor: '#3B7BF6' },
    { label: '오늘청약', value: '3건', delta: '진행중', deltaColor: 'var(--text-tertiary)' },
    userId
      ? { label: '포인트', value: '확인', href: '/profile' }
      : { label: '포인트', value: '가입하기', deltaColor: 'var(--brand)', href: '/login' },
  ];

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    gap: 6,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    marginBottom: 12,
  };
  const pillStyle: React.CSSProperties = {
    padding: '7px 10px',
    background: 'var(--bg-surface)',
    borderRadius: 8,
    border: '1px solid var(--border)',
    flex: '0 0 auto',
    textDecoration: 'none',
    color: 'inherit',
    minWidth: 0,
  };

  return (
    <div style={containerStyle}>
      {pills.map((p, i) => {
        const inner = (
          <>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>
              {p.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                {p.value}
              </span>
              {p.delta && (
                <span style={{ fontSize: 10, fontWeight: 700, color: p.deltaColor ?? 'var(--text-tertiary)' }}>
                  {p.delta}
                </span>
              )}
            </div>
          </>
        );
        return p.href ? (
          <Link key={i} href={p.href} style={pillStyle}>{inner}</Link>
        ) : (
          <div key={i} style={pillStyle}>{inner}</div>
        );
      })}
    </div>
  );
}
