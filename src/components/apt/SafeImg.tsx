'use client';
/**
 * H7-3 이미지 3단의 «③ 폴백» 을 «로드 실패 시에도» 보장한다.
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────────────────
 * 3단은 ① hero_image_url(실사) → ② 우리 OG 카드 → ③ 네이비 폴백 이다.
 * ①②는 «주소가 있느냐» 로 갈리는데, 주소가 있어도 «안 열리면» 화면에는 깨진 아이콘이 남는다.
 * H7-3 에서 외부 핫링크 3,108건을 걷어내 그럴 일이 크게 줄었지만, 남은 주소가
 * 전부 우리 것이라고 해서 «항상 200» 인 것은 아니다(OG 생성 실패·스토리지 지연).
 *
 * ⛔ 회색 자리·이니셜 블록·이모지 일러스트를 만들지 «않는다». 실패하면 ③ 그대로다 —
 *    「없는 것을 있는 척하지 않는다」가 이 화면의 규칙이다.
 * ⚠️ 서버 컴포넌트(RegionBlockList·SiteThumb)에서도 «그대로 import 해서» 쓴다.
 *    onError 는 클라이언트에서만 붙으므로 이 경계가 필요하다.
 */

import { useState } from 'react';

export default function SafeImg({
  src,
  alt = '',
  className,
  fallbackClassName = 'kd-thumb-fallback',
  ...rest
}: {
  src: string;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'className'>) {
  const [failed, setFailed] = useState(false);

  // ⚠️ aria-hidden 이다. 폴백은 «정보를 담지 않는다» — 이름은 옆 텍스트가 이미 말한다.
  if (failed) return <span className={fallbackClassName} aria-hidden="true" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
