// V13 A-1 — /apt/pipeline 공고 전 현장 전체 보기.
//
// /apt 섹션은 8건만 낸다. 그 아래 '전체 보기 →' 가 여기로 온다.
// 지역 전환(전국 · 부울경 · 17개 시·도)은 이 페이지가 받는다.
//
// ⚠️ get_apt_pipeline 은 p_limit 을 60 으로 클램프한다. 전국 총계는 209건이라
//    이 페이지도 60건까지만 낼 수 있다. 총계를 감추지 않고 "209곳 중 60곳" 으로 밝힌다 —
//    페이지네이션은 RPC 에 오프셋이 붙은 다음의 일이다 (DB 담당).

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';
import {
  getAptPipeline,
  normalizePipelineRegion,
  BUGYEONG,
  PIPELINE_MAX_LIMIT,
} from '@/lib/apt/pipeline';
import PipelineCard from '@/components/apt/PipelineCard';
import SectionHeader from '@/components/apt/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import { KR_REGIONS_17 } from '@/lib/region-storage';

export const revalidate = 900;
export const maxDuration = 15;

type SP = { region?: string };

const DESCRIBE =
  '모집공고가 아직 없는 현장입니다. 조합설립·시공사 선정·사업시행인가·착공 단계를 ' +
  '진행 순서대로 정리했습니다. 분양가와 일정은 공고가 나와야 확정됩니다.';

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const region = normalizePipelineRegion(sp.region);
  const title = `${region} 공고 전 아파트 현장 — 조합설립·시공사 선정·착공 단계`;
  const qs = `?region=${encodeURIComponent(region)}`;

  return {
    title,
    description: DESCRIBE,
    alternates: { canonical: `${SITE_URL}/apt/pipeline${qs}` },
    openGraph: {
      title,
      description: DESCRIBE,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'website',
      url: `${SITE_URL}/apt/pipeline${qs}`,
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&category=apt&design=2`, width: 1200, height: 630, alt: title }],
    },
  };
}

const CHIP: React.CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  minHeight: 32,
  padding: '0 11px',
  borderRadius: 'var(--radius-pill)',
  fontSize: 11.5,
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};
const chipStyle = (active: boolean): React.CSSProperties =>
  active
    ? { ...CHIP, background: 'var(--brand)', borderColor: 'var(--brand)', color: '#FFFFFF', fontWeight: 700 }
    : { ...CHIP, background: 'var(--bg-surface)', color: 'var(--text-secondary)' };

const ROW: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  padding: '0 6px 8px',
};

export default async function AptPipelinePage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) || {};
  const region = normalizePipelineRegion(sp.region);
  const data = await getAptPipeline(region, PIPELINE_MAX_LIMIT);
  const now = Date.now();

  const href = (r: string) => `/apt/pipeline?region=${encodeURIComponent(r)}`;
  // 잘려 나간 건수를 감추지 않는다.
  const meta =
    data.total > data.items.length
      ? `${data.total.toLocaleString('ko-KR')}곳 중 ${data.items.length}곳`
      : data.total > 0
        ? `${data.total.toLocaleString('ko-KR')}곳`
        : undefined;

  return (
    <div className="kd-list">
      <div className="kd-list-main">
        <h1 className="sr-only">{region} 공고 전 아파트 현장</h1>

        <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', padding: '0 6px', marginBottom: 10 }}>
          <Link href="/apt" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>부동산</Link>
          <span aria-hidden>›</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>공고 전 현장</span>
        </nav>

        <div role="group" aria-label="지역 선택" style={ROW}>
          <Link href={href(BUGYEONG)} style={chipStyle(region === BUGYEONG)}>{BUGYEONG}</Link>
          <Link href={href('전국')} style={chipStyle(region === '전국')}>전국</Link>
          {KR_REGIONS_17.map((r) => (
            <Link key={r} href={href(r)} style={chipStyle(region === r)}>{r}</Link>
          ))}
        </div>

        <section aria-labelledby="pipeline-heading" style={{ padding: '0 6px' }}>
          <SectionHeader
            id="pipeline-heading"
            eyebrow="PIPELINE — 공고 전"
            title="공고 전 현장"
            meta={meta}
          />

          <p style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
            {DESCRIBE}
          </p>

          {data.items.length > 0 ? (
            <div>
              <div className="kd-lhead" aria-hidden="true">
                <span />
                <span>현장</span>
                <span>규모</span>
              </div>
              {data.items.map((it) => (
                <PipelineCard key={it.id} item={it} now={now} />
              ))}
              {data.total > data.items.length && (
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '10px 2px 0' }}>
                  진행 단계가 앞선 순서로 {data.items.length}곳을 먼저 보여줍니다. 지역을 좁히면 더 많이 볼 수 있습니다.
                </p>
              )}
            </div>
          ) : (
            <EmptyState
              icon="🏗️"
              title={`${region}에 공고 전 현장이 없습니다`}
              description="지역을 바꿔보세요. 단계가 바뀌는 즉시 이 목록에 올라옵니다."
              cta={{ label: `${BUGYEONG} 공고 전 현장 보기`, href: href(BUGYEONG) }}
            />
          )}
        </section>
      </div>
    </div>
  );
}
