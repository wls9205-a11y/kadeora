'use client';

// B8-1 — 현장 상세 우하단 플로팅 스택 (<1024px 전용 — 레일이 뜨는 지점에서 물러난다).
//
// 왜 있나: 이 자리에는 전역 「글쓰기 FAB」(/write) 가 떠 있었다. 현장 상세를 보는
// 사람이 누르고 싶은 것은 피드 글쓰기가 아니라 «이 현장을 남에게 보내는 것» 과
// «이 현장에 한마디 남기는 것» 이다. 그래서 상세에서만 FAB 를 걷고 두 버튼으로 바꾼다.
// ⚠️ FAB 를 끊는 것은 Navigation.tsx 쪽이다(isAptSiteDetailPath). 컴포넌트는 그대로 두고
//    그 한 화면에서만 렌더를 끊는다 — 여기서 CSS 로 감추면 앵커가 DOM 에 남는다.
//
// ── 하단 점유 요소 지도 (SiteActionBar.tsx 의 지도와 한 벌이다. 둘 다 고칠 것) ──
//   이 파일이 «우하단 세로 스택» 의 유일한 CSS 소유자다.
//   공유 · 현장 댓글 · ScrollToTop 의 bottom 은 전부 여기서 정한다.
//   SiteActionBar 는 자기 바의 위치와 body.kd-has-action-bar 토글까지만 책임진다.
//
//   보이는 구간은 하단 액션바와 «같다»(<1024px). 경계값은 components.css 가 한 곳에서
//   정한다 — .kd-float-stack / .kd-site-action-bar / .kd-detail-rail 이 한 벌이다.
//
//   요소          바 없음   바 있음(+STACK_OFFSET)
//   현장 댓글      68        122
//   공유          124        178
//   ScrollToTop   180        234
//   (댓글 섹션이 없는 현장 = solo: 공유가 68 로 내려오고 ScrollToTop 은 124 / 178)
//
// ⚠️ 공유 URL 에 파라미터를 붙이지 않는다(B8-1). utm 이 붙은 링크가 카톡·커뮤니티로
//    퍼지면 그 URL 이 색인 후보가 되고 canonical 과 다른 주소가 유통된다.
//    공유 계측은 /api/share 서버 기록으로 한다 — URL 을 더럽히지 않는다.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import { SITE_ACTION_BAR_HEIGHT } from '@/components/apt/SiteActionBar';
import { APT_COMMENT_INPUT_ID, APT_COMMENT_SECTION_ID } from '@/lib/apt/detail-anchors';

/** 버튼 지름. 44px 최소 터치 타깃 위. */
const FAB_SIZE = 48;
/** 스택 사이 간격. */
const GAP = 8;
/** 스택 맨 아래 버튼의 기본 bottom — 글쓰기 FAB 가 쓰던 값을 그대로 승계한다. */
const STACK_BASE = 68;
/** 바가 떠 있을 때 스택 전체를 밀어 올리는 양 — SiteActionBar 와 같은 값이어야 한다. */
const STACK_OFFSET = SITE_ACTION_BAR_HEIGHT + 6;

const COMMENT_BOTTOM = STACK_BASE;
const SHARE_BOTTOM = STACK_BASE + FAB_SIZE + GAP;
const SCROLL_TOP_BOTTOM = SHARE_BOTTOM + FAB_SIZE + GAP;

export type SiteFloatingActionsProps = {
  /**
   * apt_comments.house_key — **AptCommentSection 에 넘긴 것과 같은 값**이어야 한다.
   * 그 섹션이 안 뜨는 현장(apt_sites 행이 없는 공고·미분양)에서는 null 을 넘긴다.
   * ⚠️ null 인데 버튼을 띄우면 눌러도 갈 곳이 없다 — 하단 바가 폼 없는 현장에서
   *    주 버튼을 지우는 것과 같은 규칙이다.
   */
  commentKey: string | null;
  /** 공유 제목. display_name 을 그대로 쓴다(SEO 이름 규칙의 산출물). */
  shareTitle: string;
  /** canonical 절대 URL. 파라미터를 붙이지 않는다. */
  shareUrl: string;
};

