import React from 'react';
// V13 A-2: 단계 라벨 단일 원본.
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';


interface Props {
  site: {
    name: string;
    region?: string | null;
    sigungu?: string | null;
    dong?: string | null;
    builder?: string | null;
    total_units?: number | null;
    lifecycle_stage?: string | null;
  };
  interestCount?: number | null;
}

export default function AptHero({ site, interestCount }: Props) {
  const region = [site.region, site.sigungu, site.dong].filter(Boolean).join(' ');
  const lifecycle = lifecycleLabel(site.lifecycle_stage);
  const meta: string[] = [];
  if (site.builder) meta.push(site.builder);
  if (site.total_units) meta.push(`${site.total_units.toLocaleString()}세대`);

  return (
    <section
      aria-label={`${site.name} 단지 헤더`}
      style={{
        background: '#0F0F0E',
        color: '#FFFFFF',
        margin: '0 -16px 16px',
        padding: '20px 16px 22px',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {lifecycle && (
          <span style={{ fontSize: 12, fontWeight: 800, color: '#FFD688', padding: '4px 10px', borderRadius: 999, background: 'rgba(255,214,136,0.14)', border: '1px solid rgba(255,214,136,0.36)' }}>
            {lifecycle}
          </span>
        )}
        {region && (
          <span style={{ fontSize: 12, color: '#B4B2A9', fontWeight: 600 }}>{region}</span>
        )}
      </div>
      {/* s2: 상세 페이지의 h1 은 본문 헤더 하나뿐이다. 여기는 시각적 제목이라 div. */}
      <div style={{ margin: 0, fontSize: 22, fontWeight: 500, color: '#FFFFFF', lineHeight: 1.25, letterSpacing: -0.5, wordBreak: 'keep-all' }}>
        {site.name}
      </div>
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        {meta.length > 0 && (
          <div style={{ fontSize: 12, color: '#B4B2A9', fontWeight: 500, lineHeight: 1.5 }}>
            {meta.join(' · ')}
          </div>
        )}
        {typeof interestCount === 'number' && interestCount > 0 && (
          <div style={{ fontSize: 12, color: '#FFD688', fontWeight: 700, whiteSpace: 'nowrap' }}>
            ★ 관심 {interestCount.toLocaleString()}명
          </div>
        )}
      </div>
    </section>
  );
}
