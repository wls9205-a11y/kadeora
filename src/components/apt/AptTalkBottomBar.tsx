'use client';

// 현장 상세 모바일 하단 고정 바 — 2분할. 주(카톡방) / 보조(상담 신청).
//
// 겹침 정리 (Navigation.tsx 실측):
//   하단 탭바   position:fixed bottom:0  z-index:100  minHeight 56 + paddingBottom safe-area
//   글쓰기 FAB  bottom: calc(68px + safe-area)  z-index:99  right:16
// 이 바는 탭바 바로 위(62px + safe-area)에 z-index 98 로 깔고,
// 같은 세로 구간을 쓰는 FAB 는 이 바가 떠 있는 동안만 위로 밀어낸다.
// FAB 는 전역 컴포넌트라 선택자가 없어 aria-label 로 잡는다 (인라인 style 을 이기려면 !important).
//
// 6번 블록(SiteTalkCTA)이 화면에 들어오면 숨는다 — 같은 제안이 두 번 겹쳐 보이지 않게.

import { useEffect, useState } from 'react';
import { KAKAO_TALK_URL, trackTalkClick } from '@/lib/talk-banner';
import { trackTalkView } from '@/lib/talk-banner';
import { SITE_TALK_CTA_ID } from '@/components/banner/SiteTalkCTA';
import { LEAD_FORM_ID } from '@/components/apt/LeadForm';

/** 바 높이(px). 스페이서와 공유. */
export const TALK_BOTTOM_BAR_HEIGHT = 56;
/** 하단 탭바가 차지하는 높이(safe-area 제외). */
const NAV_HEIGHT = 62;

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
          bottom: calc(${NAV_HEIGHT + TALK_BOTTOM_BAR_HEIGHT + 6}px + env(safe-area-inset-bottom)) !important;
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
