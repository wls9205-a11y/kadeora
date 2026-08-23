'use client';

// 현장 상세 6번 블록 — 부가 전환 지점.
//
// 왜 이미지 배너를 걷어내고 텍스트로 갔나:
//   30일 실측 — 이미지 인라인 배너 1클릭 / 텍스트 상단 배너 6클릭.
//   955×235 이미지는 광고처럼 보이고, 어느 현장을 보든 같은 그림이라 맥락이 없다.
//   이 카드는 보고 있는 현장의 이름과 상태를 문장에 넣는다.
//
// v3 커밋2: 노란 색면을 걷고 흰 카드 + 22px 카톡 아이콘 칩 + 한 줄로 낮췄다.
//   상세의 1순위는 리드폼이다 — 여기서 노란 판을 깔면 폼과 같은 크기로 경쟁한다.
//   ⚠️ trackTalkClick('site_cta', …) 의 slot 값은 바꾸지 말 것 —
//      바꾸면 기존 30일 데이터와의 연속성이 끊긴다.
//
// ⚠️ AdSense 유닛과 250px 미만 간격에 두지 말 것.

import { KAKAO_TALK_URL, TALK_MEMBER_COUNT, trackTalkClick } from '@/lib/talk-banner';
import { useTalkView } from './useTalkView';

/** 하단 고정 바가 이 블록의 노출 여부를 관찰하는 앵커. */
export const SITE_TALK_CTA_ID = 'site-talk-cta';

// 카카오 노랑은 globals.css:558 의 --kakao-bg 를 쓴다. #FEE500 하드코딩 금지.
const KAKAO_INK = '#191919';

export type SiteTalkCTAProps = {
  siteName: string;
  siteSlug: string;
  /** 잔여 세대 수. 값이 있을 때만 1번 분기를 탄다 (현재 DB 채움률 0% — C 항목). */
  remainingUnits?: number | null;
  /** 분양가가 아직 공개되지 않은 현장인지. */
  priceUndisclosed?: boolean;
};

/**
 * 보조 한 줄. v3 에서 축약했다 — 부가형 카드에 두 줄짜리 문장을 넣으면 다시 주가 된다.
 * 현장 상태에 따라 이 한 줄만 바뀌고 카드 구조는 동일하다.
 */
function buildLine(p: SiteTalkCTAProps, count: string) {
  if (p.remainingUnits && p.remainingUnits > 0) {
    return `잔여 ${p.remainingUnits.toLocaleString()}세대 · 동호수를 카톡으로`;
  }
  if (p.priceUndisclosed) {
    return `분양가 확정 소식을 카톡으로 · ${count}명 참여 중`;
  }
  return `공고 전 소식·잔여 동호수를 카톡으로`;
}

export default function SiteTalkCTA(props: SiteTalkCTAProps) {
  const { siteSlug } = props;
  const viewRef = useTalkView<HTMLDivElement>('site_cta', { site_slug: siteSlug });
  const count = TALK_MEMBER_COUNT.toLocaleString();
  const line = buildLine(props, count);

  return (
    <div ref={viewRef} id={SITE_TALK_CTA_ID} style={{ scrollMarginTop: 60, margin: '0 0 var(--sp-md)' }}>
      <a
        href={KAKAO_TALK_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackTalkClick('site_cta', { site_slug: siteSlug })}
        aria-label={`부정공 카톡방 — ${line}. 오픈 카톡방을 새 창으로 엽니다`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 44,
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          textDecoration: 'none',
          color: 'var(--text-primary)',
        }}
      >
        {/* 22px 카톡 아이콘 칩 — 색면이 아니라 표식이다 */}
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 30,
            height: 30,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--kakao-bg)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" focusable="false">
            <path
              fill={KAKAO_INK}
              d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.3 0 .6.1.9.1 5.1 0 9.2-3.3 9.2-7.5S17.1 3 12 3z"
            />
          </svg>
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, lineHeight: 1.35, color: 'var(--text-primary)' }}>
            부정공 카톡방
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 11.5,
              lineHeight: 1.45,
              color: 'var(--text-tertiary)',
              wordBreak: 'keep-all',
              marginTop: 1,
            }}
          >
            {line}
          </span>
        </span>

        <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>›</span>
      </a>
    </div>
  );
}
