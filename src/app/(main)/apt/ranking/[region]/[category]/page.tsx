import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CATEGORY: Record<string, { label: string; site_type: string }> = {
  subscription: { label: '분양', site_type: 'subscription' },
  trade: { label: '실거래·시세', site_type: 'trade' },
  redevelopment: { label: '재개발', site_type: 'redevelopment' },
  unsold: { label: '미분양', site_type: 'unsold' },
  landmark: { label: '랜드마크', site_type: 'landmark' },
};

interface Props {
  params: Promise<{ region: string; category: string }>;
}

async function fetchRanking(region: string, site_type: string) {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).from('v_apt_ranking_by_region')
    .select('region,sigungu,site_type,slug,name,popularity_score,review_score,review_count,lifecycle_stage,rank,total_in_region')
    .eq('region', region).eq('site_type', site_type)
    .lte('rank', 30).order('rank', { ascending: true });
  return ((data ?? []) as Array<Record<string, any>>);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: rawR, category: rawC } = await params;
  const region = decodeURIComponent(rawR);
  const category = decodeURIComponent(rawC);
  const cat = CATEGORY[category];
  if (!cat) return {};
  const url = `${SITE_URL}/apt/ranking/${encodeURIComponent(region)}/${encodeURIComponent(category)}`;
  const title = `${region} ${cat.label} 인기 단지 TOP 30 | 카더라`;
  const desc = `${region} ${cat.label} 단지 인기 순위 TOP 30. 관심등록·후기·페이지뷰 기준 가중평균 popularity_score로 정렬한 카더라 ranking.`;
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const, googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const } },
    openGraph: {
      title, description: desc, url, siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(`${region} ${cat.label} TOP 30`)}&category=apt`, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description: desc },
  };
}

export default async function RegionRankingHub({ params }: Props) {
  const { region: rawR, category: rawC } = await params;
  const region = decodeURIComponent(rawR);
  const category = decodeURIComponent(rawC);
  const cat = CATEGORY[category];
  if (!cat) notFound();

  const ranking = await fetchRanking(region, cat.site_type);
  if (ranking.length === 0) notFound();

  const url = `${SITE_URL}/apt/ranking/${encodeURIComponent(region)}/${encodeURIComponent(category)}`;

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${region} ${cat.label} 인기 단지 TOP ${ranking.length}`,
    url,
    numberOfItems: ranking.length,
    itemListElement: ranking.map((r) => ({
      '@type': 'ListItem',
      position: r.rank,
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
      { '@type': 'ListItem', position: 3, name: `${region} ${cat.label} 랭킹`, item: url },
    ],
  };

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, flexWrap: 'wrap' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span>›</span>
        <Link href="/apt" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>부동산</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{region} {cat.label} TOP 30</span>
      </nav>

      <header style={{ margin: '0 0 18px' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
          {region} {cat.label} 인기 단지 TOP {ranking.length}
        </h1>
        <div style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          관심등록·후기·페이지뷰 가중평균 popularity_score 기준. 매일 갱신.
        </div>
      </header>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ranking.map((r) => (
          <li key={r.slug}>
            <Link href={`/apt/${encodeURIComponent(r.slug)}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', transition: 'border-color var(--transition-fast)' }}>
                <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: r.rank <= 3 ? 'var(--brand)' : 'var(--bg-hover)', color: r.rank <= 3 ? 'var(--text-inverse)' : 'var(--text-secondary)', fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {r.rank}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {r.sigungu}{r.review_count > 0 ? ` · 후기 ${r.review_count}` : ''}{r.lifecycle_stage ? ` · ${r.lifecycle_stage}` : ''}
                  </div>
                </div>
                <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>★ {r.popularity_score}</div>
              </div>
            </Link>
          </li>
        ))}
      </ol>

      <section aria-label="다른 카테고리" style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{region} 다른 카테고리 랭킹</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(CATEGORY).filter(([k]) => k !== category).map(([k, c]) => (
            <Link
              key={k}
              href={`/apt/ranking/${encodeURIComponent(region)}/${encodeURIComponent(k)}`}
              style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--bg-hover)', textDecoration: 'none', border: '1px solid var(--border)' }}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