export default function SiteFloatingActions({ commentKey, shareTitle, shareUrl }: SiteFloatingActionsProps) {
  const pathname = usePathname();
  const { success } = useToast();
  const [count, setCount] = useState<number | null>(null);

  // 상세에서 ScrollToTop 을 스택 위로 올린다.
  // solo = 댓글 버튼이 없어 스택이 한 칸뿐인 상태. ScrollToTop 이 그만큼 내려온다.
  useEffect(() => {
    const solo = !commentKey;
    document.body.classList.add('kd-apt-detail');
    document.body.classList.toggle('kd-apt-solo', solo);
    return () => {
      document.body.classList.remove('kd-apt-detail');
      document.body.classList.remove('kd-apt-solo');
    };
  }, [commentKey]);

  // 댓글 수 뱃지. AptCommentSection 과 «같은 조건»(is_deleted=false · 최상위)으로 센다 —
  // 조건이 어긋나면 뱃지 숫자와 섹션 제목 숫자가 달라진다.
  // (섹션은 limit(50) 안에서 세므로 51개를 넘기면 이쪽이 더 크다. 그때는 이쪽이 맞다.)
  useEffect(() => {
    if (!commentKey) return;
    let alive = true;
    const sb = createSupabaseBrowser();
    (sb as any)
      .from('apt_comments')
      .select('id', { count: 'exact', head: true })
      .eq('house_key', commentKey)
      .eq('is_deleted', false)
      .is('parent_id', null)
      .then(
        ({ count: c }: { count: number | null }) => { if (alive) setCount(c ?? 0); },
        () => {},
      );
    return () => { alive = false; };
  }, [commentKey]);

  const logShare = useCallback((platform: string) => {
    fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, content_type: 'apt', content_ref: pathname }),
    }).catch(() => {});
  }, [pathname]);

  const share = useCallback(async () => {
    // navigator.share 는 https + 사용자 제스처에서만 산다. 없으면 클립보드로 내린다.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
        logShare('native');
        return;
      } catch (e) {
        // 사용자가 시트를 닫은 것(AbortError)은 실패가 아니다 — 클립보드로 되묻지 않는다.
        if ((e as { name?: string })?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      success('링크를 복사했어요');
      logShare('clipboard');
    } catch {
      success('링크 복사를 지원하지 않는 브라우저예요');
    }
  }, [shareTitle, shareUrl, logShare, success]);

  // 하단 바의 「폼으로 가기」와 같은 동작이다 — 스크롤이 끝난 뒤에 포커스를 준다.
  // 지금 바로 focus() 하면 브라우저가 즉시 점프시켜 smooth 스크롤이 잘린다.
  const jumpToComments = useCallback(() => {
    const el = document.getElementById(APT_COMMENT_SECTION_ID);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      document.getElementById(APT_COMMENT_INPUT_ID)?.focus({ preventScroll: true });
    }, 600);
  }, []);

  // 스택은 «아래부터» 채운다. 댓글이 없는 현장에서 공유만 위칸에 떠 있으면
  // 하단 바와 공유 사이에 빈 48px 구멍이 남는다.
  const shareSlot = commentKey ? 'kd-float-share' : 'kd-float-comment';

  const fabStyle: CSSProperties = {
    position: 'fixed',
    right: 16,
    zIndex: 99,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: '50%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    // ⛔ display 는 여기서 주지 않는다 — .kd-float-stack(components.css)이 준다.
    //    인라인 display 는 ≥1024 숨김 규칙을 항상 이긴다(B8 실측).
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-md)',
  };

  return (
    <>
      <style>{`
        /* 스택 세로 자리 — 바 유무로 통째로 밀어 올린다.
           글쓰기 FAB 는 여기서 감추지 않는다 — Navigation 이 상세에서 아예 렌더하지 않는다. */
        .kd-float-comment { bottom: calc(${COMMENT_BOTTOM}px + env(safe-area-inset-bottom, 0px)); }
        .kd-float-share   { bottom: calc(${SHARE_BOTTOM}px + env(safe-area-inset-bottom, 0px)); }
        body.kd-apt-detail button[aria-label="맨 위로 스크롤"] {
          bottom: calc(${SCROLL_TOP_BOTTOM}px + env(safe-area-inset-bottom, 0px)) !important;
        }
        body.kd-has-action-bar .kd-float-comment { bottom: calc(${COMMENT_BOTTOM + STACK_OFFSET}px + env(safe-area-inset-bottom, 0px)); }
        body.kd-has-action-bar .kd-float-share   { bottom: calc(${SHARE_BOTTOM + STACK_OFFSET}px + env(safe-area-inset-bottom, 0px)); }
        body.kd-apt-detail.kd-has-action-bar button[aria-label="맨 위로 스크롤"] {
          bottom: calc(${SCROLL_TOP_BOTTOM + STACK_OFFSET}px + env(safe-area-inset-bottom, 0px)) !important;
        }
        /* 스택이 한 칸일 때 — 아래 두 규칙은 «명시도가 더 높아야» 위를 덮는다.
           클래스 하나를 더 물고 있어 그대로 이긴다. 순서에 기대지 말 것. */
        body.kd-apt-detail.kd-apt-solo button[aria-label="맨 위로 스크롤"] {
          bottom: calc(${SHARE_BOTTOM}px + env(safe-area-inset-bottom, 0px)) !important;
        }
        body.kd-apt-detail.kd-apt-solo.kd-has-action-bar button[aria-label="맨 위로 스크롤"] {
          bottom: calc(${SHARE_BOTTOM + STACK_OFFSET}px + env(safe-area-inset-bottom, 0px)) !important;
        }
      `}</style>

      {/* 현장 댓글 — 스택 아래칸. 상세 안 댓글 섹션으로 데려간다.
          ⚠️ 바텀시트(AptCommentSheet)를 띄우지 않는다. 이 페이지에는 이미
             AptCommentSection 이 같은 apt_comments 를 렌더하고 있어, 시트를 함께 띄우면
             한 화면에 같은 테이블을 쓰는 입력창이 둘이 된다(v10-B3 이 없앤 중복의 재발).
             쓰는 경로도 서로 달라(시트는 /api/apt/comments, 섹션은 supabase 직접)
             한쪽에 쓴 글이 다른 쪽에 안 보이는 상태가 같이 생긴다. */}
      {commentKey && (
      <button
        type="button"
        onClick={jumpToComments}
        aria-label={count && count > 0 ? `현장 댓글 ${count}개 보기` : '현장 댓글 남기기'}
        className="kd-float-stack kd-float-comment"
        style={fabStyle}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {count !== null && count > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: -2, right: -2,
              minWidth: 18, height: 18, padding: '0 5px',
              borderRadius: 9, background: 'var(--brand)', color: 'var(--text-inverse)',
              fontSize: 11, fontWeight: 600, lineHeight: '18px', textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      )}

      {/* 공유 — 댓글이 있으면 위칸, 없으면 그 자리를 그대로 받는다 */}
      <button
        type="button"
        onClick={share}
        aria-label="이 현장 공유하기"
        className={`kd-float-stack ${shareSlot}`}
        style={fabStyle}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
        </svg>
      </button>
    </>
  );
}
