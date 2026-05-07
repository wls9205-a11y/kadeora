'use client';

import { useEffect } from 'react';

interface AdSlotProps {
  /** AdSense 슬롯 ID. 미지정 시 블로그 본문하단 슬롯 사용 */
  slotId?: string;
  /** 'display' (auto) | 'in-article' (fluid) */
  format?: 'display' | 'in-article';
  className?: string;
  style?: React.CSSProperties;
}

const PUBLISHER_ID = 'ca-pub-2356113563328542';
const SLOT_BLOG_BOTTOM = '8739799675';

/**
 * Google AdSense 광고 슬롯 컴포넌트.
 * Architecture Rule #45: /blog/[slug] 본문에만 노출.
 *
 * 슬롯 ID는 secret 아님 (클라이언트 노출되는 값) → 하드코딩.
 * 추후 다른 위치 슬롯 추가 시 props로 slotId 전달.
 */
export function AdSlot({
  slotId = SLOT_BLOG_BOTTOM,
  format = 'display',
  className = '',
  style,
}: AdSlotProps) {
  useEffect(() => {
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (e) {
      console.error('[AdSlot] push failed:', e);
    }
  }, []);

  const isInArticle = format === 'in-article';

  return (
    <div className={className} style={{ margin: '24px 0', minHeight: 100, ...style }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 4 }}>
        광고
      </div>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', textAlign: 'center' }}
        data-ad-client={PUBLISHER_ID}
        data-ad-slot={slotId}
        data-ad-format={isInArticle ? 'fluid' : 'auto'}
        {...(isInArticle ? { 'data-ad-layout': 'in-article' } : {})}
        data-full-width-responsive="true"
      />
    </div>
  );
}
