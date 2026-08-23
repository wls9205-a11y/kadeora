// V13 A-1 — /apt/pipeline 공고 전 현장 전체 보기.
//
// /apt 섹션은 8건만 낸다. 그 아래 '전체 보기 →' 가 여기로 온다.
// 지역 전환(전국 · 부울경 · 17개 시·도)은 이 페이지가 받는다.
//
// V14: RPC 에 p_page 가 붙어 전 건수를 페이지로 넘긴다 (전국 206건 · 7페이지).
// 정렬·페이지 조합은 같은 목록의 순열이라 2페이지부터는 색인 대상이 아니다.

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';
import {
  getAptPipeline,
  normalizePipelineRegion,
  BUGYEONG,
  PIPELINE_PAGE_SIZE,
} from '@/lib/apt/pipeline';
import PipelineCard from '@/components/apt/PipelineCard';
// V17 F-1: /apt 섹션과 **같은 게이트**를 쓴다. 두 화면이 다른 기준이면
//   같은 현장이 한쪽에만 나온다.
import { filterByComposition } from '@/lib/apt/pipeline-gate';
import SectionHeader from '@/components/apt/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import { KR_REGIONS_17 } from '@/lib/region-storage';

export const revalidate = 900;
export const maxDuration = 15;

type SP = { region?: string; page?: string };

const DESCRIBE =
  '모집공고가 아직 없는 현장입니다. 조합설립·시공사 선정·사업시행인가·착공 단계를 ' +
  '진행 순서대로 정리했습니다. 분양가와 일정은 공고가 나와야 확정됩니다.';

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const region = normalizePipelineRegion(sp.region);
  const pageNum = Math.max(1, Number(sp.page) || 1);
  const title = pageNum > 1
    ? `${region} 공고 전 아파트 현장 (${pageNum}페이지)`
    : `${region} 공고 전 아파트 현장 — 조합설립·시공사 선정·착공 단계`;
  const qs = `?region=${encodeURIComponent(region)}`;

  return {
    title,
    description: DESCRIBE,
    // canonical 은 항상 1페이지다 — 2페이지부터는 같은 목록의 순열이다.
    alternates: { canonical: `${SITE_URL}/apt/pipeline${qs}` },
    ...(pageNum > 1 ? { robots: { index: false, follow: true } } : {}),
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
  const pageNum = Math.max(1, Number(sp.page) || 1);
  const raw = await getAptPipeline(region, PIPELINE_PAGE_SIZE, pageNum);
  // V17 F-1 · 조건 미달 현장을 뺀다.
  //   ⚠️ 게이트가 RPC 안이 아니라 여기 있어서 **페이지마다 건수가 들쭉날쭉하다.**
  //      total/total_pages 는 게이트 이전 값이라 페이지 이동에는 그대로 쓰고,
  //      "N곳" 총계로는 쓰지 않는다. RPC 에 조건이 들어가면 이 주석과 함께 정리한다.
  const items = await filterByComposition(raw.items);
  const data = { ...raw, items };
  const now = Date.now();

  /** 지역을 바꾸면 1페이지로 돌아간다 — 7페이지에서 부산을 고르면 빈 화면이 나온다. */
  const href = (r: string, page = 1) =>
    `/apt/pipeline?region=${encodeURIComponent(r)}${page > 1 ? `&page=${page}` : ''}`;
  // 게이트 이후 건수만 말한다. 게이트 이전 total 을 내면 목록보다 큰 숫자가 나온다.
  const meta =
    data.items.length > 0
      ? `${data.items.length}곳${data.total_pages > 1 ? ` · ${data.page}/${data.total_pages}쪽` : ''}`
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
            {DESCRIBE} 진행 이력·시공사·세대수·위치 중 2개 이상이 확인된 현장만 싣습니다.
          </p>

          {/* 게이트 때문에 이 페이지가 통째로 빌 수 있다. 다음 쪽에는 있을 수 있으므로
              "없습니다" 대신 페이지 이동을 남겨 둔다 (아래 nav 는 그대로 렌더된다). */}
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
            </div>
          ) : (
            <EmptyState
              icon="🏗️"
              title={
                data.total_pages > 1
                  ? `${data.page}쪽에는 보여줄 현장이 없습니다`
                  : `${region}에 공고 전 현장이 없습니다`
              }
              description={
                data.total_pages > 1
                  ? '진행 이력·시공사·세대수·위치 중 2개 이상이 확인된 현장만 싣습니다. 다음 쪽을 보세요.'
                  : '지역을 바꿔보세요. 단계가 바뀌는 즉시 이 목록에 올라옵니다.'
              }
              cta={{ label: `${BUGYEONG} 공고 전 현장 보기`, href: href(BUGYEONG) }}
            />
          )}
        </section>

        {data.total_pages > 1 && (
          <nav aria-label="페이지" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, margin: '18px 0 8px' }}>
            {data.page > 1 ? (
              <Link href={href(region, data.page - 1)} style={{ ...CHIP, background: 'var(--bg-surface)', color: 'var(--text-secondary)', minHeight: 40, padding: '0 16px' }}>
                ← 이전
              </Link>
            ) : null}
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
              {data.page} / {data.total_pages}
            </span>
            {data.page < data.total_pages ? (
              <Link href={href(region, data.page + 1)} style={{ ...CHIP, background: 'var(--brand)', borderColor: 'var(--brand)', color: '#FFFFFF', fontWeight: 700, minHeight: 40, padding: '0 16px' }}>
                다음 →
              </Link>
            ) : null}
          </nav>
        )}
      </div>
    </div>
  );
}
