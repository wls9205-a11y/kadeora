// s273 — /apt 도구 칩 4종.
// 데이터가 0건인 날에도 반드시 보여야 하는 블록이라 히어로 바로 아래 고정 배치한다.

import Link from 'next/link';

const TOOLS = [
  { href: '/apt/diagnose', label: '청약 진단', icon: '🏥', desc: '자격·당첨 확률' },
  { href: '/apt/diagnose#score', label: '가점 계산기', icon: '🧮', desc: '청약 가점 계산' },
  { href: '/apt/map', label: '지도', icon: '🗺️', desc: '위치로 찾기' },
  { href: '/apt/compare', label: '단지 비교', icon: '⚖️', desc: '조건 비교' },
] as const;

export default function AptToolChips() {
  return (
    <nav aria-label="청약 도구" style={{ margin: '0 0 18px', padding: '0 6px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 8,
        }}
      >
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '11px 12px',
              border: '1px solid var(--border, #1e3258)',
              borderRadius: 10,
              background: 'var(--bg-surface, #ffffff)',
              color: 'var(--text-primary, #111827)',
              textDecoration: 'none',
            }}
          >
            <span aria-hidden style={{ fontSize: 19, lineHeight: 1 }}>
              {t.icon}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700 }}>{t.label}</span>
              <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-tertiary, #9ca3af)', marginTop: 1 }}>
                {t.desc}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
