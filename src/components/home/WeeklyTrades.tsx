// H4-2 — 홈 「이번 주」 실거래 스트립.
//
// 실거래 72.8만 건이 메인 3화면 어디에도 안 쓰였다. 홈은 매일 봐도 안 바뀌는데
// (큐레이션 4건·재개발 목록은 주 단위로도 잘 안 움직인다) 이 블록만 매일 바뀐다.
//
// ⚠️ 지역 이름을 여기에 «적지 않는다». 라벨은 lib/home/weekly-trades.ts 의
//    tradeRegionLabel() 이 RPC 가 실제로 센 지역에서 조립한다. 경남 수집이 복구되면
//    코드를 고치지 않아도 라벨이 따라와야 한다 — 그게 이 기능의 합격 조건이다.
//
// ⚠️ 「오늘」·「어제」를 쓰지 않는다. 신고 지연이 있어 1일 전은 0건이고 4일 전부터
//    정상화된다. 「어제 N건」은 거짓이 된다. 「이번 주」로 쓰고 기준일을 밝힌다.
//
// ⚠️ prevDeals 를 숫자로 내보내지 않는다. 증감 계산에만 쓴다 (lib 상단 주석).

import Link from 'next/link';
import {
  tradeRegionLabel,
  tradeDeltaPct,
  shortDate,
  type WeeklyTrades as WeeklyTradesData,
} from '@/lib/home/weekly-trades';

export default function WeeklyTrades({ data }: { data: WeeklyTradesData }) {
  const label = tradeRegionLabel(data.byRegion);
  const delta = tradeDeltaPct(data.deals, data.prevDeals);
  const latest = shortDate(data.latestDealDate);
  const cut = shortDate(data.cutoff);

  // 센 지역이 하나도 없으면 「이번 주 …」를 쓸 수 없다.
  if (!label) return null;

  return (
    <section style={{ marginBottom: 18, padding: '0 3px' }}>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-surface)',
          padding: '12px 14px',
        }}
      >
        {/* 라벨 500 — TY1 사다리(라벨·배지·칩). 자간은 14px 이하라 0. */}
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: 0, color: 'var(--text-tertiary)' }}>
          이번 주 {label} 아파트 실거래
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 4 }}>
          {/* 700 — 희소한 수치에만 쓰는 굵기다. 이 화면에서 여기 하나뿐이다. */}
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: -0.4,
              lineHeight: 1.15,
              color: 'var(--text-primary)',
            }}
          >
            {data.deals.toLocaleString('ko-KR')}
          </span>
          <span style={{ fontSize: 13, fontWeight: 400, letterSpacing: 0, color: 'var(--text-secondary)' }}>건</span>

          {/* ⚠️ prevDeals 가 0이면 delta 가 null 이고 배지를 아예 안 낸다.
              「+∞%」나 「신규」로 때우지 않는다. */}
          {delta !== null && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: 0,
                padding: '2px 7px',
                borderRadius: 'var(--radius-pill)',
                background: delta >= 0 ? 'var(--accent-red-bg)' : 'var(--accent-blue-bg)',
                color: delta >= 0 ? 'var(--accent-red)' : 'var(--accent-blue)',
                whiteSpace: 'nowrap',
              }}
            >
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
            </span>
          )}
        </div>

        {/* 지역 분해는 «링크»로 낸다 — /apt/region/[region] 은 경로형 허브라 색인 자산이고,
            홈에서 내부 링크가 그만큼 는다. 순서는 RPC 가 준 건수 순 그대로다.
            ⚠️ 지역이 하나뿐이면 라벨이 이미 그 지역을 말하므로 분해를 생략한다. */}
        {data.byRegion.length > 1 && (
          <nav
            aria-label="시도별 실거래"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }}
          >
            {data.byRegion.map((r) => (
              <Link
                key={r.region}
                href={`/apt/region/${encodeURIComponent(r.region)}`}
                style={{
                  padding: '4px 9px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 12,
                  fontWeight: 400,
                  letterSpacing: 0,
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.region}{' '}
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                  {r.deals.toLocaleString('ko-KR')}
                </span>
              </Link>
            ))}
          </nav>
        )}

        {/* ⚠️ 기준을 «밝히지 않으면» 이 숫자가 오늘 것으로 읽힌다.
            최신 신고일과 집계 상한이 다른 이유(신고 지연)까지 한 줄에 적는다. */}
        <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: 0, color: 'var(--text-tertiary)', marginTop: 8 }}>
          국토부 신고 기준{latest ? ` · 최신 신고 ${latest}` : ''}
          {cut ? ` · 신고 지연 반영해 ${cut}까지 집계` : ''}
        </div>
      </div>
    </section>
  );
}
