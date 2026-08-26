// 현장 목록 썸네일 — H2-2.
//
// ── ⚠️ 브라우저에서 `/api/og-apt` 를 부르지 않는다 ──
// RPC 의 `thumb_url` 은 마지막 폴백이 `/api/og-apt?slug=…` 다. 그대로 <img src> 에 박으면
// 목록 한 화면에 satori 렌더가 그 수만큼 돈다(홈 4장 = 4회). 이미지가 없는 현장이
// 5,933/6,033 이라 대부분이 그 경로로 떨어진다.
// → 생성 카드 URL 이 오면 **HTTP 0회로 CSS 카드를 그린다.**
//
// ⚠️ 미리 구운 `card_image_url` 은 실재한다(실측 100건, apt-card-build 크론).
//    있으면 그걸 쓰고, 없으면 CSS 로 그린다. 「컬럼이 없다」는 말은 사실과 다르다.
//
// ── ⚠️ 위성 사진은 조감도가 아니다 ──
// 준공 전 현장에 위성을 깔면 아직 없는 건물 자리의 공터·기존 주택이 보인다.
// 기축(post_move_in · active_trade · landmark_active)만 실물이 있어 위성이 정확하다.
//
// ── ⚠️ 라이선스 ──
// review·판정 전 이미지는 리드폼이 뜨는 현장에서 쓰지 않는다 (lib/apt/hero-license.ts).
// 목록은 광고 랜딩이 아니지만, 같은 이미지가 상세에서 빠지는데 목록에 남으면 화면이 갈린다.
// 판정을 한 곳에서 하고 둘 다 그 결과를 쓴다.

import { canUseHeroImage } from '@/lib/apt/hero-license';
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';

/** 실물이 있어 위성 사진이 정확한 단계. */
const EXISTING_STAGES = new Set(['post_move_in', 'active_trade', 'landmark_active']);

/** 생성 카드로 떨어진 URL 인가. 이게 오면 부르지 않고 직접 그린다. */
function isGeneratedCard(url: string): boolean {
  return url.startsWith('/api/og-apt') || url.includes('/api/og-apt?');
}

/**
 * slug 에서 색을 만든다. 같은 현장은 항상 같은 색이라 목록이 흔들리지 않는다.
 * ⚠️ Math.random 을 쓰지 않는다 — 서버·클라이언트 렌더가 갈리면 하이드레이션이 깨진다.
 */
function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/**
 * 실제로 <img> 로 띄울 주소. 없으면 '' — 그러면 CSS 로 그린다.
 *
 * ⚠️ 컴포넌트 밖으로 뺀 이유는 **테스트로 잠그기 위해서**다.
 *    「생성 카드 URL 이 오면 부르지 않는다」가 이 파일의 존재 이유인데
 *    JSX 안에 묻어 두면 회귀가 조용히 들어온다.
 */
export function pickThumbSrc(opts: {
  thumbUrl?: string | null;
  cardImageUrl?: string | null;
  lifecycleStage?: string | null;
  heroLicenseTier?: string | null;
  leadContext?: boolean;
}): string {
  const licenseOk = canUseHeroImage({
    tier: opts.heroLicenseTier,
    lifecycleStage: opts.lifecycleStage,
    leadContext: opts.leadContext,
  });
  const raw = (opts.thumbUrl ?? '').trim();
  const isExisting = EXISTING_STAGES.has((opts.lifecycleStage ?? '').trim());
  const photo =
    raw && !isGeneratedCard(raw) && licenseOk && (isExisting || !raw.includes('satellite'))
      ? raw
      : '';
  return photo || (opts.cardImageUrl ?? '').trim();
}

