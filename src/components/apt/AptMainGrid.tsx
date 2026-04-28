'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { pickBestAptImage, pickImageCaption } from '@/lib/aptImage';
import type { AptSiteRow, AptCategory, AptSortKey } from '@/lib/apt-fetcher';

const CATEGORY_TITLE: Record<AptCategory, string> = {
  all: '단지 목록',
  subscription: '🏗️ 분양 진행 중',
  imminent_d7: '⏰ 청약 임박 D-7',
  unsold: '📉 미분양 단지',
  redev: '🏚️ 재개발·재건축',
  trade: '📊 실거래 활성',
};

const SORT_OPTIONS: { key: AptSortKey; label: string }[] = [
  { key: 'popularity', label: '인기순' },
  { key: 'price',      label: '가격순' },
  { key: 'units',      label: '세대수순' },
  { key: 'move_in',    label: '입주일순' },
];

function fmtPrice(min: number | null, max: number | null): string | null {
  const fmt = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}억` : `${v.toLocaleString()}만`;
  if (min && max && min !== max) return `${fmt(min)}~${fmt(max)}`;
  if (max) return fmt(max);
  if (min) return fmt(min);
  return null;
}

interface Props {
  sites: AptSiteRow[];
  category: AptCategory;
  region: string;
  sigungu: string | null;
  sort: AptSortKey;
  page: number;             // 1, 2, 3 누적 모델
  perPage?: number;         // default 12
  // URL state 보존용
  price?: string;
  size?: string;
  builder?: string;
}

function buildHref(p: Props, override: Partial<{ sort: string; page: number }>): string {
  const params = new URLSearchParams();
  params.set('region', p.region);
  if (p.sigungu) params.set('sigungu', p.sigungu);
  if (p.category !== 'all') params.set('category', p.category);
  if (p.price) params.set('price', p.price);
  if (p.size) params.set('size', p.size);
  if (p.builder) params.set('builder', p.builder);
  const sort = override.sort ?? p.sort;
  if (sort && sort !== 'popularity') params.set('sort', sort);
  const page = override.page ?? p.page;
  if (page && page > 1) params.set('page', String(page));
  return `/apt?${params.toString()}`;
}

export default function AptMainGrid(props: Props) {
  const router = useRouter();
  const { sites, category, region, sigungu, sort, page } = props;
  const perPage = props.perPage ?? 12;
  const canShowMore = sites.length >= perPage * page;  // 가득 찼으면 다음 페이지 가능
  const label = sigungu ?? region;

  if (!sites || sites.length === 0) {
    return (
      <section
        aria-label={CATEGORY_TITLE[category]}
        style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{CATEGORY_TITLE[category]}</h2>
        </div>
        <div style={{
          padding: '32px 16px', textAlign: 'center',
          background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 12,
          fontSize: 13, color: 'var(--text-tertiary)',
        }}>
          {label} 에 해당 카테고리의 단지가 없습니다.
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={CATEGORY_TITLE[category]}
      style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          {CATEGORY_TITLE[category]}{' '}
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>· {label}</span>
        </h2>
        <select
          value={sort}
          onChange={(e) => router.replace(buildHref(props, { sort: e.target.value, page: 1 }))}
          aria-label="정렬"
          style={{
            padding: '6px 10px', fontSize: 11, fontWeight: 700,
            background: 'var(--bg-hover)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', borderRadius: 999,
            cursor: 'pointer', outline: 'none',
          }}
        >
          {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        {sites.map((s) => {
          const thumb = pickBestAptImage(s);
          const caption = pickImageCaption(s.images);
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
                minHeight: 280,
                transition: 'transform 100ms ease, box-shadow 100ms ease',
              }}
            >
              <div style={{ position: 'relative', height: 168, background: 'var(--bg-hover)' }}>
                {thumb ? (
                  <img
                    src={thumb} alt={s.name}
                    width={220} height={168}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy" decoding="async"
                  />
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 22 }}>🏢</div>
                )}
                {caption && (
                  <span style={{
                    position: 'absolute', top: 8, right: 8,
                    padding: '3px 8px', borderRadius: 999,
                    fontSize: 9, fontWeight: 800,
                    background: 'var(--brand)', color: 'var(--text-inverse, #fff)',
                  }}>
                    {caption}
                  </span>
                )}
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sub || '-'}
                </div>
                {price && (
                  <div style={{ marginTop: 'auto', fontSize: 13, fontWeight: 800, color: 'var(--brand)' }}>{price}</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {canShowMore && page < 5 && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => router.replace(buildHref(props, { page: page + 1 }))}
            style={{
              padding: '10px 22px', borderRadius: 999,
              fontSize: 13, fontWeight: 700,
              background: 'var(--bg-hover)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            더 보기 ({(page + 1) * perPage}건까지) ▾
          </button>
        </div>
      )}
    </section>
  );
}
