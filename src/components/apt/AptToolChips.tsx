// s273 — /apt 도구 칩 4종.
// 데이터가 0건인 날에도 반드시 보여야 하는 블록이라 히어로 바로 아래 고정 배치한다.

import Link from 'next/link';

const TOOLS = [
  { href: '/apt/diagnose', label: '청약 진단', icon: '🏥', desc: '자격·당첨 확률' },
  { href: '/apt/diagnose#score', label: '가점 계산기', icon: '🧮', desc: '청약 가점 계산' },
  { href: '/apt/map', label: '지도', icon: '🗺️', desc: '위치로 찾기' },
  { href: '/apt/compare', label: '단지 비교', icon: '⚖️', desc: '조건 비교' },
] as const;

type Props = {
  /** 현재 선택된 시·도. '전국' 이면 재개발 허브 인덱스로 보낸다. */
  region?: string;
};

// s274 — /apt/redev/{지역} 은 네이버 유입 2위(30일 188건, 울산 단독 99건) 인데
// 드로어 메뉴에서 한 번 링크될 뿐 /apt 본문에서 연결되지 않았다. 지역 문맥을 살려 붙인다.
export default function AptToolChips({ region }: Props = {}) {
  const redevHref =
    region && region !== '전국' ? `/apt/redev/${encodeURIComponent(region)}` : '/apt/redev';
  // v5-V1: 좌측 Sidebar 의 부동산 분류 중 '전용 라우트가 있는' 두 개를 여기로 옮겼다.
  //   (상태로 표현되는 접수중·임박·무순위는 AptStatusChips 가 받는다.
  //    '모델하우스' 는 데이터가 없어 옮기지 않았다 — 없는 필터를 만들지 않는다.)
  const tools = [
    ...TOOLS,
    {
      href: redevHref,
      label: region && region !== '전국' ? `${region} 재개발` : '재개발·재건축',
      icon: '🏗️',
      desc: '정비사업 단계·현황',
    },
    { href: '/apt/unsold', label: '미분양·줍줍', icon: '⚠️', desc: '전국 미분양 현황' },
    { href: '/apt/complex', label: '실거래·시세', icon: '📊', desc: '단지 백과·실거래' },
  ];

  return (
    <nav aria-label="청약 도구" style={{ margin: '0 0 18px', padding: '0 6px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 8,
        }}
      >
        {tools.map((t) => (
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
            <span aria-hidden style={{ fontSize: 'var(--fs-md)', lineHeight: 1 }}>
              {t.icon}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 700 }}>{t.label}</span>
              <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary, #9ca3af)', marginTop: 1 }}>
                {t.desc}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
