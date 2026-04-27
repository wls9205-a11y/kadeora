import React from 'react';

const LIFECYCLE_LABEL: Record<string, string> = {
  site_planning: '부지계획',
  pre_announcement: '분양 예고',
  model_house_open: '모델하우스 오픈',
  special_supply: '특별공급',
  subscription_open: '청약 진행',
  contract: '계약',
  construction: '시공',
  pre_move_in: '입주 예정',
  move_in: '입주',
  resale: '실거래',
};

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
  const lifecycle = site.lifecycle_stage ? LIFECYCLE_LABEL[site.lifecycle_stage] || site.lifecycle_stage : null;
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
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: '#FFFFFF', lineHeight: 1.25, letterSpacing: -0.5, wordBreak: 'keep-all' }}>
        {site.name}
      </h1>
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
