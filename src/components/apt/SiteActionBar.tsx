'use client';

// v3 커밋2 — 현장 상세 모바일 하단 고정 바.
//
// 좌 리드폼 / 우 카톡. 카톡 주 / 폼 보조였던 이전 바를 대체한다.
// 오픈채팅 URL 은 파라미터를 못 받아 '누가·어느 현장에서' 를 남기는 경로가 폼뿐이다.
// 그래서 상세에서는 폼이 1순위다.
//
// B8-2 — 두 칸은 «50/50 동일 높이» 다. 카톡이 아이콘 한 칸(48px)이던 시절,
// 그 칸은 라벨이 없어 「노란 원형 플로팅 버튼」으로 읽혔고 무엇을 하는 버튼인지
// 말하지 않았다. 이제 둘 다 문구를 가진 같은 크기 칸이고, 폼의 «1순위» 는
// 크기가 아니라 «색(브랜드 블루)과 자리(좌측)» 로만 표시한다.
//
// 하단 점유 요소 지도 (실측 — 여기가 유일한 원본이다. 새 고정 요소를 넣기 전에 갱신할 것):
//   TossBottomBanner/TossTeaser  z-9999  bottom 0 전폭
//   Navigation 하단 탭바          z-100   bottom 0 · 62px
//   Navigation 글쓰기 FAB         z-99    상세에서는 «감춤» (SiteFloatingActions)
//   현장 댓글 / 공유 플로팅        z-99    bottom 68 / 124 · 48×48 · right 16
//   이 바                         z-98    bottom 62 · 48px · left/right 12
//   ScrollToTop                   z-98    상세에서는 bottom 180 (스택 위)
//   InstallBanner/SmartPushPrompt z-90    bottom 0
//
// ⚠️ bottom:0 으로 두면 z-100 탭바에 완전히 가려진다.
// ⚠️ z-index 를 90 으로 낮추지 말 것 — z-99 플로팅 스택이 바 위로 올라온다.
// ⚠️ B8-1: 우하단 «세로 스택»(플로팅 2개 + ScrollToTop)의 bottom 은 이 파일이 아니라
//    SiteFloatingActions.tsx 가 정한다. 소유자를 둘로 나누면 !important 가 서로를 덮는다.
//    이 컴포넌트는 자기 바의 위치와 body.kd-has-action-bar 토글까지만 책임진다 —
//    스택은 그 클래스를 보고 «스스로» 밀려 올라간다.
// StickySignupBar(bottom 56 · z-90)와의 자리 경합은 그쪽에서 isAptSiteDetailPath 로 비켜준다.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { KAKAO_TALK_URL, trackTalkClick, trackTalkView } from '@/lib/talk-banner';
import { LEAD_FORM_ID } from '@/components/apt/LeadForm';
import { leadCopy } from '@/lib/apt/lead-copy';
import { trackLeadClick, trackLeadView } from '@/lib/apt/lead-track';

/** 바 높이(px). 스페이서와 공유. */
export const SITE_ACTION_BAR_HEIGHT = 48;
/** 하단 탭바가 차지하는 높이(safe-area 제외) — 실측. */
const NAV_HEIGHT = 62;

/**
 * B8-2 — 두 칸의 «공통» 형태. 50/50 · 같은 높이 · 한 줄.
 * ⚠️ 한쪽에만 flex/minHeight 를 적어 두면 다음 사람이 한쪽만 고쳐 높이가 갈린다.
 *    좌우가 같은 상수를 스프레드하도록 묶어 둔 이유다.
 * 문구가 길어지면(큰 글씨 접근성 모드 --fs-sm 18px) 줄바꿈으로 흘러내리게 둔다 —
 * nowrap 으로 잘라 버리면 「분양 정보 안내 신...」 이 된다.
 */
const SLOT: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: SITE_ACTION_BAR_HEIGHT,
  padding: '0 8px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  borderRadius: 'var(--radius-md)',
  boxSizing: 'border-box',
};

/**
 * 카톡 칸 문구. 「부동산 정보 공유방」은 방 «이름» 이라 버튼이 무엇을 하는지 안 말했다.
 * 여기서는 동작을 말한다 — 오픈채팅 링크는 파라미터를 못 받아 클릭 이후가 안 보이므로,
 * 최소한 누르는 사람이 무엇을 누르는지는 알아야 한다.
 */
