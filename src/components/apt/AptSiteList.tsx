// 서버 컴포넌트 — fetchSiteList 결과 N개를 카드 그리드로 렌더.
// 모바일 1열, 데스크톱 3열.

import Link from 'next/link';
import type { AptSiteRow, AptCategory } from '@/lib/apt-fetcher';

const CATEGORY_TITLE: Record<AptCategory, string> = {
  all: '단지 목록',
  subscription: '🏗️ 분양 진행 중',
  imminent_d7: '⏰ 청약 임박 D-7',
  unsold: '📉 미분양 단지',
  redev: '🏚️ 재개발·재건축',
  trade: '📊 실거래 활성',
};

function fmtPrice(min: number | null, max: number | null): string | null {
  // price_min/max 단위 만원 가정.
  const fmt = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}억` : `${v.toLocaleString()}만`;
  if (min && max && min !== max) return `${fmt(min)}~${fmt(max)}`;
  if (max) return fmt(max);
  if (min) return fmt(min);
  return null;
}

function pickThumb(site: AptSiteRow): string | null {
  const imgs = Array.isArray(site.images) ? site.images : [];
  if (imgs.length > 0) {
    const first = typeof imgs[0] === 'string' ? imgs[0] : (imgs[0] as any)?.url;
    if (first && typeof first === 'string') return first;
  }
  if (site.satellite_image_url) return site.satellite_image_url;
  if (site.og_image_url) return site.og_image_url;
  return null;
}

interface Props {
  sites: AptSiteRow[];
  category: AptCategory;
  region: string;
  sigungu: string | null;
}

export default function AptSiteList({ sites, category, region, sigungu }: Props) {
  if (!sites || sites.length === 0) {
    return (
      <section
        aria-label={CATEGORY_TITLE[category]}
        style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>{CATEGORY_TITLE[category]}</h2>
        <div style={{
          padding: '32px 16px', textAlign: 'center',
          background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 12,
          fontSize: 13, color: 'var(--text-tertiary)',
        }}>
          {sigungu ?? region} 에 해당 카테고리의 단지가 없습니다.
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={CATEGORY_TITLE[category]}
      style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        {CATEGORY_TITLE[category]}{' '}
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>· {sigungu ?? region}</span>
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        {sites.map((s) => {
          const thumb = pickThumb(s);
          const price = fmtPrice(s.price_min, s.price_max);
          const sub = [s.sigungu || s.region, s.builder, s.total_units ? `${Number(s.total_units).toLocaleString()}세대` : null].filter(Boolean).join(' · ');
          return (
            <Link
              key={s.id}
              href={`/apt/${encodeURIComponent(s.slug)}`}
              style={{
                display: 'flex', flexDirection: 'column',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 12, overflow: 'hidden',
                textDecoration: 'none', color: 'inherit',
              }}
            >
              {thumb ? (
                <img
                  src={thumb} alt={s.name}
                  width={220} height={120}
                  style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block', background: 'var(--bg-hover)' }}
                  loading="lazy" decoding="async"
                />
              ) : (
                <div style={{ height: 120, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 11 }}>
                  이미지 준비 중
                </div>
              )}
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub || '-'}</div>
                {price && (
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>{price}</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
