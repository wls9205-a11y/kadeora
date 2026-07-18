'use client';

import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';

const KAKAO_URL = 'https://open.kakao.com/o/gk8TBGyh';

/** 배너 높이(px). spacer 와 공유. */
export const STICKY_BANNER_HEIGHT = 52;

/**
 * 오픈채팅 참여자 수 — 수동 갱신.
 * 카카오가 API 를 제공하지 않아 직접 넣는다.
 *
 * ⚠️ 갱신 안 하면 숫자가 낡아 신뢰를 깎는다. 월 1회는 확인할 것.
 *    카톡방 우측 상단 참여자 수를 보고 아래 상수와 이 주석의 날짜를 같이 고친다.
 *
 * 마지막 갱신: 2026-07-18
 */
const MEMBER_COUNT = 1240;

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
const LIVE = '#1FA463';

export default function StickyTalkBanner() {
  const pathname = usePathname() ?? '';

  if (INLINE_ROUTES.some((r) => r.test(pathname))) return null;

  const handleClick = () => {
    track('banner_click', 'bujeonggong_talk', {
      slot: 'sticky',
      page_path: pathname,
    });
  };

  const count = MEMBER_COUNT.toLocaleString();

  return (
    <>
      {/* fixed 배너가 덮는 최상단 공간을 flow 에서 확보 */}
      <div aria-hidden="true" style={{ height: STICKY_BANNER_HEIGHT }} />

      <a
        href={KAKAO_URL}
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
