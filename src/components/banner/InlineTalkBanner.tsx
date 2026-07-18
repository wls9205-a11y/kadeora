'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';

const KAKAO_URL = 'https://open.kakao.com/o/gk8TBGyh';

type Props = {
  /** 추가 여백/스타일 조정용 */
  className?: string;
};

/**
 * 콘텐츠 내 인라인 배너.
 * 클릭 트래킹(user_events)을 위해 'use client' + onClick.
 *
 * ⚠️ DB 본문에 삽입 금지. 반드시 렌더 시점에 컴포넌트로 끼울 것.
 * ⚠️ AdSense 유닛과 최소 250px 간격 확보.
 */
export default function InlineTalkBanner({ className = '' }: Props) {
  const pathname = usePathname() ?? '';

  const handleClick = () => {
    track('banner_click', 'bujeonggong_talk', { slot: 'inline', page_path: pathname });
  };

  return (
    <div className={`my-8 ${className}`}>
      <a
        href={KAKAO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="부정공 TALK — 부동산 정보 공유 카톡방 열기 (새 창)"
        onClick={handleClick}
        className="block overflow-hidden rounded-xl shadow-sm transition-shadow hover:shadow-md"
      >
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
            loading="lazy"
            sizes="(max-width: 768px) 100vw, 768px"
            className="h-auto w-full"
          />
        </picture>
      </a>
    </div>
  );
}
