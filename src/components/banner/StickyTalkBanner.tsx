'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { track } from '@/lib/analytics';

const KAKAO_URL = 'https://open.kakao.com/o/gk8TBGyh';

/**
 * 인라인 배너가 들어가는 라우트.
 * 이 라우트에서는 상단 sticky 를 렌더하지 않는다 (같은 페이지 중복 방지).
 * 인라인이 우선하는 이유: 콘텐츠 문맥 내 배너의 전환율이 높고,
 * 상단 고정은 어차피 스크롤로 사라짐.
 */
const INLINE_ROUTES = [
  /^\/blog\/[^/]+$/,
  /^\/apt\/[^/]+$/,
  /^\/apt\/complex\/[^/]+$/,
];

// 헤더(Navigation <header>)가 `sticky top:0 z-index:100` 이라 배너와 top:0 에서 겹친다.
// 헤더 top 을 이 CSS 변수로 오프셋 → 배너가 보일 때는 헤더가 배너 높이만큼 내려가
// 나란히 쌓이고, 배너가 숨으면 0px 로 되돌아가 헤더가 top:0 로 복귀(빈틈 없음).
// 배너가 없는 라우트에서는 변수 미설정 → 헤더는 var(...,0px) 기본값으로 기존과 동일.
const HEADER_OFFSET_VAR = '--talk-banner-h';

export default function StickyTalkBanner() {
  const pathname = usePathname() ?? '';
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const bannerRef = useRef<HTMLDivElement>(null);

  const hasInline = INLINE_ROUTES.some((r) => r.test(pathname));

  useEffect(() => {
    if (hasInline) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 80) {
          setVisible(true); // 최상단 근처에선 항상 표시
        } else if (Math.abs(y - lastY.current) > 10) {
          setVisible(y < lastY.current); // 위로 스크롤 = 표시
        }
        lastY.current = y;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hasInline]);

  // 헤더 오프셋 동기화: 배너 렌더 높이를 CSS 변수로 발행.
  // 배너 표시 → 헤더가 그만큼 내려감 / 배너 숨김·언마운트 → 0 으로 복귀.
  useEffect(() => {
    const root = document.documentElement;
    const reset = () => root.style.setProperty(HEADER_OFFSET_VAR, '0px');

    if (hasInline) {
      reset();
      return reset; // 이 라우트에선 배너 없음 → 헤더 top:0
    }

    const el = bannerRef.current;
    const apply = () => {
      const h = visible && el ? el.offsetHeight : 0;
      root.style.setProperty(HEADER_OFFSET_VAR, `${h}px`);
    };
    apply();
    // ResizeObserver: next/image 로드 시점 높이 변화(특히 모바일 크롭 소스)·회전·
    // 브레이크포인트 전환까지 반영해 헤더 오프셋이 항상 실제 배너 높이와 일치.
    let ro: ResizeObserver | undefined;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(apply);
      ro.observe(el);
    }
    window.addEventListener('resize', apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', apply);
      reset(); // 언마운트/라우트 이동 시 헤더 오프셋 초기화
    };
  }, [visible, hasInline]);

  if (hasInline) return null;

  const handleClick = () => {
    track('banner_click', 'bujeonggong_talk', { slot: 'sticky', page_path: pathname });
  };

  return (
    <div
      ref={bannerRef}
      className={`sticky top-0 z-30 w-full transition-transform duration-300 ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ backgroundColor: '#FED346' }}
    >
      <a
        href={KAKAO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="부정공 TALK — 부동산 정보 공유 카톡방 열기 (새 창)"
        onClick={handleClick}
        className="mx-auto block max-w-[955px]"
      >
        {/* 모바일(≤640px)은 크롭 버전, 그 이상은 원본 */}
        <picture>
          <source
            media="(max-width: 640px)"
            srcSet="/banners/bujeonggong-talk-mobile.webp"
          />
          <Image
            src="/banners/bujeonggong-talk.webp"
            alt="부정공 TALK — 부동산 정보 공유 카톡방"
            width={955}
            height={235}
            quality={82}
            className="h-auto w-full"
          />
        </picture>
      </a>
    </div>
  );
}
