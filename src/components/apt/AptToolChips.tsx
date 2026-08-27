// s273 — /apt 도구 칩 4종.
// 데이터가 0건인 날에도 반드시 보여야 하는 블록이라 히어로 바로 아래 고정 배치한다.

import Link from 'next/link';

const TOOLS = [
  { href: '/apt/diagnose', label: '청약 진단', icon: '🏥', desc: '자격·당첨 확률' },
  { href: '/apt/diagnose#score', label: '가점 계산기', icon: '🧮', desc: '청약 가점 계산' },
  /* ⛔ H6-2 후속 — 「지도」 칩 제거. 레일 바로가기와 «같은 이유» 다:
     H5-2 에서 [목록|지도] 토글을 내렸는데 진입점이 남아 「지도가 이 사이트의 기능」이라고
     계속 말하고 있었다. 부울경 정비사업 179곳 중 169곳에 주소·동이 없어 지도가 비어 보인다.
     /apt/map 라우트는 그대로다(200 + noindex). */
  { href: '/apt/compare', label: '단지 비교', icon: '⚖️', desc: '조건 비교' },
  // F1: big-events(청약 캘린더)가 만들어져 있는데 /apt 에서 갈 길이 없었다.
  //     새 화면을 만드는 게 아니라 «이미 있는 것을 잇는» 작업이다.
  { href: '/apt/big-events', label: '청약 캘린더', icon: '📅', desc: '이번 달 일정' },
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
              border: '1px solid var(--border)',
              borderRadius: 10,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              textDecoration: 'none',
            }}
          >
            <span aria-hidden style={{ fontSize: 'var(--fs-md)', lineHeight: 1 }}>
              {t.icon}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>{t.label}</span>
              <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>
                {t.desc}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
