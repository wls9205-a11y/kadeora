import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '지역 선택 — 카더라 부동산',
  description: '서울, 경기, 부산 등 17개 시·도별 청약·분양·미분양·재개발 단지 정보',
  alternates: { canonical: 'https://kadeora.app/apt/region' },
};

const SIDOS = [
  { name: '서울', emoji: '🏙️' }, { name: '경기', emoji: '🏘️' }, { name: '인천', emoji: '🌉' },
  { name: '부산', emoji: '🌊' }, { name: '대구', emoji: '🌆' }, { name: '대전', emoji: '🏛️' },
  { name: '광주', emoji: '🎨' }, { name: '울산', emoji: '🏭' }, { name: '세종', emoji: '🏗️' },
  { name: '강원', emoji: '⛰️' }, { name: '충북', emoji: '🌳' }, { name: '충남', emoji: '🌾' },
  { name: '전북', emoji: '🌿' }, { name: '전남', emoji: '🌲' }, { name: '경북', emoji: '🍎' },
  { name: '경남', emoji: '🌅' }, { name: '제주', emoji: '🌴' },
];

export default function RegionListPage() {
  const cardStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 4, padding: '14px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 12, textDecoration: 'none', color: 'inherit', aspectRatio: '1.4 / 1',
  };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' };
  const emojiStyle: React.CSSProperties = { fontSize: 22 };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px var(--sp-lg)' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>지역 선택</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        17개 시·도별 청약·분양·미분양·재개발 단지 정보
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        <Link href="/apt?region=전국" style={cardStyle}>
          <span aria-hidden style={emojiStyle}>🇰🇷</span>
          <span style={labelStyle}>전국</span>
        </Link>
        {SIDOS.map(s => (
          <Link key={s.name} href={`/apt?region=${encodeURIComponent(s.name)}`} style={cardStyle}>
            <span aria-hidden style={emojiStyle}>{s.emoji}</span>
            <span style={labelStyle}>{s.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
