// v5-V3 — /apt/archive 지난 공고.
//
// /apt 허브는 최근(60/180/365 사다리)만 보여준다. 그 이전 공고는 여기가 전부 받는다.
// 실측: 부산 191건 · 전국 2,842건. 최악(전국·경쟁률순·140페이지) 42ms.
//
// 행은 /apt 와 같은 SubscriptionCard(.kd-lrow) 를 그대로 쓴다 — RPC 가 items 규격을
// 허브와 맞춰 내려주기 때문이다. 목록 두 벌을 만들지 않는다.

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';
import {
  getAptArchive,
  normalizeSort,
  ARCHIVE_SORTS,
  type AptArchiveItem,
} from '@/lib/apt/archive';
import type { AptHubItem } from '@/lib/apt/hub';
import SubscriptionCard from '@/components/apt/SubscriptionCard';
import SectionHeader from '@/components/apt/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import { KR_REGIONS_17 } from '@/lib/region-storage';

export const revalidate = 900;
export const maxDuration = 15;

type SP = { region?: string; year?: string; sort?: string; page?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const region = sp.region?.trim() || '전국';
  const year = sp.year?.trim();
  const scope = [region, year ? `${year}년` : ''].filter(Boolean).join(' ');
  const title = `${scope} 지난 아파트 청약 공고 — 경쟁률·가점컷 아카이브`;
  const description =
    `${scope} 마감된 아파트 청약 공고를 연도별로 모았습니다. ` +
    '1순위 경쟁률, 접수 건수, 세대수, 시공사를 한 화면에서 비교하세요.';

  const qs = [
    region !== '전국' ? `region=${encodeURIComponent(region)}` : '',
    year ? `year=${year}` : '',
  ].filter(Boolean).join('&');

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/apt/archive${qs ? `?${qs}` : ''}` },
    // 정렬·페이지 조합은 같은 목록의 순열이라 색인 대상이 아니다.
    ...(sp.sort || (sp.page && sp.page !== '1') ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'website',
      url: `${SITE_URL}/apt/archive${qs ? `?${qs}` : ''}`,
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&category=apt&design=2`, width: 1200, height: 630, alt: title }],
    },
  };
}

/**
 * 아카이브 항목 → 행 컴포넌트가 기대하는 모양.
 * 마감 공고에 의미가 없어 RPC 가 안 주는 필드만 null 로 채운다 (값을 지어내지 않는다).
 */
function toRow(it: AptArchiveItem): AptHubItem {
  return {
    ...it,
    spsply_rcept_bgnde: null,
    cntrct_cncls_bgnde: null,
    cntrct_cncls_endde: null,
    min_score: null,
    dday: null,
    weight: 0,
  } as unknown as AptHubItem;
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
    ? { ...CHIP, background: 'var(--brand)', borderColor: 'var(--brand)', color: '#FFFFFF', fontWeight: 500 }
    : { ...CHIP, background: 'var(--bg-surface)', color: 'var(--text-secondary)' };

const ROW: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  padding: '0 6px 8px',
};

