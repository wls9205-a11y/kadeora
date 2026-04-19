'use client';

/**
 * SafeImage — next/image 래퍼. src 실패 시 OG fallback 자동 대체.
 *
 * 용법:
 *   <SafeImage src={blogThumb(post)} alt={post.title} width={800} height={450} />
 */

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';
import { SITE_URL } from '@/lib/constants';

type SafeImageProps = Omit<ImageProps, 'src'> & {
  src: string;
  fallbackTitle?: string;
  fallbackDesign?: number;
};

const SITE = SITE_URL.replace(/\/$/, '') || 'https://kadeora.app';

export default function SafeImage({ src, alt, fallbackTitle, fallbackDesign = 2, ...rest }: SafeImageProps) {
  const [current, setCurrent] = useState<string>(src || buildOg(fallbackTitle || String(alt || 'kadeora'), fallbackDesign));
  const [failed, setFailed] = useState(false);

  return (
    <Image
      {...rest}
      alt={alt}
      src={current}
      onError={() => {
        if (failed) return; // 무한 루프 방지
        setFailed(true);
        setCurrent(buildOg(fallbackTitle || String(alt || 'kadeora'), fallbackDesign));
      }}
    />
  );
}

function buildOg(title: string, design: number): string {
  return `${SITE}/api/og?title=${encodeURIComponent(title.slice(0, 60))}&design=${design}`;
}
