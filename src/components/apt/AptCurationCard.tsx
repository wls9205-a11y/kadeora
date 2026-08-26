// v3 커밋5 — /apt 상단 큐레이션 카드 (3건).
//
// 목록 행(.kd-lrow)이 못 담는 것만 담는다: D-day, 7칸 진행 레일, 확인 날짜, 알림 CTA.
//
// v4-C7-1: RPC 가 thumb_url 을 실어 주면서 이미지와 출처가 들어왔다.
//    /apt 페이지가 thumb_url 보유분만 큐레이션으로 넘긴다 — 여기는 크게 나가는 자리라
//    이니셜 블록으로 채우지 않는다 ('있는 척' 이 되는 건 큰 이미지 자리다).
//    ⚠️ 출처 표기 없이 위성 이미지를 그리지 않는다. VWorld 는 출처 명시가 이용 조건이다.
//
// ⚠️ 여기 올라온 3건을 아래 목록에서 빼지 않는다. 프론트만으로 불가능하고
//    이름 문자열 매칭으로 빼는 우회는 금지다. 중복을 허용하고
//    '큐레이션 3곳 외 N개' 같은 문구도 쓰지 않는다.

import Link from 'next/link';
import { aptHref, type AptHubItem } from '@/lib/apt/hub';
import { formatComplexName, formatRegionShortSafe } from '@/lib/apt/subscription-status';
import { rowStatusChip, statusLabel } from '@/lib/apt/subscription-badge';
import { thumbKind } from '@/lib/apt/hero-priority';
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
      {item.thumb_url && (
        <Link
          href={aptHref(item)}
          style={{ display: 'block', margin: '-12px -13px 10px', aspectRatio: '16 / 9', background: 'var(--bg-elevated)', overflow: 'hidden' }}
        >
          <img
            src={item.thumb_url}
            alt=""
            width={480}
            height={270}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </Link>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <span className={chip.tone ? `kd-lrow-k ${chip.tone}` : 'kd-lrow-k'} style={{ width: 'auto', padding: '4px 8px' }}>
          {chip.label}
        </span>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-tertiary)' }}>
          {statusLabel(item.status)}
        </span>
      </div>

      <Link
        href={aptHref(item)}
        style={{
          display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, lineHeight: 1.35,
          letterSpacing: '-.0125em', color: 'var(--text-primary)', textDecoration: 'none',
          wordBreak: 'keep-all', marginBottom: 4,
        }}
      >
        {name}
      </Link>

      <p style={{ margin: '0 0 9px', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
        {[
          formatRegionShortSafe(item.region_nm),
          item.builder,
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
          <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {checked} 확인
          </span>
        )}
      </div>

      {item.thumb_url && (
        <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-xs)', lineHeight: 1.4, color: 'var(--text-tertiary)' }}>
          {thumbKind(item.thumb_url) === 'hero'
            ? '조감도 제공 · 시행사 (수령 출처는 상세에 표기)'
            : '항공 이미지 · 국토교통부 공간정보 오픈플랫폼(VWorld)'}
        </p>
      )}
    </article>
  );
}
