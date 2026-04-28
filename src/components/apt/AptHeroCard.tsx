// 서버 컴포넌트 — fetchHeroSite 결과 1개를 HeroCard 로 렌더.
// /apt 페이지 region 컨텍스트에서 popularity_score 1위 단지 강조.

import HeroCard, { type HeroStat } from '@/components/ui/HeroCard';
import type { AptSiteRow } from '@/lib/apt-fetcher';

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

export default function AptHeroCard({ site, region, sigungu }: Props) {
  const meta = [
    site.lifecycle_stage ? LIFECYCLE_LABEL[site.lifecycle_stage] || site.lifecycle_stage : null,
    [site.region, site.sigungu, site.dong].filter(Boolean).join(' '),
    site.builder,
    site.total_units ? `${Number(site.total_units).toLocaleString()}세대` : null,
  ].filter(Boolean).join(' · ');

  const stats: HeroStat[] = [];
  if (site.lifecycle_stage) {
    stats.push({ value: LIFECYCLE_LABEL[site.lifecycle_stage] || site.lifecycle_stage, label: '단계' });
  }
  if (site.total_units) {
    stats.push({ value: Number(site.total_units).toLocaleString(), label: '세대수' });
  }
  // popularity_score === 100 은 "기본값" 이라 표시 X
  if (site.popularity_score && site.popularity_score !== 100) {
    stats.push({ value: `★ ${site.popularity_score}`, label: '인기', tone: 'success' });
  }

  return (
    <div style={{ maxWidth: 720, margin: '8px auto 12px', padding: '0 var(--sp-lg)' }}>
      <HeroCard
        tag={`${sigungu ?? region} · 추천 단지`}
        title={site.name}
        meta={meta}
        stats={stats}
        href={`/apt/${encodeURIComponent(site.slug)}`}
      />
    </div>
  );
}
