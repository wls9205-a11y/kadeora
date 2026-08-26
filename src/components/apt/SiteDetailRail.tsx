'use client';

// v3 커밋4 — 현장 상세 데스크탑 우측 레일. ≥1024px 에서만 보인다 (.kd-detail-rail).
//
// 순서: ① 리드폼 진입 ② 카톡(부가) ③ 같은 지역 현장 ④ 바로가기.
// 현장 상세에서 1순위는 리드폼이다 — 오픈채팅 URL 은 파라미터를 못 받아
// '누가·어느 현장에서' 가 남는 경로가 폼뿐이다.
//
// ⚠️ ①은 폼 자체가 아니라 폼으로 가는 진입 카드다.
//    LeadForm 을 여기서 한 번 더 렌더하면 같은 페이지에 form 이 두 벌, id 도 두 벌이 된다
//    (id="lead-form" / input id="kd-lead-name"). getElementById 는 첫 번째만 잡아
//    하단 액션바·이 카드의 스크롤이 숨은 쪽을 가리키게 되고, 라벨-입력 연결도 깨진다.
//    리드 도달이 이 작업의 최대 리스크라 폼 인스턴스는 페이지당 한 벌로 유지한다.
//
// ⚠️ ③④는 본문 하단의 같은 블록과 중복이다 — 본문 쪽은 ≥1024px 에서 .kd-lg-hide 로 숨는다.

import Link from 'next/link';
import { KAKAO_TALK_URL, trackTalkClick } from '@/lib/talk-banner';
import { useTalkView } from '@/components/banner/useTalkView';
import { LEAD_FORM_ID } from '@/components/apt/LeadForm';
import { leadCopy } from '@/lib/apt/lead-copy';
import { trackLeadClick } from '@/lib/apt/lead-track';

const KAKAO_INK = '#191919';

export type RailNearby = {
  slug: string;
  name: string;
  sigungu?: string | null;
  region?: string | null;
  total_units?: number | null;
};

export type SiteDetailRailProps = {
  siteSlug: string;
  siteName: string;
  /** ONESHOT §C-1: 단계별 문구 */
  lifecycleStage?: string | null;
  region: string;
  sigungu?: string | null;
  dong?: string | null;
  showLeadForm: boolean;
  nearby: RailNearby[];
};

const panel: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '14px',
  marginBottom: 12,
};

const panelTitle: React.CSSProperties = {
  fontSize: 'var(--fs-xs)',
  fontWeight: 500,
  letterSpacing: '.08em',
  color: 'var(--text-tertiary)',
  margin: '0 0 8px',
};

export default function SiteDetailRail({
  siteSlug, siteName, region, sigungu, dong, showLeadForm, nearby, lifecycleStage,
}: SiteDetailRailProps) {
  const talkRef = useTalkView<HTMLAnchorElement>('rail', { site_slug: siteSlug });

  return (
    <>
      {/* ① 리드폼 진입 */}
      {showLeadForm && (
        <div style={{ ...panel, borderColor: 'var(--brand)', background: 'var(--brand-bg)' }}>
          <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1.4, wordBreak: 'keep-all' }}>
            {siteName} {leadCopy(lifecycleStage).band.replace(' · 무료', '')}
          </p>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5, wordBreak: 'keep-all' }}>
            잔여 세대·일정을 담당자가 직접 안내해 드립니다.
          </p>
          <a
            href={`#${LEAD_FORM_ID}`}
            onClick={() => trackLeadClick('rail', { site_slug: siteSlug, lifecycle_stage: lifecycleStage })}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 44, borderRadius: 'var(--radius-sm)',
              background: 'var(--brand)', color: '#FFFFFF',
              fontSize: 'var(--fs-sm)', fontWeight: 500, textDecoration: 'none',
            }}
          >
            안내 신청하기
          </a>
        </div>
      )}

      {/* ② 카톡 — 부가 */}
      <a
        ref={talkRef}
        href={KAKAO_TALK_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackTalkClick('rail', { site_slug: siteSlug })}
        aria-label="부동산 정보 공유 카톡방을 새 창으로 엽니다"
        style={{ ...panel, display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, textDecoration: 'none' }}
      >
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0, width: 30, height: 30, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-sm)', background: 'var(--kakao-bg)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" focusable="false">
            <path
              fill={KAKAO_INK}
              d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.3 0 .6.1.9.1 5.1 0 9.2-3.3 9.2-7.5S17.1 3 12 3z"
            />
          </svg>
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
            부정공 카톡방
          </span>
          <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.45, wordBreak: 'keep-all' }}>
            공고 전 소식·잔여 동호수를 카톡으로
          </span>
        </span>
      </a>

      {/* ③ 같은 지역 현장 */}
      {nearby.length > 0 && (
        <div style={panel}>
          <h2 style={panelTitle}>{region} 다른 현장</h2>
          {nearby.slice(0, 5).map(ns => (
            <Link
              key={ns.slug}
              href={`/apt/${ns.slug}`}
              style={{
                display: 'block', padding: '8px 0', textDecoration: 'none',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ns.name}
              </span>
              <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[ns.sigungu || ns.region, ns.total_units ? `${ns.total_units.toLocaleString()}세대` : null].filter(Boolean).join(' · ')}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* ④ 바로가기 */}
      {(region || sigungu) && (
        <div style={panel}>
          <h2 style={panelTitle}>바로가기</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {region && (
              <Link href={`/apt/region/${encodeURIComponent(region)}`} style={chip}>{region} 부동산</Link>
            )}
            {region && sigungu && (
              <Link href={`/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}`} style={chip}>{sigungu} 시세</Link>
            )}
            {region && sigungu && dong && (
              <Link href={`/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}/${encodeURIComponent(dong)}`} style={chip}>{dong} 아파트</Link>
            )}
          </div>
        </div>
      )}

      {/* v8-B2 · 계산기 — 분양 리드와 맞물리는 3종만.
           급여·군인·상속·쇼핑 계산기는 분양 상담과 무관해 현장 상세에 링크하지 않는다.
           ⚠️ 계산기는 네이버 검색 직접 유입이 30일 1,249건(69%)인 독립 유입원이다 —
              여기서 하는 것은 내부 링크 추가뿐이고 라우트·사이트맵은 건드리지 않는다. */}
      <div style={panel}>
        <h2 style={panelTitle}>계산기</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/calc/real-estate" style={chip}>부동산</Link>
          <Link href="/calc/property-tax" style={chip}>부동산 세금</Link>
          <Link href="/calc/loan" style={chip}>대출</Link>
        </div>
      </div>
    </>
  );
}

const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--bg-sunken)',
  color: 'var(--text-secondary)',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  textDecoration: 'none',
};