export default async function AptArchivePage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) || {};
  const region = sp.region?.trim() || '전국';
  const yearNum = Number(sp.year);
  const year = Number.isInteger(yearNum) && yearNum > 1990 ? yearNum : null;
  const sort = normalizeSort(sp.sort);
  const pageNum = Math.max(1, Number(sp.page) || 1);

  const data = await getAptArchive(region, year, sort, pageNum);

  /** 현재 선택을 유지한 링크. 바꾸는 축만 넘긴다. */
  const href = (patch: Partial<{ region: string; year: number | null; sort: string; page: number }>) => {
    const nextRegion = patch.region ?? region;
    const nextYear = patch.year !== undefined ? patch.year : year;
    const nextSort = patch.sort ?? sort;
    // 축을 바꾸면 1페이지로 돌아간다 — 140페이지에서 지역을 바꾸면 빈 화면이 나온다.
    const axisChanged = patch.region !== undefined || patch.year !== undefined || patch.sort !== undefined;
    const nextPage = patch.page ?? (axisChanged ? 1 : pageNum);
    const qs = [
      nextRegion !== '전국' ? `region=${encodeURIComponent(nextRegion)}` : '',
      nextYear ? `year=${nextYear}` : '',
      nextSort !== 'recent' ? `sort=${nextSort}` : '',
      nextPage > 1 ? `page=${nextPage}` : '',
    ].filter(Boolean).join('&');
    return qs ? `/apt/archive?${qs}` : '/apt/archive';
  };

  const scope = [region, year ? `${year}년` : ''].filter(Boolean).join(' ');

  return (
    <div className="kd-list">
      <div className="kd-list-main">
        <h1 className="sr-only">{scope} 지난 아파트 청약 공고</h1>

        <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', padding: '0 6px', marginBottom: 10 }}>
          <Link href="/apt" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>부동산</Link>
          <span aria-hidden>›</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>지난 공고</span>
        </nav>

        <div role="group" aria-label="지역 선택" style={ROW}>
          <Link href={href({ region: '전국' })} style={chipStyle(region === '전국')}>전국</Link>
          {KR_REGIONS_17.map((r) => (
            <Link key={r} href={href({ region: r })} style={chipStyle(region === r)}>{r}</Link>
          ))}
        </div>

        {data.years.length > 0 && (
          <div role="group" aria-label="연도 선택" style={ROW}>
            <Link href={href({ year: null })} style={chipStyle(!year)}>
              전체
              <span style={{ fontSize: 10, opacity: year ? 0.6 : 0.8 }}>{data.total}</span>
            </Link>
            {data.years.map((y) => (
              <Link key={y.year} href={href({ year: y.year })} style={chipStyle(year === y.year)}>
                {y.year}
                <span style={{ fontSize: 10, opacity: year === y.year ? 0.8 : 0.6 }}>{y.cnt}</span>
              </Link>
            ))}
          </div>
        )}

        <div role="group" aria-label="정렬" style={ROW}>
          {ARCHIVE_SORTS.map((s) => (
            <Link key={s.key} href={href({ sort: s.key })} style={chipStyle(sort === s.key)}>{s.label}</Link>
          ))}
        </div>

        <section aria-labelledby="archive-heading" style={{ padding: '0 6px' }}>
          <SectionHeader
            id="archive-heading"
            eyebrow="ARCHIVE — 지난 공고"
            title="지난 청약"
            meta={data.total > 0 ? `${scope} ${data.total.toLocaleString('ko-KR')}건` : undefined}
          />

          {data.items.length > 0 ? (
            <div>
              <div className="kd-lhead" aria-hidden="true">
                <span />
                <span>단지</span>
                <span>{sort === 'competition' ? '경쟁률' : '규모'}</span>
              </div>
              {data.items.map((it) => (
                <SubscriptionCard key={it.id} item={toRow(it)} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="🗂️"
              title={`${scope}에 지난 공고가 없습니다`}
              description="지역이나 연도를 바꿔보세요."
              cta={{ label: '전국 지난 공고 보기', href: '/apt/archive' }}
            />
          )}
        </section>

        {data.total_pages > 1 && (
          <nav aria-label="페이지" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, margin: '18px 0 8px' }}>
            {pageNum > 1 ? (
              <Link href={href({ page: pageNum - 1 })} style={{ ...CHIP, background: 'var(--bg-surface)', color: 'var(--text-secondary)', minHeight: 40, padding: '0 16px' }}>
                ← 이전
              </Link>
            ) : null}
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
              {pageNum} / {data.total_pages}
            </span>
            {pageNum < data.total_pages ? (
              <Link href={href({ page: pageNum + 1 })} style={{ ...CHIP, background: 'var(--brand)', borderColor: 'var(--brand)', color: '#FFFFFF', fontWeight: 500, minHeight: 40, padding: '0 16px' }}>
                다음 →
              </Link>
            ) : null}
          </nav>
        )}
      </div>

      <aside className="kd-list-rail" aria-label="지난 공고 안내">
        {data.years.length > 0 && (
          <div className="kd-rail-panel">
            <h2>연도별</h2>
            {data.years.map((y) => (
              <Link key={y.year} href={href({ year: y.year })}>{y.year}년 · {y.cnt}건</Link>
            ))}
          </div>
        )}
        <div className="kd-rail-panel">
          <h2>바로가기</h2>
          <Link href="/apt">진행중 청약</Link>
          <Link href="/apt/ranking">청약 경쟁률 랭킹</Link>
          <Link href="/apt/unsold">미분양 현황</Link>
          <Link href="/apt/complex">단지 백과</Link>
        </div>
      </aside>
    </div>
  );
}
