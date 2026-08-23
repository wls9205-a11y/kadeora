// v3 커밋5 — 청약 목록 행. s273 카드를 .kd-lrow 3열 그리드로 교체.
//
// 좌: 상태 칩 (선착·무순·D-2·접수중). 기존 D-day 칩은 8건 중 5건이 '상시' 라 정보가 0이었다.
// 가운데: 단지명 + 메타 한 줄 (지역 · 1순위 접수일) + xs 진행 레일.
// 우: 세대수.
//
// ⚠️ 메타 줄에 세대수를 넣지 말 것 — 넣으면 뒤 항목이 항상 잘린다. 세대수는 우측 열이 맡는다.
// ⚠️ 좌측 상태 칩이 생겼으므로 본문 상태 배지는 중복이다 (삭제됨).
// ⚠️ AptHubItem 에는 시공사 필드가 없다 (hub.ts:20). 설계안의 `지역 · 시공사` 중
//    시공사 자리는 1순위 접수일로 채웠다 — 없는 값을 추측해 채우지 않는다.
//    시공사를 넣으려면 get_apt_subscription_hub RPC 에 컬럼 추가가 선행돼야 한다.

import Link from 'next/link';
import { aptHref, type AptHubItem } from '@/lib/apt/hub';
import { formatComplexName, formatRegionShortSafe } from '@/lib/apt/subscription-status';
import { rowStatusChip } from '@/lib/apt/subscription-badge';
import LifecycleRail from '@/components/apt/LifecycleRail';

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  const [, m, day] = d.split('-');
  if (!m || !day) return null;
  return `${Number(m)}/${Number(day)}`;
}

export default function SubscriptionCard({ item }: { item: AptHubItem }) {
  const name = formatComplexName(item.region_nm, item.house_nm);
  const href = aptHref(item);
  const chip = rowStatusChip(item.status, item.dday);

  // 마감 후에만 의미 있는 값 — 접수 전/중에 0.0:1 을 띄우면 오독을 부른다.
  const isAfterReceipt = item.status === 'announced_wait' || item.status === 'contract' || item.status === 'closed';
  const rate = isAfterReceipt && item.competition_rate != null ? Number(item.competition_rate) : null;

  const recept = fmtDate(item.rcept_bgnde);
  const meta = [formatRegionShortSafe(item.region_nm), recept ? `1순위 ${recept}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link href={href} className="kd-lrow" style={{ textDecoration: 'none', color: 'inherit' }}>
      <span className={chip.tone ? `kd-lrow-k ${chip.tone}` : 'kd-lrow-k'}>{chip.label}</span>

      <span style={{ minWidth: 0 }}>
        <span className="kd-lrow-t">{name}</span>
        <span className="kd-lrow-m">
          <span>{meta}</span>
          <span className="kd-lrow-m-fix" style={{ display: 'inline-flex', width: 62 }}>
            <LifecycleRail
              stage={null}
              dates={{
                rcept_bgnde: item.rcept_bgnde,
                rcept_endde: item.rcept_endde,
                spsply_rcept_bgnde: item.spsply_rcept_bgnde,
                przwner_presnatn_de: item.przwner_presnatn_de,
                cntrct_cncls_bgnde: item.cntrct_cncls_bgnde,
                cntrct_cncls_endde: item.cntrct_cncls_endde,
              }}
              size="mini"
            />
          </span>
        </span>
      </span>

      <span className="kd-lrow-r">
        {rate != null ? (
          <>
            {rate.toFixed(1)}
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>:1</span>
          </>
        ) : item.households ? (
          <>
            {item.households.toLocaleString('ko-KR')}
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>세대</span>
          </>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>미공개</span>
        )}
      </span>
    </Link>
  );
}
