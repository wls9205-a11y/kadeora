// r4-P5-1 — lifecycle 축 허브. /apt/stage/[stage]/[region]
//
// 기존 /apt/region/[region]/[sigungu]/[category] 는 동결이다. 여기에 신규 값을 넣지 않는다.
//
// P5-2: isIndexable 을 네 곳에서 같은 값으로 쓴다 —
//   generateStaticParams · 사이트맵(sitemap/[id] id=0) · metadata · 페이지 본문.
// 본문 런타임 가드가 핵심이다. dynamicParams=true 라 정적 생성에서 빠져도 요청이 오면 렌더된다.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/lib/constants';
import { isIndexable, INDEX_MIN } from '@/lib/apt/indexable';
import {
  STAGES,
  STAGE_KEYS,
  STAGE_REGIONS,
  isStageKey,
  isStageRegion,
  fetchStageRows,
  fetchIndexableStagePairs,
  type StageKey,
} from '@/lib/apt/stage';
import HubHero from '@/components/detail/HubHero';
import SiteCard from '@/components/cards/v3/SiteCard';

export const revalidate = 3600;
export const dynamicParams = true;
export const maxDuration = 30;

interface Props {
  params: Promise<{ stage: string; region: string }>;
}

export async function generateStaticParams() {
  const pairs = await fetchIndexableStagePairs();
  return pairs.slice(0, 100).map((p) => ({ stage: p.stage, region: p.region }));
}

function parse(rawStage: string, rawRegion: string): { stage: StageKey; region: string } | null {
  const stage = decodeURIComponent(rawStage);
  const region = decodeURIComponent(rawRegion);
  if (!isStageKey(stage) || !isStageRegion(region)) return null;
  return { stage, region };
}

const urlOf = (stage: string, region: string) =>
  `${SITE_URL}/apt/stage/${stage}/${encodeURIComponent(region)}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { stage: rawS, region: rawR } = await params;
  const parsed = parse(rawS, rawR);
  if (!parsed) return { robots: { index: false, follow: false } };
  const { stage, region } = parsed;
  const def = STAGES[stage];

  const rows = await fetchStageRows(stage, region);
  // 얇은 조합은 메타에서도 색인 대상이 아니다 — 본문 가드와 같은 기준을 쓴다.
  if (!isIndexable(rows.length)) return { robots: { index: false, follow: false } };

  const url = urlOf(stage, region);
  // (main)/layout 의 `%s | 카더라` 템플릿이 붙는다 — 여기서 브랜드를 또 넣지 않는다.
  const title = `${region} ${def.label} 아파트 ${rows.length.toLocaleString()}곳`;
  const description = def.describe(region, rows.length);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large' as const,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'website',
      images: [
        {
          url: `${SITE_URL}/api/og?title=${encodeURIComponent(`${region} ${def.label}`)}&category=apt`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function AptStageRegionHub({ params }: Props) {
  const { stage: rawS, region: rawR } = await params;
  const parsed = parse(rawS, rawR);
  if (!parsed) notFound();
  const { stage, region } = parsed;
  const def = STAGES[stage];

  const rows = await fetchStageRows(stage, region);
  // 런타임 가드 — 이게 없으면 1~4건 조합이 그대로 나간다(S7-1 재발).
  if (!isIndexable(rows.length)) notFound();

  const url = urlOf(stage, region);

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${region} ${def.label} 아파트`,
    url,
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 30).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/apt/${encodeURIComponent(r.slug)}`,
      name: r.name,
    })),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
      { '@type': 'ListItem', position: 3, name: def.label, item: `${SITE_URL}/apt/stage/${stage}/서울` },
      { '@type': 'ListItem', position: 4, name: region, item: url },
    ],
  };

  return (
    <main style={{ maxWidth: 'var(--container-grid)', margin: '0 auto', padding: 'var(--sp-md)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <nav
        aria-label="breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-tertiary)',
          marginBottom: 'var(--sp-sm)',
          flexWrap: 'wrap',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span aria-hidden="true">›</span>
        <Link href="/apt" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>부동산</Link>
        <span aria-hidden="true">›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{region} {def.label}</span>
      </nav>

      <HubHero
        eyebrow={def.eyebrow}
        title={`${region} ${def.label} 아파트`}
        titleId="stage-title"
        description={def.describe(region, rows.length)}
        stats={[{ label: '단지', value: rows.length.toLocaleString() }]}
        action={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STAGE_KEYS.filter((k) => k !== stage).map((k) => (
              <Link
                key={k}
                href={`/apt/stage/${k}/${encodeURIComponent(region)}`}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-hover)',
                  textDecoration: 'none',
                  border: '1px solid var(--border)',
                }}
              >
                {STAGES[k].label}
              </Link>
            ))}
          </div>
        }
      />

      <section aria-labelledby="stage-list" style={{ marginTop: 'var(--sp-lg)' }}>
        <h2 id="stage-list" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {region} {def.label} 단지 목록
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 'var(--sp-md)',
          }}
        >
          {rows.map((r) => (
            <SiteCard
              key={r.slug}
              href={`/apt/${encodeURIComponent(r.slug)}`}
              image={null}
              badges={[{ label: def.label, tone: 'status' }]}
              title={r.name}
              summary={r.summary || `${r.region} ${def.label} 단지`}
              caption={r.caption || undefined}
            />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="stage-regions"
        style={{
          marginTop: 'var(--sp-2xl)',
          padding: 'var(--sp-md)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        <h2
          id="stage-regions"
          style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--sp-sm)' }}
        >
          다른 지역 {def.label}
        </h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STAGE_REGIONS.filter((r) => r !== region).map((r) => (
            <Link
              key={r}
              href={`/apt/stage/${stage}/${encodeURIComponent(r)}`}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                background: 'var(--bg-hover)',
                textDecoration: 'none',
                border: '1px solid var(--border)',
              }}
            >
              {r}
            </Link>
          ))}
        </div>
        <p style={{ margin: 'var(--sp-sm) 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
          단지 {INDEX_MIN}곳 미만인 지역은 페이지를 만들지 않습니다.
        </p>
      </section>
    </main>
  );
}