const TALK_LABEL = '카카오톡방 입장';

/** LeadForm 과 같은 조건으로 사라져야 한다 — 눌러도 갈 곳이 없는 버튼을 만들지 않는다. */
const ENDPOINT = process.env.NEXT_PUBLIC_LEAD_ENDPOINT || '';

export type SiteActionBarProps = {
  siteSlug: string;
  /** 리드폼이 실제로 페이지에 렌더될 때만 주 버튼을 띄운다. */
  showLeadForm?: boolean;
  /** ONESHOT §C-1: 단계별 문구. 세 화면이 같은 말을 해야 한다. */
  lifecycleStage?: string | null;
};

export default function SiteActionBar({ siteSlug, showLeadForm = false, lifecycleStage }: SiteActionBarProps) {
  const copy = leadCopy(lifecycleStage);
  // 리드폼이 화면에 들어오면 접는다 — 폼을 보고 있는데 '폼으로 가기' 를 띄우지 않는다.
  const [visible, setVisible] = useState(true);
  const [seen, setSeen] = useState(false);

  const hasForm = showLeadForm && !!ENDPOINT;

  const jumpToForm = useCallback(() => {
    // §5-3: 어느 자리가 폼으로 사람을 보내는지. 스크롤 실패해도 클릭은 일어난 일이라 먼저 센다.
    trackLeadClick('bottom_bar', { site_slug: siteSlug, lifecycle_stage: lifecycleStage });
    const form = document.getElementById(LEAD_FORM_ID);
    if (!form) return;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 스크롤이 끝난 뒤 포커스를 준다. 지금 바로 focus() 하면 브라우저가 즉시 점프시켜
    // smooth 스크롤이 잘린다.
    window.setTimeout(() => {
      document.getElementById('kd-lead-name')?.focus({ preventScroll: true });
    }, 600);
  }, [siteSlug, lifecycleStage]);

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
    // §5-3: 리드폼 진입점 노출은 폼이 있는 현장에서만 센다. 없는 현장까지 세면 분모가 부푼다.
    if (hasForm) trackLeadView('bottom_bar', { site_slug: siteSlug, lifecycle_stage: lifecycleStage });
  }, [visible, seen, siteSlug, hasForm, lifecycleStage]);

  // 바가 떠 있는 동안만 우하단 스택을 밀어 올린다. 실제 오프셋은 SiteFloatingActions 가 읽는다.
  useEffect(() => {
    const cls = 'kd-has-action-bar';
    document.body.classList.toggle(cls, visible);
    return () => document.body.classList.remove(cls);
  }, [visible]);

  return (
    <>
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
        {/* 주 — 리드폼. 좌측 · 브랜드 블루로 위계를 유지한다(B8-2).
             ⚠️ 보조줄('담당자 직접 연락')은 뺐다. 두 버튼이 같은 높이 한 줄이어야
                50/50 이 «같은 무게» 로 읽힌다 — 한쪽만 두 줄이면 그쪽이 더 커 보인다. */}
        {hasForm && (
          <button
            type="button"
            onClick={jumpToForm}
            style={{
              ...SLOT,
              border: 'none',
              background: 'var(--brand)',
              color: 'var(--text-inverse)',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(37,99,235,0.28)',
            }}
          >
            {/* --text-inverse(#FFFFFF) on --brand(#2563EB) = 5.17:1 */}
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, lineHeight: 1.15 }}>{copy.button ?? copy.cta}</span>
          </button>
        )}

        {/* 부 — 부정공 오픈채팅. 폼이 없는 현장에서는 이 칸이 바 전체를 쓴다. */}
        <a
          href={KAKAO_TALK_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackTalkClick('bottom_bar', { site_slug: siteSlug })}
          aria-label="부동산 정보 공유 카톡방을 새 창으로 엽니다"
          style={{
            ...SLOT,
            gap: 6,
            background: 'var(--kakao-bg)',
            color: 'var(--kakao-text)',
            textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
          }}
        >
          {/* --kakao-text(#191919) on --kakao-bg(#FEE500) = 13.5:1 */}
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
            <path
              fill="var(--kakao-text)"
              d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.3 0 .6.1.9.1 5.1 0 9.2-3.3 9.2-7.5S17.1 3 12 3z"
            />
          </svg>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, lineHeight: 1.15 }}>{TALK_LABEL}</span>
        </a>
      </div>
    </>
  );
}
