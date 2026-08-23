// v3 커밋5 — 청약 목록 행. s273 카드를 .kd-lrow 3열 그리드로 교체.
//
// 좌: 상태 칩 (선착·무순·D-2·접수중). 기존 D-day 칩은 8건 중 5건이 '상시' 라 정보가 0이었다.
// 가운데: 단지명 + 메타 한 줄 (지역 · 1순위 접수일) + xs 진행 레일.
// 우: 세대수.
//
// ⚠️ 메타 줄에 세대수를 넣지 말 것 — 넣으면 뒤 항목이 항상 잘린다. 세대수는 우측 열이 맡는다.
// ⚠️ 좌측 상태 칩이 생겼으므로 본문 상태 배지는 중복이다 (삭제됨).
// v4-C7-1: 좌측 칸을 썸네일 64×64 로 바꾸고 상태 칩은 제목 줄 앞 배지로 옮겼다.
//    썸네일이 없어도 같은 64×64 이니셜 블록이 자리를 지킨다 — 보유율 지역 편차가 커서
//    (부산 94% · 경기 33%) 빈 칸을 허용하면 행 정렬이 지역마다 달라진다.
// v4-C6: RPC 가 builder 를 실어 주면서 메타 줄이 설계안대로 `지역 · 시공사` 가 됐다.
//    시공사가 없는 현장만 1순위 접수일로 떨어진다.

import Link from 'next/link';
import { aptHref, type AptHubItem } from '@/lib/apt/hub';
import { formatComplexName, formatRegionShortSafe } from '@/lib/apt/subscription-status';
import { rowStatusChip } from '@/lib/apt/subscription-badge';
import LifecycleRail from '@/components/apt/LifecycleRail';
import ListThumb from '@/components/ui/ListThumb';

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
  const meta = [
    formatRegionShortSafe(item.region_nm),
    item.builder || (recept ? `1순위 ${recept}` : null),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link href={href} className="kd-lrow kd-lrow--thumb" style={{ textDecoration: 'none', color: 'inherit' }}>
      <ListThumb src={item.thumb_url} name={item.house_nm || name} />

      <span style={{ minWidth: 0 }}>
        <span className="kd-lrow-t">
          <span className={chip.tone ? `kd-lrow-badge ${chip.tone}` : 'kd-lrow-badge'}>{chip.label}</span>
          {name}
        </span>
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
