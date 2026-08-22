'use client';

import Image from 'next/image';
import { KAKAO_TALK_URL, trackTalkClick } from '@/lib/talk-banner';
import { useTalkView } from './useTalkView';

type Props = {
  /** 추가 여백/스타일 조정용 */
  className?: string;
};

/**
 * 콘텐츠 내 인라인 이미지 배너 — 현재는 블로그 상세 전용.
 * 클릭 트래킹(user_events)을 위해 'use client' + onClick.
 *
 * ⚠️ DB 본문에 삽입 금지. 반드시 렌더 시점에 컴포넌트로 끼울 것.
 * ⚠️ AdSense 유닛과 최소 250px 간격 확보.
 *
 * s-v2: /apt/[id] 에서는 걷어냈다. 30일 1클릭 — 광고처럼 보이고 현장 맥락이 없다.
 *       상세에서는 SiteTalkCTA(텍스트·현장명 포함)가 이 자리를 대신한다.
 *       블로그는 이번 범위 밖이라 그대로 둔다.
 */
export default function InlineTalkBanner({ className = '' }: Props) {
  const viewRef = useTalkView<HTMLDivElement>('inline');

  return (
    <div ref={viewRef} className={`my-8 ${className}`}>
      <a
        href={KAKAO_TALK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="부정공 TALK — 부동산 정보 공유 카톡방 열기 (새 창)"
        onClick={() => trackTalkClick('inline')}
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
