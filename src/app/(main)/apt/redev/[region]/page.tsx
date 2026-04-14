import { Metadata } from 'next';
import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';
import { notFound } from 'next/navigation';
import { generateAptSlug } from '@/lib/apt-slug';

export const revalidate = 3600;

const VALID_REGIONS = ['서울', '경기', '부산', '인천', '대구', '광주', '대전', '울산', '세종', '경남', '경북', '충남', '충북', '전남', '전북', '강원', '제주'];

const STAGE_COLORS: Record<string, string> = {
  '추진위': '#94A3B8', '정비구역지정': '#6B7280', '조합설립': '#60A5FA',
  '사업시행인가': '#FBBF24', '관리처분': '#FB923C', '착공': '#34D399', '준공': '#3B82F6',
};
const STAGE_ORDER = ['추진위', '정비구역지정', '조합설립', '사업시행인가', '관리처분', '착공', '준공'];

type Props = { params: Promise<{ region: string }> };

export async function generateStaticParams() {
  return VALID_REGIONS.map(r => ({ region: r }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  const decodedRegion = decodeURIComponent(region);
  if (!VALID_REGIONS.includes(decodedRegion)) return {};
  const ogImg = `${SITE_URL}/api/og?title=${encodeURIComponent(`${decodedRegion} 재개발·재건축 현황`)}&category=apt&design=2`;
  return {
    title: `${decodedRegion} 재개발 재건축 현황 — 진행 단계·시공사·세대수 | 카더라`,
    description: `${decodedRegion} 지역 재개발·재건축 구역의 진행 단계, 시공사, 세대수, 용적률 정보. 정비구역지정부터 착공까지 단계별 현황과 투자 분석.`,
    keywords: [`${decodedRegion} 재개발`, `${decodedRegion} 재건축`, `${decodedRegion} 정비사업`, `${decodedRegion} 재개발 현황`, '재개발 투자', '정비구역'],
    alternates: { canonical: `${SITE_URL}/apt/redev/${encodeURIComponent(decodedRegion)}` },
    openGraph: {
      title: `${decodedRegion} 재개발·재건축 현황 | 카더라`,
      description: `${decodedRegion} 지역 정비사업 진행 현황을 한눈에`,
      url: `${SITE_URL}/apt/redev/${encodeURIComponent(decodedRegion)}`,
      type: 'website', siteName: '카더라', locale: 'ko_KR',
      images: [{ url: ogImg, width: 1200, height: 630, alt: `${decodedRegion} 재개발 현황` }],
    },
    twitter: { card: 'summary_large_image', title: `${decodedRegion} 재개발·재건축 | 카더라`, images: [ogImg] },
    other: { 'naver:site_name': '카더라', 'naver:author': '카더라 부동산팀' },
  };
}

export default async function RegionRedevPage({ params }: Props) {
  const { region } = await params;
  const decodedRegion = decodeURIComponent(region);
  if (!VALID_REGIONS.includes(decodedRegion)) notFound();

  const sb = await createSupabaseServer();
  const [projectsR, blogR] = await Promise.all([
    sb.from('redevelopment_projects').select('id, district_name, sigungu, project_type, sub_type, stage, total_households, constructor, floor_area_ratio, building_coverage, max_floor, ai_summary, blog_count, avg_trade_price, area_sqm').eq('is_active', true).eq('region', decodedRegion).neq('sub_type', '도시환경정비').order('stage'),
    sb.from('blog_posts').select('slug, title, view_count').eq('category', 'redev').eq('is_published', true).contains('tags', [decodedRegion]).order('view_count', { ascending: false }).limit(5),
  ]);

  const projects: any[] = projectsR.data || [];
  const blogs: any[] = blogR.data || [];
  const total = projects.length;

  // 데이터 없는 지역 → 404 대신 준비중 페이지 (sitemap 404 방지)
  if (total === 0) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
          <Link href="/apt/redev" style={{ color: 'var(--brand)', textDecoration: 'none' }}>전국 재개발·재건축</Link> → {decodedRegion}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 12px' }}>🏗️ {decodedRegion} 재개발·재건축 현황</h1>
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 24 }}>{decodedRegion} 지역의 재개발·재건축 데이터를 수집 중입니다. 곧 업데이트됩니다.</p>
        <Link href="/apt/redev" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 'var(--radius-xl)', background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>전국 현황 보기 →</Link>
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 32, paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>다른 지역 재개발·재건축 현황</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
            {VALID_REGIONS.filter(r => r !== decodedRegion).map(r => (
              <Link key={r} href={`/apt/redev/${encodeURIComponent(r)}`} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--bg-surface)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-secondary)' }}>{r}</Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 단계별 집계
  const stageMap = new Map<string, number>();
  projects.forEach((p: any) => { const s = p.stage || '정비구역지정'; stageMap.set(s, (stageMap.get(s) || 0) + 1); });
  const totalHouseholds = projects.reduce((s: number, p: any) => s + (p.total_households || 0), 0);

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'WebPage',
    name: `${decodedRegion} 재개발 재건축 현황`,
    description: `${decodedRegion} ${total}개 구역의 진행 단계, 시공사, 세대수 정보`,
    url: `${SITE_URL}/apt/redev/${encodeURIComponent(decodedRegion)}`,
    dateModified: new Date().toISOString(),
    publisher: { '@type': 'Organization', name: '카더라', url: SITE_URL },
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
      { '@type': 'ListItem', position: 3, name: '재개발·재건축', item: `${SITE_URL}/apt/redev` },
      { '@type': 'ListItem', position: 4, name: `${decodedRegion}`, item: `${SITE_URL}/apt/redev/${encodeURIComponent(decodedRegion)}` },
    ]},
  };

  const itemListLd = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: `${decodedRegion} 재개발·재건축 구역 목록`,
    numberOfItems: total,
    itemListElement: projects.slice(0, 20).map((p: any, i: number) => ({
      '@type': 'ListItem', position: i + 1,
      name: p.district_name || p.sigungu || '구역',
      description: `${p.project_type || '재개발'} · ${p.stage || '진행중'}${p.total_households ? ` · ${p.total_households}세대` : ''}${p.constructor ? ` · ${p.constructor}` : ''}`,
    })),
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />

      {/* 히어로 */}
      <div style={{ padding: '32px 0 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
          <Link href="/apt/redev" style={{ color: 'var(--brand)', textDecoration: 'none' }}>전국 재개발·재건축</Link> → {decodedRegion}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px' }}>
          🏗️ {decodedRegion} 재개발·재건축 현황
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
          <strong style={{ color: 'var(--brand)', fontSize: 18 }}>{total}</strong>개 구역
          {totalHouseholds > 0 && <> · <strong>{totalHouseholds.toLocaleString()}</strong>세대</>}
        </p>
      </div>

      {/* 단계별 파이프라인 */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 20 }}>
        {STAGE_ORDER.map(stage => {
          const count = stageMap.get(stage) || 0;
          if (count === 0 && stage !== '정비구역지정') return null;
          const shortLabel: Record<string, string> = { '추진위': '추진위', '정비구역지정': '구역지정', '조합설립': '조합', '사업시행인가': '시행', '관리처분': '관리', '착공': '착공', '준공': '준공' };
          return (
            <div key={stage} style={{ flex: Math.max(count, 1), textAlign: 'center', padding: '8px 2px', borderRadius: 'var(--radius-sm)', background: `${STAGE_COLORS[stage]}15`, border: `1px solid ${STAGE_COLORS[stage]}30`, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: STAGE_COLORS[stage] }}>{count}</div>
              <div style={{ fontSize: 9, color: STAGE_COLORS[stage], fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortLabel[stage] || stage}</div>
            </div>
          );
        })}
      </div>

      {/* 구역 목록 */}
      <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>📋 {decodedRegion} 구역 목록</h2>
      <div style={{ display: 'grid', gap: 6, marginBottom: 24 }}>
        {projects.map((p: any) => {
          const sc = STAGE_COLORS[p.stage || '정비구역지정'] || STAGE_COLORS['정비구역지정'];
          const stageIdx = STAGE_ORDER.indexOf(p.stage || '');
          const progress = stageIdx >= 0 ? Math.round(((stageIdx + 1) / STAGE_ORDER.length) * 100) : 0;
          const slug = generateAptSlug(p.district_name || `redev-${p.id}`);
          return (
            <Link key={p.id} href={`/apt/${encodeURIComponent(slug)}`} style={{
              display: 'block', padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              textDecoration: 'none', color: 'inherit',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: p.project_type === '재건축' ? 'rgba(245,158,11,0.9)' : 'rgba(139,92,246,0.9)', color: '#fff' }}>{p.project_type || '재개발'}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: sc }}>{p.stage}</span>
                <div style={{ flex: 1, height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: sc, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: sc }}>{progress}%</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 3 }}>
                {p.district_name || p.sigungu || '구역'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                {p.sigungu && <span>{p.sigungu}</span>}
                {p.total_households && <span>🏢 {p.total_households.toLocaleString()}세대</span>}
                {p.constructor && <span style={{ color: 'var(--accent-green)' }}>🏗️ {p.constructor}</span>}
                {p.area_sqm && <span>📐 {p.area_sqm >= 10000 ? `${(p.area_sqm / 10000).toFixed(1)}만m²` : `${(p.area_sqm / 1000).toFixed(0)}천m²`}</span>}
                {p.avg_trade_price && <span>💰 평균 {(p.avg_trade_price / 10000).toFixed(1)}억</span>}
              </div>
              {p.ai_summary && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4, borderLeft: `2px solid ${sc}`, paddingLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🤖 {p.ai_summary}</div>}
            </Link>
          );
        })}
      </div>

      {/* 관련 블로그 */}
      {blogs.length > 0 && (<>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>📝 {decodedRegion} 관련 분석</h2>
        <div style={{ marginBottom: 24 }}>
          {blogs.map((b: any, i: number) => (
            <Link key={b.slug} href={`/blog/${b.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', marginBottom: 3, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 16 }}>#{i + 1}</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{b.view_count?.toLocaleString()}뷰</span>
            </Link>
          ))}
        </div>
      </>)}

      {/* 다른 지역 CTA */}
      <div style={{ textAlign: 'center', padding: '16px 0 32px' }}>
        <Link href="/apt/redev" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 'var(--radius-xl)', background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          ← 전국 재개발 현황 보기
        </Link>
      </div>

      {/* 다른 지역 링크 (SEO 내부링크) */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '16px 0 24px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>다른 지역 재개발·재건축 현황</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {VALID_REGIONS.filter(r => r !== decodedRegion).map(r => (
            <Link key={r} href={`/apt/redev/${encodeURIComponent(r)}`} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--bg-surface)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-secondary)' }}>{r}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
