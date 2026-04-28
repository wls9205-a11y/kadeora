// 클라이언트 — 시공사 6 카드. 클릭 시 ?builder= toggle. 활성 시공사 강조.
'use client';

import { useRouter } from 'next/navigation';
import type { BuilderHubRow } from '@/lib/apt-fetcher';

interface Props {
  region: string;
  sigungu: string | null;
  builders: BuilderHubRow[];
  activeBuilder?: string;
  category?: string;
  price?: string;
}

function shortBuilder(name: string): string {
  return name.replace(/\(주\)|주식회사|\s+/g, '').slice(0, 12);
}

function buildHref(builder: string, props: Props): string {
  const p = new URLSearchParams();
  p.set('region', props.region);
  if (props.sigungu) p.set('sigungu', props.sigungu);
  if (props.category && props.category !== 'all') p.set('category', props.category);
  if (props.price) p.set('price', props.price);
  if (props.activeBuilder !== builder) p.set('builder', builder);
  return `/apt?${p.toString()}`;
}

export default function AptBuilderHub(props: Props) {
  const router = useRouter();
  const { region, sigungu, builders, activeBuilder } = props;
  if (!builders || builders.length === 0) return null;
  const label = sigungu ? `${region} ${sigungu}` : region;

  return (
    <section
      aria-label="시공사 hub"
      style={{ maxWidth: 720, margin: '12px auto', padding: '0 var(--sp-lg)' }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        🏗️ {label === '전국' ? '주요 시공사' : `${label} 주요 시공사`}{' '}
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>· {builders.length}개</span>
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 8,
        }}
      >
        {builders.map((b) => {
          const active = activeBuilder === b.builder;
          return (
            <button
              key={b.builder}
              type="button"
              onClick={() => router.replace(buildHref(b.builder, props))}
              aria-pressed={active}
              style={{
                display: 'flex', flexDirection: 'column', gap: 3,
                padding: '12px 12px', textAlign: 'left',
                background: active ? 'var(--brand)' : 'var(--bg-surface)',
                color: active ? 'var(--text-inverse, #fff)' : 'inherit',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                borderRadius: 12, cursor: 'pointer',
                transition: 'transform 100ms ease, box-shadow 100ms ease',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: active ? 'var(--text-inverse, #fff)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shortBuilder(b.builder)}
              </span>
              <span style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.85)' : 'var(--text-tertiary)' }}>
                {region === '전국' ? '' : `${region} `}{b.site_count}건
              </span>
              {b.avg_popularity > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: active ? 'rgba(255,255,255,0.9)' : 'var(--brand)' }}>
                  ⭐ 평균 {b.avg_popularity}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
