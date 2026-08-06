'use client';
// s273b — /apt 인라인 지역 칩.
//
// 이전: 11.5px 회색 '지역 변경 →' 텍스트 링크 → /apt/region 풀 페이지 이동 → 다시 /apt.
//       2페이지 왕복인데다 진입점이 버튼으로 보이지도 않았다.
// 지금: 목록 위에서 바로 전환. 칩마다 청약 건수를 달아 "눌러도 아무것도 없는" 지역을
//       미리 알 수 있게 한다 (17개 시·도 중 청약이 있는 곳은 3곳뿐인 날이 흔하다).
//
// Link 기반이라 client-side 네비게이션 — 전체 리로드 없이 목록만 갱신된다.
// onClick 에서 localStorage 에도 저장해야 RegionAutoSelect 가 다음 방문에
// 예전 지역으로 되돌리지 않는다.

import Link from 'next/link';
import { setStoredRegion } from '@/lib/region-storage';
import { KR_REGIONS_17 } from '@/lib/region-storage';

export interface RegionCount {
  region: string;
  live: number;
  recent: number;
}

type Props = {
  /** RPC 가 준 17개 시·도 집계 (live desc 정렬) */
  regions: RegionCount[];
  /** 실제로 적용된 지역 ('전국' 포함) */
  current: string;
};

const CHIP_BASE: React.CSSProperties = {
  flex: '0 0 auto',
  scrollSnapAlign: 'start',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  minWidth: 58,
  // 44px 이상 확보 — 기존 텍스트 링크는 탭 타겟이 너무 작았다
  minHeight: 46,
  padding: '5px 11px',
  borderRadius: 10,
  textDecoration: 'none',
  border: '1px solid',
  lineHeight: 1.25,
};

export default function RegionChips({ regions, current }: Props) {
  // RPC 가 못 준 지역(공고 이력이 아예 없는 시·도)도 칩은 나와야 한다 — 0 으로 채운다.
  const byName = new Map(regions.map((r) => [r.region, r]));
  const full: RegionCount[] = KR_REGIONS_17.map(
    (name) => byName.get(name) ?? { region: name, live: 0, recent: 0 },
  );

  // 청약 진행 중 → 최근 물량 많은 순 → 이름. 빈 지역은 자연스럽게 뒤로 밀린다.
  full.sort(
    (a, b) => b.live - a.live || b.recent - a.recent || a.region.localeCompare(b.region, 'ko'),
  );

  const liveTotal = full.reduce((s, r) => s + r.live, 0);

  return (
    <section aria-label="지역 선택" style={{ margin: '0 0 14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '0 6px',
          marginBottom: 7,
        }}
      >
        <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--text-primary, #f2f5fa)' }}>
          📍 지역
          {liveTotal > 0 ? (
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary, #8ba3c0)', marginLeft: 6 }}>
              접수중 {liveTotal}건
            </span>
          ) : null}
        </h2>
        <Link
          // 현재 지역을 넘겨 전체 목록에서도 어디를 보고 있는지 표시되게 한다
          href={current === '전국' ? '/apt/region' : `/apt/region?region=${encodeURIComponent(current)}`}
          style={{ fontSize: 11.5, color: 'var(--text-secondary, #b8ccdf)', textDecoration: 'none' }}
        >
          전체 17개 →
        </Link>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          scrollSnapType: 'x proximity',
          WebkitOverflowScrolling: 'touch',
          padding: '2px 6px 6px',
          scrollbarWidth: 'none',
        }}
      >
        {/* 전국 = 시·도 live 의 합. 헤더의 '접수중 N건' 과 같은 값이라 읽는 사람이
            경기1 + 부산1 + 세종1 = 전국3 으로 검산할 수 있다. */}
        <RegionChip name="전국" count={liveTotal} active={current === '전국'} />
        {full.map((r) => (
          <RegionChip
            key={r.region}
            name={r.region}
            count={r.live}
            active={current === r.region}
            dim={r.live === 0}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * 숫자 슬롯에는 '접수중(live)' 하나만 넣는다.
 * live 와 recent 를 같은 자리에 색만 바꿔 넣었더니 '인천 12'(최근 60일)가
 * '경기 1'(접수중)보다 많아 보이는 오독이 생겼다. 색이 의미를 다 짊어지면 안 된다.
 * recent 는 정렬 순서에만 쓰고 화면에는 내보내지 않는다.
 */
function RegionChip({
  name,
  count,
  active,
  dim = false,
}: {
  name: string;
  count: number;
  active: boolean;
  dim?: boolean;
}) {
  const href = name === '전국' ? '/apt' : `/apt?region=${encodeURIComponent(name)}`;

  const style: React.CSSProperties = active
    ? {
        ...CHIP_BASE,
        background: 'var(--text-primary, #f2f5fa)',
        color: 'var(--bg-base, #050a18)',
        borderColor: 'var(--text-primary, #f2f5fa)',
        fontWeight: 700,
      }
    : {
        ...CHIP_BASE,
        background: 'var(--bg-surface, #0d1730)',
        // 접수중 0건 지역도 여전히 누를 수 있는 링크다.
        // --text-disabled 를 쓰면 비활성 컨트롤로 보여서 tertiary 까지만 낮춘다.
        color: dim ? 'var(--text-tertiary, #8ba3c0)' : 'var(--text-primary, #f2f5fa)',
        borderColor: 'var(--border, #1e3258)',
      };

  return (
    <Link
      href={href}
      onClick={() => setStoredRegion(name)}
      aria-current={active ? 'true' : undefined}
      aria-label={count > 0 ? `${name} 접수중 ${count}건` : `${name} 접수중인 청약 없음`}
      style={style}
      scroll={false}
    >
      <span style={{ fontSize: 12.5, fontWeight: active ? 700 : 600 }}>{name}</span>
      <span
        aria-hidden
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: active ? 'var(--bg-base, #050a18)' : '#f87171',
          opacity: active ? 0.75 : 1,
        }}
      >
        {count > 0 ? count : ' '}
      </span>
    </Link>
  );
}
