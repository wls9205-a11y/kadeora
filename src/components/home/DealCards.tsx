// C-0 블록 4 — 「지금 계약 가능한 현장」 카드.
//
// ── ⚠️ /api/og-apt 를 부르지 않는다 ──
// 카드 4장이면 satori 렌더 4회다. `/api/og` D2~D6 원인이 아직 안 잡혔다.
// 이미지는 SiteThumb 에 맡긴다 — 미리 구운 card_image_url 이 있으면 그걸 쓰고,
// 없으면 HTTP 0회로 CSS 카드를 그린다.
//
// ── ⚠️ 위성 이미지 금지 ──
// 이 블록은 계약 가능한 현장이라 준공 전이 대부분이다. 위성을 깔면 아직 없는
// 건물 자리의 공터가 보인다. 걸러 내는 판정은 SiteThumb 안에 이미 있다.
//
// ── ⚠️ 라이선스 ──
// leadContext 를 넘기지 않는다. canUseHeroImage 가 lifecycle_stage 로 판정하게 두면
// 상세와 같은 결론이 나온다. 여기서 따로 true/false 를 박으면 판정이 두 곳이 된다.

import Link from 'next/link';
import SiteThumb from '@/components/apt/SiteThumb';

export interface DealSite {
  slug: string;
  name: string;
  region: string | null;
  sigungu: string | null;
  curated_status: string | null;
  lifecycle_stage: string | null;
  price_min: number | null;
  price_max: number | null;
  hero_image_url: string | null;
  card_image_url: string | null;
  hero_license_tier: string | null;
}

/**
 * 분양가 한 줄.
 * ⚠️ price_min/max 는 **만원** 단위다. 그대로 「원」으로 읽으면 5억이 5만원이 된다.
 * ⚠️ 값이 없으면 지어내지 않고 「분양가 미정」으로 둔다(표시광고법).
 */
function priceLine(row: DealSite): string {
  const { price_min: lo, price_max: hi } = row;
  if (!lo || !hi) return '분양가 미정';
  const a = Math.round((lo / 10000) * 10) / 10;
  const b = Math.round((hi / 10000) * 10) / 10;
  return a === b ? `${a}억` : `${a}~${b}억`;
}

/** 좌상단 태그. 단계 구분은 배경색이 아니라 이 태그로 한다. */
function tagOf(row: DealSite): { label: string; bg: string; fg: string } | null {
  switch ((row.curated_status ?? '').trim()) {
    case '선착순':
      return { label: '선착순', bg: 'var(--accent-orange-bg)', fg: 'var(--accent-orange)' };
    case '잔여세대':
      return { label: '잔여세대', bg: 'var(--accent-red-bg)', fg: 'var(--accent-red)' };
    case '분양중':
      // ⚠️ fg 로 --accent-blue(#2563EB)를 쓰면 제 배경(10% 틴트) 위에서 대비가 4.49 다 —
      //    4.5:1 하한에 0.01 모자란다. TY1-2 에서 이 배지 굵기를 800→500 으로 낮췄으니
      //    얇아진 만큼 더 불리하다. 형제 토큰(주황 #9A3412 · 빨강 #991B1B)은 둘 다
      //    «어두운 변형» 인데 accent-blue 만 밝은 브랜드색이라 혼자 어긋나 있었다.
      //    --brand-dark(#1E40AF)로 맞추면 7.57 이고 세 배지의 농도도 나란해진다.
      return { label: '분양중', bg: 'var(--accent-blue-bg)', fg: 'var(--brand-dark)' };
    default:
      return null;
  }
}

export default function DealCards({ items }: { items: DealSite[] }) {
  if (items.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 10,
        padding: '0 3px',
      }}
    >
      {items.map((row) => {
        const tag = tagOf(row);
        const where = [row.region, row.sigungu].filter(Boolean).join(' ') || '지역 미정';
        return (
          <Link
            key={row.slug}
            href={`/apt/${encodeURIComponent(row.slug)}`}
            style={{
              display: 'block',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ position: 'relative' }}>
              <SiteThumb
                slug={row.slug}
                name={row.name}
                thumbUrl={row.hero_image_url}
                cardImageUrl={row.card_image_url}
                lifecycleStage={row.lifecycle_stage}
                heroLicenseTier={row.hero_license_tier}
                palette="brand"
                size={104}
                width="100%"
              />
              {tag && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    fontSize: 10,
                    fontWeight: 500,
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-pill)',
                    background: tag.bg,
                    color: tag.fg,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tag.label}
                </span>
              )}
            </div>

            <div style={{ padding: '8px 10px 10px' }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--text-primary)',
                }}
              >
                {row.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{where}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginTop: 2 }}>
                {priceLine(row)}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
