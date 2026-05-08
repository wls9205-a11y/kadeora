// 서버 — fetchHeroSite 결과 1개를 큰 사진 카드로 강조 (240px 사진 + KPI overlay).
// 우선순위: 조감도/모델/투시 > 배치도/평면 > 미분류 > satellite > og.
import Link from 'next/link';
import { pickBestAptImage, pickImageCaption } from '@/lib/aptImage';
import type { AptSiteRow } from '@/lib/apt-fetcher';
import AptImagePlaceholder from '@/components/apt/_shared/AptImagePlaceholder';

const LIFECYCLE_LABEL: Record<string, string> = {
  site_planning: '부지계획', pre_announcement: '분양 예고',
  model_house_open: '모델하우스', special_supply: '특별공급',
  subscription_open: '청약 진행', contract: '계약',
  construction: '시공', pre_move_in: '입주 예정',
  move_in: '입주', resale: '실거래', unsold_active: '미분양',
  award_announced: '당첨자 발표', post_move_in: '입주 후',
};

interface Props {
  site: AptSiteRow;
  region: string;
  sigungu: string | null;
}

// s236 W6: satellite filter + og fallback watermark helpers
const isSatellite = (url: string | null | undefined) =>
  !url ? false : /maps\.googleapis|staticmap|openstreetmap|\/satellite\//i.test(url);
const isOgFallback = (url: string | null | undefined) =>
  !url ? false : /kadeora\.app\/api\/og/i.test(url);

export default function AptHeroLarge({ site, region, sigungu }: Props) {
  const rawThumb = pickBestAptImage(site);
  const thumb = isSatellite(rawThumb) ? null : rawThumb;
  const showOgBadge = isOgFallback(thumb);
  const caption = pickImageCaption(site.images);
  const lifecycle = site.lifecycle_stage ? (LIFECYCLE_LABEL[site.lifecycle_stage] || site.lifecycle_stage) : null;
  const sub = [site.region, site.sigungu, site.dong].filter(Boolean).join(' ');

  return (
    <section
      aria-label="추천 단지"
      style={{ maxWidth: 720, margin: '8px auto 12px', padding: '0 var(--sp-lg)' }}
    >
      <Link
        href={`/apt/${encodeURIComponent(site.slug)}`}
        style={{
          display: 'block', position: 'relative',
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14,
          overflow: 'hidden',
          textDecoration: 'none', color: 'inherit',
          minHeight: 320,
          transition: 'transform 100ms ease, box-shadow 100ms ease',
        }}
      >
        {/* 사진 영역 — 240px (전체 320 의 ~75%) */}
        <div style={{ position: 'relative', height: 240, background: 'var(--bg-hover)', overflow: 'hidden' }}>
          {thumb ? (
            <>
              <img
                src={thumb} alt={site.name}
                width={720} height={240}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                loading="eager" decoding="async"
              />
              {showOgBadge && !caption && (
                <span style={{
                  position: 'absolute', top: 10, right: 10, zIndex: 3,
                  padding: '3px 8px', borderRadius: 6,
                  fontSize: 10, fontWeight: 700,
                  background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.92)',
                  backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                }}>
                  사진 준비중
                </span>
              )}
            </>
          ) : (
            <AptImagePlaceholder name={site.name} aspectRatio="3/1" />
          )}

          {/* tag — 좌상단 */}
          <span style={{
            position: 'absolute', top: 10, left: 10,
            padding: '4px 10px', borderRadius: 999,
            fontSize: 10, fontWeight: 800,
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          }}>
            ⭐ {sigungu ?? region} · 추천
          </span>

          {/* caption chip — 우상단 (조감도/모델/배치도 매칭 시만) */}
          {caption && (
            <span style={{
              position: 'absolute', top: 10, right: 10,
              padding: '4px 10px', borderRadius: 999,
              fontSize: 10, fontWeight: 700,
              background: 'var(--brand)', color: 'var(--text-inverse, #fff)',
            }}>
              {caption}
            </span>
          )}

          {/* 그라데이션 오버레이 — 가독성 위해 */}
          <div aria-hidden style={{
            position: 'absolute', inset: 'auto 0 0 0', height: '50%',
            background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 100%)',
            pointerEvents: 'none',
          }} />

          {/* title overlay — 사진 하단 */}
          <div style={{
            position: 'absolute', left: 14, right: 14, bottom: 12,
            display: 'flex', flexDirection: 'column', gap: 3,
            color: '#fff',
          }}>
            <h2 style={{
              margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.25,
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {site.name}
            </h2>
            <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.92, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
              {sub}{site.builder ? ` · ${site.builder}` : ''}
            </span>
          </div>
        </div>

        {/* KPI 영역 — 사진 아래 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          padding: '12px 14px',
          gap: 8,
        }}>
          <div style={kpiCellStyle()}>
            <span style={kpiValueStyle()}>{lifecycle ?? '-'}</span>
            <span style={kpiLabelStyle()}>단계</span>
          </div>
          <div style={kpiCellStyle()}>
            <span style={kpiValueStyle()}>
              {site.total_units ? Number(site.total_units).toLocaleString() : '-'}
            </span>
            <span style={kpiLabelStyle()}>세대수</span>
          </div>
          <div style={kpiCellStyle()}>
            <span style={{ ...kpiValueStyle(), color: site.popularity_score && site.popularity_score !== 100 ? 'var(--brand)' : 'var(--text-primary)' }}>
              {site.popularity_score && site.popularity_score !== 100 ? `★ ${site.popularity_score}` : '-'}
            </span>
            <span style={kpiLabelStyle()}>인기</span>
          </div>
        </div>
      </Link>
    </section>
  );
}

function kpiCellStyle(): React.CSSProperties {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
    padding: '4px 0',
  };
}
function kpiValueStyle(): React.CSSProperties {
  return {
    fontSize: 14, fontWeight: 800, color: 'var(--text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
  };
}
function kpiLabelStyle(): React.CSSProperties {
  return { fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1 };
}