export interface SiteThumbProps {
  slug: string;
  name: string;
  /** RPC 가 주는 값. `/api/og-apt…` 면 CSS 로 그린다. */
  thumbUrl?: string | null;
  /** 미리 구운 카드. 있으면 우선한다. */
  cardImageUrl?: string | null;
  lifecycleStage?: string | null;
  heroLicenseTier?: string | null;
  /** 이 자리가 리드폼이 뜨는 문맥인가. 목록은 기본 false. */
  leadContext?: boolean;
  size?: number;
  className?: string;
  /**
   * CSS 폴백 카드의 색.
   *
   *   'auto'   slug 해시 색상. 목록에서 현장끼리 구분되라고 쓴다(기본).
   *   'brand'  브랜드 네이비 + 골드. 홈 「지금 계약 가능한 현장」처럼
   *            카드가 크게 서는 자리에서 쓴다. 미리 구운 card_image_url 과 같은 색이라
   *            사진 있는 카드와 없는 카드가 한 줄에 섞여도 갈라 보이지 않는다.
   *
   * ⚠️ 목록(H2-2)의 기본값을 바꾸지 않는다. 56px 썸네일이 전부 같은 남색이 되면
   *    현장이 구분되지 않는다.
   */
  palette?: 'auto' | 'brand';
  /**
   * 가로. 안 주면 size(정사각). 카드 상단처럼 폭을 꽉 채워야 하면 '100%' 를 준다.
   * ⚠️ '100%' 를 주면 <img> 의 width/height 속성은 붙이지 않는다 — 숫자 속성과
   *    퍼센트 스타일이 같이 붙으면 브라우저가 종횡비를 잘못 잡는다.
   */
  width?: number | string;
}

export default function SiteThumb({
  slug,
  name,
  thumbUrl,
  cardImageUrl,
  lifecycleStage,
  heroLicenseTier,
  leadContext = false,
  size = 56,
  className,
  palette = 'auto',
  width,
}: SiteThumbProps) {
  const src = pickThumbSrc({ thumbUrl, cardImageUrl, lifecycleStage, heroLicenseTier, leadContext });

  const box: React.CSSProperties = {
    width: width ?? size,
    height: size,
    flexShrink: 0,
    borderRadius: 'var(--radius-sm, 8px)',
    overflow: 'hidden',
  };

  if (src) {
    const fluid = typeof box.width === 'string';
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        {...(fluid ? {} : { width: size, height: size })}
        loading="lazy"
        decoding="async"
        className={className}
        style={{ ...box, objectFit: 'cover', background: 'var(--bg-elevated)' }}
      />
    );
  }

  /* ── CSS 카드 — HTTP 0회 ── */
  const hue = hueOf(slug || name);
  const stage = lifecycleLabel(lifecycleStage);
  // 이름이 길면 앞 두 글자만. 목록 56px 에 문장을 넣으면 뭉개진다.
  const initials = (name || '').replace(/^(부산|울산|경남|서울|경기|대구|인천|광주|대전)\s+/, '').slice(0, 2);
  const isBrand = palette === 'brand';

  return (
    <div
      className={className}
      aria-hidden
      style={{
        ...box,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        // 브랜드 네이비는 미리 구운 카드(og-apt)와 같은 3색이다. 두 카드가 한 줄에
        // 섞여도 배경이 갈라지지 않게 값을 맞춰 둔다 — 바꿀 때 og-apt 도 같이 본다.
        background: isBrand
          ? 'linear-gradient(135deg, #0B2A6B 0%, #123A8F 55%, #2563EB 100%)'
          : `linear-gradient(135deg, hsl(${hue} 42% 34%), hsl(${(hue + 38) % 360} 46% 22%))`,
        color: '#fff',
      }}
    >
      <span style={{ fontSize: Math.round(size * (isBrand ? 0.22 : 0.3)), fontWeight: 600, lineHeight: 1 }}>
        {initials}
      </span>
      {isBrand ? (
        // 브랜드 줄만 골드. 단계는 배경이 아니라 카드 좌상단 태그로 가른다.
        <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1.2, color: '#FFC53D', lineHeight: 1 }}>
          KADEORA
        </span>
      ) : (
        stage && size >= 56 && (
          <span style={{ fontSize: 8, opacity: 0.85, lineHeight: 1, whiteSpace: 'nowrap' }}>
            {stage}
          </span>
        )
      )}
    </div>
  );
}
