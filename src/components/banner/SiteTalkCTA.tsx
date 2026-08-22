'use client';

// 현장 상세 6번 블록 — 주 전환 지점.
//
// 왜 이미지 배너를 걷어내고 텍스트로 갔나:
//   30일 실측 — 이미지 인라인 배너 1클릭 / 텍스트 상단 배너 6클릭.
//   955×235 이미지는 광고처럼 보이고, 어느 현장을 보든 같은 그림이라 맥락이 없다.
//   이 카드는 보고 있는 현장의 이름과 상태를 문장에 넣는다.
//
// ⚠️ AdSense 유닛과 250px 미만 간격에 두지 말 것.

import { KAKAO_TALK_URL, TALK_MEMBER_COUNT, trackTalkClick } from '@/lib/talk-banner';
import { useTalkView } from './useTalkView';

/** 하단 고정 바가 이 블록의 노출 여부를 관찰하는 앵커. */
export const SITE_TALK_CTA_ID = 'site-talk-cta';

const YELLOW = '#FED346';
const YELLOW_SOFT = '#FFF7DA';
const INK = '#2B1616';
const INK_SOFT = '#6B4A16';
const LIVE = '#1FA463';

export type SiteTalkCTAProps = {
  siteName: string;
  siteSlug: string;
  /** 잔여 세대 수. 값이 있을 때만 1번 분기를 탄다 (현재 DB 채움률 0% — C 항목). */
  remainingUnits?: number | null;
  /** 분양가가 아직 공개되지 않은 현장인지. */
  priceUndisclosed?: boolean;
};

/** 현장 상태에 따라 한 문장만 바뀐다. 카드 구조는 동일하다. */
function buildLine(p: SiteTalkCTAProps, count: string) {
  if (p.remainingUnits && p.remainingUnits > 0) {
    return `${p.siteName} 잔여 ${p.remainingUnits.toLocaleString()}세대 · 동호수 지정 가능한지 방에서 바로 물어보세요`;
  }
  if (p.priceUndisclosed) {
    return `${p.siteName} 분양가는 아직 미공개입니다 · 확정되면 방에서 가장 먼저 공유됩니다`;
  }
  return `${p.siteName} 관련 질문은 부동산 정보 공유방에서 · 지금 ${count}명 참여 중`;
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
        aria-label={`${line}. 오픈 카톡방을 새 창으로 엽니다`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 'var(--radius-md)',
          background: YELLOW_SOFT,
          border: `1px solid ${YELLOW}`,
          textDecoration: 'none',
          color: INK,
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: INK_SOFT,
              marginBottom: 4,
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 7, height: 7, borderRadius: '50%', background: LIVE, flexShrink: 0 }}
            />
            부동산 정보 공유방 · {count}명 참여 중
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              lineHeight: 1.55,
              color: INK,
              wordBreak: 'keep-all',
            }}
          >
            {line}
          </span>
        </span>

        <span
          style={{
            flexShrink: 0,
            whiteSpace: 'nowrap',
            borderRadius: 'var(--radius-pill)',
            background: INK,
            color: YELLOW,
            padding: '7px 14px',
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          참여하기
        </span>
      </a>
    </div>
  );
}
