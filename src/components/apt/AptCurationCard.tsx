// v3 커밋5 — /apt 상단 큐레이션 카드 (3건).
//
// 목록 행(.kd-lrow)이 못 담는 것만 담는다: D-day, 7칸 진행 레일, 확인 날짜, 알림 CTA.
//
// ⚠️ 설계안의 'VWorld 출처' 는 넣지 못했다. AptHubItem(hub.ts:20)에는 이미지도
//    apt_sites 조인 키도 없어 위성 이미지와 그 출처를 알 방법이 없다.
//    출처 표기 없이 위성 이미지를 그리는 것은 하지 않는다 — 없는 값을 만들지 않는다.
//    이미지를 넣으려면 get_apt_subscription_hub RPC 에 컬럼 추가가 선행돼야 한다.
//
// ⚠️ 여기 올라온 3건을 아래 목록에서 빼지 않는다. 프론트만으로 불가능하고
//    이름 문자열 매칭으로 빼는 우회는 금지다. 중복을 허용하고
//    '큐레이션 3곳 외 N개' 같은 문구도 쓰지 않는다.

import Link from 'next/link';
import { aptHref, type AptHubItem } from '@/lib/apt/hub';
import { formatComplexName, formatRegionShortSafe } from '@/lib/apt/subscription-status';
import { rowStatusChip, statusLabel } from '@/lib/apt/subscription-badge';
import LifecycleRail from '@/components/apt/LifecycleRail';
import SubscriptionAlertButton from '@/components/apt/SubscriptionAlertButton';

function fmtToday(d: string): string {
  const [, m, day] = (d || '').split('-');
  if (!m || !day) return '';
  return `${Number(m)}월 ${Number(day)}일`;
}

export default function AptCurationCard({ item, today }: { item: AptHubItem; today: string }) {
  const name = formatComplexName(item.region_nm, item.house_nm);
  const chip = rowStatusChip(item.status, item.dday);
  const checked = fmtToday(today);

  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-surface)',
        padding: '12px 13px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <span className={chip.tone ? `kd-lrow-k ${chip.tone}` : 'kd-lrow-k'} style={{ width: 'auto', padding: '4px 8px' }}>
          {chip.label}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)' }}>
          {statusLabel(item.status)}
        </span>
      </div>

      <Link
        href={aptHref(item)}
        style={{
          display: 'block', fontSize: 14, fontWeight: 700, lineHeight: 1.35,
          letterSpacing: '-.02em', color: 'var(--text-primary)', textDecoration: 'none',
          wordBreak: 'keep-all', marginBottom: 4,
        }}
      >
        {name}
      </Link>

      <p style={{ margin: '0 0 9px', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
        {[
          formatRegionShortSafe(item.region_nm),
          item.households ? `${item.households.toLocaleString('ko-KR')}세대` : null,
        ].filter(Boolean).join(' · ')}
      </p>

      {/* 7칸 진행 레일 — 공고부터 계약까지 어디쯤인지 */}
      <div style={{ marginBottom: 9 }}>
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
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <SubscriptionAlertButton aptName={item.house_nm ?? name} compact />
        {checked && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {checked} 확인
          </span>
        )}
      </div>
    </article>
  );
}
