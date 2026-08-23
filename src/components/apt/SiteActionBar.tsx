'use client';

// v3 커밋2 — 현장 상세 모바일 하단 고정 바.
//
// 좌(주) 리드폼 / 우(부) 카톡. AptTalkBottomBar(카톡 주 · 폼 보조)를 대체한다.
// 오픈채팅 URL 은 파라미터를 못 받아 '누가·어느 현장에서' 를 남기는 경로가 폼뿐이다.
// 그래서 상세에서는 폼이 1순위고 카톡은 아이콘 한 칸으로 내려간다.
//
// 하단 점유 요소 지도 (AptTalkBottomBar 가 실측해 둔 값 — 그대로 승계):
//   TossBottomBanner/TossTeaser  z-9999  bottom 0 전폭
//   Navigation 하단 탭바          z-100   bottom 0 · 62px
//   Navigation 글쓰기 FAB         z-99    bottom 68 · 52×52 · right 16
//   이 바                         z-98    bottom 62 · 48px · left/right 12
//   ScrollToTop                   z-98    bottom 130 · 40×40 · right 16
//   InstallBanner/SmartPushPrompt z-90    bottom 0
//
// ⚠️ bottom:0 으로 두면 z-100 탭바에 완전히 가려진다.
// ⚠️ z-index 를 90 으로 낮추지 말 것 — 글쓰기 FAB(z-99)가 바 위로 올라온다.
//    같은 세로 구간을 쓰는 FAB·ScrollToTop 은 바가 떠 있는 동안만 통째로 밀어 올린다.
//    둘을 같은 값으로 밀어야 원래 간격(FAB 68~120 / ScrollToTop 130~170)이 유지된다.
// StickySignupBar(bottom 56 · z-90)와의 자리 경합은 그쪽에서 isAptSiteDetailPath 로 비켜준다.

import { useCallback, useEffect, useState } from 'react';
import { KAKAO_TALK_URL, trackTalkClick, trackTalkView } from '@/lib/talk-banner';
import { LEAD_FORM_ID } from '@/components/apt/LeadForm';

/** 바 높이(px). 스페이서와 공유. */
export const SITE_ACTION_BAR_HEIGHT = 48;
/** 하단 탭바가 차지하는 높이(safe-area 제외) — 실측. */
const NAV_HEIGHT = 62;
/** 바가 떠 있을 때 FAB·ScrollToTop 을 밀어 올리는 양 (바 높이 + 간격). */
const STACK_OFFSET = SITE_ACTION_BAR_HEIGHT + 6;
/** 원래 bottom 값 — Navigation.tsx / ScrollToTop.tsx 인라인 style 기준. */
const FAB_BOTTOM = 68;
const SCROLL_TOP_BOTTOM = 130;

/** LeadForm 과 같은 조건으로 사라져야 한다 — 눌러도 갈 곳이 없는 버튼을 만들지 않는다. */
const ENDPOINT = process.env.NEXT_PUBLIC_LEAD_ENDPOINT || '';

/**
 * 흰 글자 보조줄의 알파. #2563EB 위 합성 대비 4.77:1 (0.85 는 4.20 으로 미달이다).
 * 낮추지 말 것 — hex 가 아니라 합성 후 값으로 재야 한다.
 */
const SUB_FG = 'rgba(255,255,255,0.94)';

export type SiteActionBarProps = {
  siteSlug: string;
  /** 리드폼이 실제로 페이지에 렌더될 때만 주 버튼을 띄운다. */
  showLeadForm?: boolean;
};

export default function SiteActionBar({ siteSlug, showLeadForm = false }: SiteActionBarProps) {
  // 리드폼이 화면에 들어오면 접는다 — 폼을 보고 있는데 '폼으로 가기' 를 띄우지 않는다.
  const [visible, setVisible] = useState(true);
  const [seen, setSeen] = useState(false);

  const hasForm = showLeadForm && !!ENDPOINT;

  const jumpToForm = useCallback(() => {
    const form = document.getElementById(LEAD_FORM_ID);
    if (!form) return;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 스크롤이 끝난 뒤 포커스를 준다. 지금 바로 focus() 하면 브라우저가 즉시 점프시켜
    // smooth 스크롤이 잘린다.
    window.setTimeout(() => {
      document.getElementById('kd-lead-name')?.focus({ preventScroll: true });
    }, 600);
  }, []);

  useEffect(() => {
    if (!hasForm) return;
    const el = document.getElementById(LEAD_FORM_ID);
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) setVisible(!e.isIntersecting);
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasForm]);

  // 실제로 보이게 된 순간을 노출로 센다 (마운트 시점이 아니라).
  useEffect(() => {
    if (!visible || seen) return;
    setSeen(true);
    trackTalkView('bottom_bar', { site_slug: siteSlug });
  }, [visible, seen, siteSlug]);

  // 바가 떠 있는 동안만 FAB·ScrollToTop 을 밀어 올린다.
  useEffect(() => {
    const cls = 'kd-has-action-bar';
    document.body.classList.toggle(cls, visible);
    return () => document.body.classList.remove(cls);
  }, [visible]);

  return (
    <>
      <style>{`
        body.kd-has-action-bar a[aria-label="글쓰기"] {
          bottom: calc(${FAB_BOTTOM + STACK_OFFSET}px + env(safe-area-inset-bottom)) !important;
        }
        body.kd-has-action-bar button[aria-label="맨 위로 스크롤"] {
          bottom: calc(${SCROLL_TOP_BOTTOM + STACK_OFFSET}px + env(safe-area-inset-bottom)) !important;
        }
      `}</style>

      {/* 바가 본문 끝을 덮지 않도록 flow 에서 자리를 확보한다 */}
      <div
        aria-hidden="true"
        className="md:hidden"
        style={{ height: visible ? SITE_ACTION_BAR_HEIGHT + 12 : 0 }}
      />

      <div
        className="md:hidden"
        style={{
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
          zIndex: 98,
          display: visible ? 'flex' : 'none',
          gap: 8,
        }}
      >
        {/* 주 — 리드폼 */}
        {hasForm && (
          <button
            type="button"
            onClick={jumpToForm}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 48,
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand)',
              color: '#FFFFFF',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(37,99,235,0.28)',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>분양 정보 안내 신청</span>
            <span style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.2, color: SUB_FG }}>담당자 직접 연락</span>
          </button>
        )}

        {/* 부 — 카톡. 폼이 없는 현장에서는 이 칸이 바 전체를 쓴다. */}
        <a
          href={KAKAO_TALK_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackTalkClick('bottom_bar', { site_slug: siteSlug })}
          aria-label="부동산 정보 공유 카톡방을 새 창으로 엽니다"
          style={{
            flex: hasForm ? '0 0 48px' : 1,
            width: hasForm ? 48 : undefined,
            minHeight: 48,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: 'var(--radius-md)',
            background: 'var(--kakao-bg)',
            color: '#191919',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 700,
            boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              fill="#191919"
              d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.3 0 .6.1.9.1 5.1 0 9.2-3.3 9.2-7.5S17.1 3 12 3z"
            />
          </svg>
          {!hasForm && <span>부동산 정보 공유방</span>}
        </a>
      </div>
    </>
  );
}
