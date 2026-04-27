import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Phase 5 B3: ISR 전환 — top 100 정적 + 나머지 ondemand ISR (1h revalidate)
export const revalidate = 3600;
export const dynamicParams = true;
export const maxDuration = 30;

export async function generateStaticParams() {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any).from('v_region_hub_clusters')
      .select('region,sigungu,site_type,cluster_size')
      .order('cluster_size', { ascending: false, nullsFirst: false })
      .limit(100);
    const rows = ((data ?? []) as Array<{ region: string; sigungu: string; site_type: string }>);
    return rows
      .filter(r => r.region && r.sigungu && r.site_type)
      .map(r => ({
        region: encodeURIComponent(r.region),
        sigungu: encodeURIComponent(r.sigungu),
        category: r.site_type,
      }));
  } catch (err) {
    console.error('[region-hub generateStaticParams]', err);
    return [];
  }
}

const CATEGORY: Record<string, { label: string; site_type: string }> = {
  subscription: { label: '분양', site_type: 'subscription' },
  trade: { label: '실거래·시세', site_type: 'trade' },
  redevelopment: { label: '재개발', site_type: 'redevelopment' },
  unsold: { label: '미분양', site_type: 'unsold' },
  landmark: { label: '랜드마크', site_type: 'landmark' },
};

interface Props {
  params: Promise<{ region: string; sigungu: string; category: string }>;
}

async function fetchClusterAndSites(region: string, sigungu: string, site_type: string) {
  const sb = getSupabaseAdmin();
  const [clusterRes, sitesRes] = await Promise.all([
    (sb as any).from('v_region_hub_clusters')
      .select('region,sigungu,site_type,cluster_size,upcoming_count,active_trade_count,slugs,names,avg_review_score,total_review_count,last_updated')
      .eq('region', region).eq('sigungu', sigungu).eq('site_type', site_type)
      .maybeSingle(),
    (sb as any).from('apt_sites')
      .select('id,slug,name,site_type,region,sigungu,dong,total_units,price_min,price_max,builder,popularity_score,review_score,review_count,lifecycle_stage,move_in_date,og_cards')
      .eq('region', region).eq('sigungu', sigungu).eq('site_type', site_type).eq('is_active', true)
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .limit(60),
  ]);
  return {
    cluster: (clusterRes as any)?.data ?? null,
    sites: ((sitesRes as any)?.data ?? []) as Array<Record<string, any>>,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: rawR, sigungu: rawS, category: rawC } = await params;
  const region = decodeURIComponent(rawR);
  const sigungu = decodeURIComponent(rawS);
  const category = decodeURIComponent(rawC);
  const cat = CATEGORY[category];
  if (!cat) return {};
  const url = `${SITE_URL}/apt/region/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}/${encodeURIComponent(category)}`;
  const title = `${region} ${sigungu} ${cat.label} 단지 가이드 | 카더라`;
  const desc = `${region} ${sigungu} ${cat.label} 단지 시세·평형·세대수·시공사 한눈에. 카더라가 정리한 ${region} ${sigungu} ${cat.label} 단지 종합 가이드.`;
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const, googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const } },
    openGraph: {
      title,
      description: desc,
      url,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'website',
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(`${region} ${sigungu} ${cat.label}`)}&category=apt`, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description: desc },
  };
}

export default async function RegionSigunguCategoryHub({ params }: Props) {
  const { region: rawR, sigungu: rawS, category: rawC } = await params;
  const region = decodeURIComponent(rawR);
  const sigungu = decodeURIComponent(rawS);
  const category = decodeURIComponent(rawC);
  const cat = CATEGORY[category];
  if (!cat) notFound();

  const { cluster, sites } = await fetchClusterAndSites(region, sigungu, cat.site_type);
  if (!cluster && sites.length === 0) notFound();

  const url = `${SITE_URL}/apt/region/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}/${encodeURIComponent(category)}`;
  const fmtAmount = (n?: number | null) => !n ? '-' : n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`;

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${region} ${sigungu} ${cat.label} 단지`,
    url,
    numberOfItems: sites.length,
    itemListElement: sites.slice(0, 30).map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/apt/${encodeURIComponent(s.slug)}`,
      name: s.name,
    })),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
      { '@type': 'ListItem', position: 3, name: region, item: `${SITE_URL}/apt/region/${encodeURIComponent(region)}` },
      { '@type': 'ListItem', position: 4, name: sigungu, item: `${SITE_URL}/apt/region/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}` },
      { '@type': 'ListItem', position: 5, name: cat.label, item: url },
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
        <Link href={`/apt/region/${encodeURIComponent(region)}`} style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>{region}</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sigungu} {cat.label}</span>
      </nav>

      <header style={{ margin: '0 0 18px' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
          {region} {sigungu} {cat.label} 단지 가이드
        </h1>
        <div style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {region} {sigungu} 지역의 {cat.label} 단지 {sites.length.toLocaleString()}곳을 정리했습니다.
          {cluster?.upcoming_count > 0 && ` 분양 예정 ${cluster.upcoming_count}곳, `}
          {cluster?.active_trade_count > 0 && ` 활성 거래 ${cluster.active_trade_count}곳, `}
          {cluster?.total_review_count > 0 && ` 후기 ${cluster.total_review_count}건, `}
          평균 평점 {Number(cluster?.avg_review_score ?? 0).toFixed(1)}점.
        </div>
      </header>

      <section aria-label="단지 목록" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {sites.map((s) => (
          <Link key={s.slug} href={`/apt/${encodeURIComponent(s.slug)}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 14, transition: 'border-color var(--transition-fast)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>{s.name}</h3>
                {s.popularity_score > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand)', flexShrink: 0 }}>★ {s.popularity_score}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                {s.dong || sigungu} {s.builder ? `· ${s.builder}` : ''}
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                {s.total_units && <span>{s.total_units.toLocaleString()}세대</span>}
                {(s.price_min || s.price_max) && <span>{fmtAmount(s.price_min)}{s.price_min && s.price_max ? `~${fmtAmount(s.price_max)}` : ''}</span>}
                {s.move_in_date && <span>입주 {s.move_in_date}</span>}
                {s.review_count > 0 && <span>후기 {s.review_count}</span>}
              </div>
            </div>
          </Link>
        ))}
      </section>

      {sites.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          이 지역 {cat.label} 단지 정보를 곧 업데이트할 예정입니다.
        </div>
      )}

      <section aria-label="다른 카테고리" style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{region} {sigungu} 다른 카테고리</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(CATEGORY).filter(([k]) => k !== category).map(([k, c]) => (
            <Link
              key={k}
              href={`/apt/region/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}/${encodeURIComponent(k)}`}
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
