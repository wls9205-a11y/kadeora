// s273 — 청약 카드.
// 필드: 단지명 · 지역 · 세대수 · 평당 분양가 · 1순위 접수일 · 배지 · 마감 후 경쟁률/가점컷
// 서버 컴포넌트. 인라인 알림 CTA 만 client ('use client' 는 그쪽 파일에).

import Link from 'next/link';
import { aptHref, type AptHubItem } from '@/lib/apt/hub';
import { formatComplexName, formatRegionShortSafe } from '@/lib/apt/subscription-status';
import { statusBadgeStyle, statusLabel, ddayLabel, ddayStyle } from '@/lib/apt/subscription-badge';
import SubscriptionAlertButton from '@/components/apt/SubscriptionAlertButton';
import LifecycleRail from '@/components/apt/LifecycleRail';

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  const [, m, day] = d.split('-');
  if (!m || !day) return null;
  return `${Number(m)}월 ${Number(day)}일`;
}

/**
 * 평당 분양가. apt_subscriptions 의 price_per_pyeong 계열은 2026-08 기준
 * 최근 90일 공고에서 채움률 0% 라 폴백 문구가 사실상 기본값이다 (Architecture Rule #93).
 */
function fmtPricePerPyeong(v: number | null): string {
  if (!v || v <= 0) return '분양가 미공개';
  return `평당 ${Math.round(v).toLocaleString('ko-KR')}만원`;
}

function Meta({ label, value, numeric = true }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'baseline', minWidth: 0 }}>
      <span style={{ fontSize: 10.5, color: 'var(--text-tertiary, #9ca3af)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 11.5,
          color: 'var(--text-secondary, #4b5563)',
          fontWeight: 600,
          fontFamily: numeric ? 'var(--font-mono)' : undefined,
          fontVariantNumeric: numeric ? 'tabular-nums' : undefined,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function SubscriptionCard({ item }: { item: AptHubItem }) {
  const name = formatComplexName(item.region_nm, item.house_nm);
  const dd = ddayLabel(item.status, item.dday);
  const href = aptHref(item);

  // 마감 후에만 의미 있는 값 — 접수 전/중에 0.0:1 을 띄우면 오독을 부른다.
  const isAfterReceipt = item.status === 'announced_wait' || item.status === 'contract' || item.status === 'closed';
  const showResult = isAfterReceipt && (item.competition_rate != null || item.min_score != null);

  return (
    <article
      style={{
        border: '1px solid var(--border, #1e3258)',
        borderRadius: 10,
        background: 'var(--bg-surface, #ffffff)',
        padding: '11px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
        <span style={statusBadgeStyle(item.status)}>{statusLabel(item.status)}</span>
        {dd ? <span style={ddayStyle(item.dday)}>{dd}</span> : null}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary, #9ca3af)' }}>
          {formatRegionShortSafe(item.region_nm)}
        </span>
      </div>

      <Link
        href={href}
        style={{
          display: 'block',
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.4,
          color: 'var(--text-primary, #111827)',
          textDecoration: 'none',
          wordBreak: 'keep-all',
          marginBottom: 8,
        }}
      >
        {name}
      </Link>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '4px 12px',
          marginBottom: 9,
        }}
      >
        <Meta label="세대수" value={item.households ? `${item.households.toLocaleString('ko-KR')}세대` : '미공개'} />
        <Meta label="분양가" value={fmtPricePerPyeong(item.price_per_pyeong)} />
        <Meta label="1순위 접수" value={fmtDate(item.rcept_bgnde) ?? '일정 미정'} />
        <Meta label="접수 마감" value={fmtDate(item.rcept_endde) ?? '일정 미정'} />
      </div>

      {showResult ? (
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            padding: '6px 9px',
            marginBottom: 9,
            borderRadius: 6,
            background: 'var(--bg-elevated, #f9fafb)',
            border: '1px solid var(--border, #1e3258)',
          }}
        >
          {item.competition_rate != null ? (
            <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--accent-red)' }}>
              1순위 {Number(item.competition_rate).toFixed(1)}대 1
            </span>
          ) : null}
          {item.min_score != null ? (
            <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--accent-blue)' }}>
              가점컷 {item.min_score}점
            </span>
          ) : null}
          {item.total_applicants != null ? (
            <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary, #6b7280)' }}>
              접수 {item.total_applicants.toLocaleString('ko-KR')}건
            </span>
          ) : null}
        </div>
      ) : null}

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SubscriptionAlertButton aptName={item.house_nm ?? name} compact />
        <Link
          href={href}
          style={{
            fontSize: 11.5,
            color: 'var(--text-secondary, #6b7280)',
            textDecoration: 'none',
            marginLeft: 'auto',
          }}
        >
          상세 분석 →
        </Link>
      </div>
    </article>
  );
}
