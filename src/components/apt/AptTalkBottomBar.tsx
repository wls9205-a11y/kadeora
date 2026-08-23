'use client';

// ⚠️ v3 커밋2에서 SiteActionBar 로 대체됐다 (현재 렌더되는 곳 없음).
//    상세에서는 폼이 1순위, 카톡이 부가다 — 이 파일은 그 반대 배치라 되살리지 말 것.
//    파일을 남겨 둔 건 하단 점유 요소 실측 지도(아래 주석)를 잃지 않기 위해서다.
//
// 현장 상세 모바일 하단 고정 바 — 2분할. 주(카톡방) / 보조(상담 신청).
//
// 하단 점유 요소 지도 (실측):
//   TossBottomBanner/TossTeaser  z-9999  bottom 0 전폭
//   Navigation 하단 탭바          z-100   bottom 0 · 62px
//   Navigation 글쓰기 FAB         z-99    bottom 68 · 52×52 · right 16
//   이 바                         z-98    bottom 62 · 56px 전폭
//   ScrollToTop                   z-98    bottom 130 · 40×40 · right 16
//   InstallBanner/SmartPushPrompt z-90    bottom 0
//
// 이 바는 탭바 바로 위에 눕고, 같은 세로 구간을 쓰는 FAB·ScrollToTop 을
// 바가 떠 있는 동안만 STACK_OFFSET 만큼 통째로 밀어 올린다.
// 둘을 같은 값으로 밀어야 원래 간격(FAB 68~120 / ScrollToTop 130~170)이 유지된다.
// FAB 만 밀면 ScrollToTop(130~170)과 정면으로 겹친다.
// 전역 컴포넌트라 클래스 선택자가 없어 aria-label 로 잡는다 (인라인 style 을 이기려면 !important).
//
// 6번 블록(SiteTalkCTA)이 화면에 들어오면 숨는다 — 같은 제안이 두 번 겹쳐 보이지 않게.
// 이 바는 /apt/[id] 에서만 렌더되고 body 클래스는 언마운트 시 제거하므로
// 블로그 등 다른 라우트에는 영향이 없다.

import { useEffect, useState } from 'react';
import { KAKAO_TALK_URL, trackTalkClick } from '@/lib/talk-banner';
import { trackTalkView } from '@/lib/talk-banner';
import { SITE_TALK_CTA_ID } from '@/components/banner/SiteTalkCTA';
import { LEAD_FORM_ID } from '@/components/apt/LeadForm';

/** 바 높이(px). 스페이서와 공유. */
export const TALK_BOTTOM_BAR_HEIGHT = 56;
/** 하단 탭바가 차지하는 높이(safe-area 제외). */
const NAV_HEIGHT = 62;
/** 바가 떠 있을 때 FAB·ScrollToTop 을 밀어 올리는 양 (바 높이 + 간격). */
const STACK_OFFSET = TALK_BOTTOM_BAR_HEIGHT + 6;
/** 원래 bottom 값 — Navigation.tsx / ScrollToTop.tsx 인라인 style 기준. */
const FAB_BOTTOM = 68;
const SCROLL_TOP_BOTTOM = 130;

const YELLOW = '#FED346';
const INK = '#2B1616';

export type AptTalkBottomBarProps = {
  siteSlug: string;
  /** 리드폼이 페이지에 렌더될 때만 보조 버튼을 띄운다. */
  showLeadForm?: boolean;
};

export default function AptTalkBottomBar({ siteSlug, showLeadForm = false }: AptTalkBottomBarProps) {
  // 6번 블록이 보이는 동안은 접는다. 초기값 true — CTA 가 화면 밖일 때부터 보여야 한다.
  const [visible, setVisible] = useState(true);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = document.getElementById(SITE_TALK_CTA_ID);
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) setVisible(!e.isIntersecting);
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 실제로 보이게 된 순간을 노출로 센다 (마운트 시점이 아니라).
  useEffect(() => {
    if (!visible || seen) return;
    setSeen(true);
    trackTalkView('bottom_bar', { site_slug: siteSlug });
  }, [visible, seen, siteSlug]);

  // 바가 떠 있는 동안만 FAB 를 밀어 올린다.
  useEffect(() => {
    const cls = 'kd-has-talk-bar';
    document.body.classList.toggle(cls, visible);
    return () => document.body.classList.remove(cls);
  }, [visible]);

  const bottom = `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))`;

  return (
    <>
      <style>{`
        body.kd-has-talk-bar a[aria-label="글쓰기"] {
          bottom: calc(${FAB_BOTTOM + STACK_OFFSET}px + env(safe-area-inset-bottom)) !important;
        }
        body.kd-has-talk-bar button[aria-label="맨 위로 스크롤"] {
          bottom: calc(${SCROLL_TOP_BOTTOM + STACK_OFFSET}px + env(safe-area-inset-bottom)) !important;
        }
      `}</style>

      {/* 바가 본문 끝을 덮지 않도록 flow 에서 자리를 확보한다 */}
      <div
        aria-hidden="true"
        className="md:hidden"
        style={{ height: visible ? TALK_BOTTOM_BAR_HEIGHT + 8 : 0 }}
      />

      <div
        className="md:hidden"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom,
          zIndex: 98,
          display: visible ? 'flex' : 'none',
          gap: 8,
          padding: '8px 12px',
          height: TALK_BOTTOM_BAR_HEIGHT,
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        }}
      >
        {/* 주 — 카톡방 */}
        <a
          href={KAKAO_TALK_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackTalkClick('bottom_bar', { site_slug: siteSlug })}
          style={{
            flex: showLeadForm ? 1.4 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            background: YELLOW,
            color: INK,
            fontSize: 'var(--fs-sm)',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          💬 정보 공유방 참여
        </a>

        {/* 보조 — 리드폼. 폼은 '누가·어느 현장에서' 왔는지 남는 유일한 경로라 없애지 않는다. */}
        {showLeadForm && (
          <a
            href={`#${LEAD_FORM_ID}`}
            onClick={() => trackTalkClick('bottom_bar', { site_slug: siteSlug, target: 'lead_form' })}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            📝 상담 신청
          </a>
        )}
      </div>
    </>
  );
}
