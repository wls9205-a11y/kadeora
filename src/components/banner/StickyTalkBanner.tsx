'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';

const KAKAO_URL = 'https://open.kakao.com/o/gk8TBGyh';

/** 배너 높이(px). 상단 spacer 와 반드시 일치. Navigation 등 소비처에서 import 해 쓸 것. */
export const STICKY_BANNER_HEIGHT = 52;

/**
 * 인라인 배너가 들어가는 라우트 — 여기선 상단 배너를 렌더하지 않는다.
 * 같은 페이지에 배너가 둘 뜨는 걸 막는다. 인라인이 우선.
 */
const INLINE_ROUTES = [
  /^\/blog\/[^/]+$/,
  /^\/apt\/[^/]+$/,
  /^\/apt\/complex\/[^/]+$/,
];

const YELLOW = '#FED346';
const INK = '#2B1616';
const INK_SOFT = '#6B4A16';

// 디자인 B(순수 CSS, 52px)를 position:fixed 로 구현한다.
// 이유: globals.css 의 `html,body{overflow-x:hidden}` 가 position:sticky 를 앱 전역에서
// 깨뜨려(스크롤 시 pin 안 됨 — 기존 Navigation 헤더도 동일) sticky 로는 "스크롤 다운 숨김/
// 업 복귀" 가 동작하지 않는다(2026-07-18 프로덕션 실측). fixed 는 overflow 영향을 받지
// 않으므로 pin·hide·show 가 정상 동작한다. fixed 는 flow 에서 빠지므로 같은 높이의 spacer 로
// 아래 콘텐츠(Navigation 포함)를 밀어 겹침을 방지한다 → Navigation top 조정 불필요.
export default function StickyTalkBanner() {
  const pathname = usePathname() ?? '';
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  const hasInline = INLINE_ROUTES.some((r) => r.test(pathname));

  useEffect(() => {
    if (hasInline) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 80) setVisible(true);
        else if (Math.abs(y - lastY.current) > 10) setVisible(y < lastY.current);
        lastY.current = y;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hasInline]);

  if (hasInline) return null;

  const handleClick = () => {
    track('banner_click', 'bujeonggong_talk', { slot: 'sticky', page_path: pathname });
  };

  return (
    <>
      {/* spacer — fixed 배너가 덮는 최상단 공간을 flow 에서 확보(콘텐츠 겹침 방지) */}
      <div aria-hidden="true" style={{ height: STICKY_BANNER_HEIGHT }} />
      <a
        href={KAKAO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="부정공 톡 — 부동산 정보 공유 카톡방 열기 (새 창)"
        onClick={handleClick}
        className={`fixed left-0 top-0 z-[110] flex w-full items-center gap-[11px] px-4 no-underline transition-transform duration-300 ${
          visible ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{ background: YELLOW, height: STICKY_BANNER_HEIGHT }}
      >
        <span
          className="flex flex-none items-center justify-center rounded-full"
          style={{ width: 26, height: 26, background: INK }}
          aria-hidden="true"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={YELLOW}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 20l1.3-3.9A9 8 0 1 1 7.7 19L3 20" />
          </svg>
        </span>

        <span
          className="flex-none whitespace-nowrap text-[14.5px] font-medium tracking-[-0.01em]"
          style={{ color: INK }}
        >
          부정공 톡
        </span>

        <span
          className="hidden overflow-hidden text-ellipsis whitespace-nowrap text-[13px] sm:inline"
          style={{ color: INK_SOFT }}
        >
          부동산 정보 공유방
        </span>

        <span className="flex-1" />

        <span
          className="flex-none whitespace-nowrap rounded-full px-[14px] py-[6px] text-[12.5px] font-medium"
          style={{ background: INK, color: YELLOW }}
        >
          무료 입장
        </span>
      </a>
    </>
  );
}
