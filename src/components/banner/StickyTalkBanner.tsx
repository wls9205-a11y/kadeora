'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  KAKAO_TALK_URL,
  TALK_MEMBER_COUNT,
  trackTalkClick,
} from '@/lib/talk-banner';
import { useTalkView } from './useTalkView';
import { isAptSiteDetailPath } from '@/lib/apt/is-site-detail';

/** 배너 높이(px). spacer 와 공유. */
export const STICKY_BANNER_HEIGHT = 52;

/**
 * 인라인 '이미지' 배너가 들어가는 라우트 — 여기선 상단 배너를 렌더하지 않는다.
 *
 * s-v2: /apt/[id] 를 목록에서 뺐다.
 *   30일 실측 — 카톡방 진입 클릭 7건 중 6건이 이 상단 배너에서 나왔고 인라인 이미지는 1건이다.
 *   그 6건을 만든 슬롯을 트래픽 상위 페이지에서 끄고 있었다.
 *   상세 본문의 이미지 배너는 현장 맥락 텍스트 CTA(SiteTalkCTA)로 교체했으므로
 *   상단(방 일반)과 본문(현장 맥락)은 중복이 아니라 역할 분담이다.
 *
 * 블로그·complex 는 이번 범위 밖 — 이미지 인라인 배너가 그대로라 제외를 유지한다.
 */
const INLINE_ROUTES = [
  /^\/blog\/[^/]+$/,
  /^\/apt\/complex\/[^/]+$/,
];

const YELLOW = '#FED346';
const INK = '#2B1616';
const INK_SOFT = '#6B4A16';
const LIVE = '#1FA463';

export default function StickyTalkBanner() {
  const pathname = usePathname() ?? '';
  // v3 커밋6: 현장 상세에서는 끈다.
  //   노란 전폭 52px 띠가 최상단을 차지하면 '현장 이미지를 최상단에 크게' 와
  //   '폼 우선, 카톡 부가' 가 정면으로 부딪힌다. 그 자리는 리드폼이 대신한다.
  //   잃는 것은 30일 기준 카톡 클릭 6건 — 배포 전 기준선을 STATUS.md 에 남겼다.
  //   ⚠️ INLINE_ROUTES 에 /^\/apt\/[^/]+$/ 를 밀어넣지 말 것.
  //      /apt/busan·/apt/map 같은 허브까지 같이 잡힌다. 헬퍼를 쓴다.
  const hidden = INLINE_ROUTES.some((r) => r.test(pathname)) || isAptSiteDetailPath(pathname);

  // 훅은 조기 반환보다 위에서 무조건 호출한다 (훅 순서 규칙).
  // 렌더하지 않는 라우트에서는 ref 가 붙지 않아 노출도 기록되지 않는다.
  const viewRef = useTalkView<HTMLAnchorElement>('sticky');

  /* 결함 2호 수리 (2026-08-30) — 이 띠는 상단 크롬 «스택의 첫 칸» 이다.
   *
   * 전에는 띠(fixed · z110)와 헤더(sticky · top 0 · z100)가 «같은 자리» 를 놓고
   * 겹쳤다. 스크롤하면 헤더가 통째로 띠 밑으로 들어가 로고·검색·내비가 전부 죽고,
   * 그 자리를 누르면 카톡방이 열렸다(오클릭). → 겹치지 말고 쌓는다.
   *
   * ⛔ 라우트별 CSS 분기를 만들지 않는다. 「띠가 있는가」라는 조건을 «값» 으로 바꿔
   *    <html> 에 올리면, 띠가 없는 라우트에서는 tokens.css 의 :root 기본 0 이 그대로 산다.
   * ⚠️ 판정(`hidden`)은 이 컴포넌트 «한 곳» 에만 있다. 값도 여기서 낸다 —
   *    판정과 값이 두 벌이 되면 한쪽만 늘어난다(STATUS 공리).
   * ⚠️ 언마운트에서 되돌린다. (main) 밖(예: /admin)으로 클라이언트 이동하면
   *    이 컴포넌트가 사라지는데, 인라인 값이 <html> 에 남으면 띠 없는 화면이
   *    52px 만큼 밀린 헤더를 갖는다.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--kd-banner-h', hidden ? '0px' : `${STICKY_BANNER_HEIGHT}px`);
    return () => { root.style.removeProperty('--kd-banner-h'); };
  }, [hidden]);

  if (hidden) return null;

  const handleClick = () => {
    trackTalkClick('sticky');
  };

  const count = TALK_MEMBER_COUNT.toLocaleString();

  return (
    <>
      {/* fixed 배너가 덮는 최상단 공간을 flow 에서 확보 */}
      <div aria-hidden="true" style={{ height: STICKY_BANNER_HEIGHT }} />

      <a
        ref={viewRef}
        href={KAKAO_TALK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`부동산 정보 공유방 — 현재 ${count}명 참여 중인 오픈 카톡방. 새 창으로 열기`}
        onClick={handleClick}
        className="fixed left-0 top-0 z-[110] flex w-full items-center gap-[10px] px-4 no-underline"
        style={{ background: YELLOW, height: STICKY_BANNER_HEIGHT }}
      >
        {/* 라이브 점 — 맥박 */}
        <span
          className="relative flex flex-none"
          style={{ width: 8, height: 8 }}
          aria-hidden="true"
        >
          <span
            className="absolute inset-0 rounded-full motion-safe:animate-ping"
            style={{ background: LIVE, opacity: 0.7 }}
          />
          <span
            className="relative rounded-full"
            style={{ width: 8, height: 8, background: LIVE }}
          />
        </span>

        {/* 역할이 곧 제목 — 브랜드명은 방에 들어간 뒤 알아도 늦지 않다 */}
        <span
          className="flex-none whitespace-nowrap text-[14px] font-medium sm:text-[14px]"
          style={{ color: INK }}
        >
          부동산 정보 공유방
        </span>

        {/* 데스크톱 보조 문구 */}
        <span
          className="hidden overflow-hidden text-ellipsis whitespace-nowrap text-[13px] sm:inline"
          style={{ color: INK_SOFT }}
        >
          지금{' '}
          <span className="font-medium" style={{ color: INK }}>
            {count}명
          </span>{' '}
          참여 중 · 분양 · 시세 · 투자
        </span>

        {/* 모바일 보조 문구 — 참여자 수만 */}
        <span
          className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] sm:hidden"
          style={{ color: INK_SOFT }}
        >
          <span className="font-medium" style={{ color: INK }}>
            {count}명
          </span>
        </span>

        <span className="flex-1" />

        <span
          className="flex-none whitespace-nowrap rounded-full px-[14px] py-[6px] text-[12.5px] font-medium"
          style={{ background: INK, color: YELLOW }}
        >
          참여하기
        </span>
      </a>
    </>
  );
}
