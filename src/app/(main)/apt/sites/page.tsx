import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import type { Metadata } from 'next';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '아파트 현장 정보 — 전국 분양·재개발·미분양 현장 목록 | 카더라',
  description: '전국 3,000+ 아파트 현장의 분양 정보, 청약 일정, 재개발 진행 현황, 미분양 현황을 한눈에. 현장명으로 검색하세요.',
  alternates: { canonical: `${SITE_URL}/apt/sites` },
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large' as const,
  },
  openGraph: {
    title: '아파트 현장 정보 — 전국 분양·재개발·미분양 | 카더라',
    description: '전국 3,000+ 아파트 현장의 분양 정보, 청약 일정, 재개발 진행 현황을 한눈에.',
    url: `${SITE_URL}/apt/sites`,
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('아파트 현장 정보')}&subtitle=${encodeURIComponent('전국 3,000+ 분양·재개발·미분양')}`, width: 1200, height: 630 }],
  },
};

const typeLabel: Record<string, string> = { subscription: '분양', redevelopment: '재개발', unsold: '미분양', landmark: '랜드마크', complex: '기존단지' };
const typeBg: Record<string, string> = { subscription: 'rgba(52,211,153,0.2)', redevelopment: 'rgba(183,148,255,0.15)', unsold: 'rgba(255,107,107,0.15)', landmark: 'rgba(56,189,248,0.15)', complex: 'rgba(56,189,248,0.15)' };
const typeColor: Record<string, string> = { subscription: '#2EE8A5', redevelopment: '#B794FF', unsold: '#FF6B6B', landmark: '#38BDF8', complex: '#38BDF8' };

export default async function SitesListPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const region = sp.region || '';
  const type = sp.type || '';
  const q = sp.q || '';
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = 30;

  const sb = getSupabaseAdmin();
  let query = (sb as any).from('apt_sites').select('slug, name, site_type, region, sigungu, total_units, status, interest_count, content_score', { count: 'exact' })
    .eq('is_active', true).gte('content_score', 25)
    .order('interest_count', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (region) query = query.eq('region', region);
  if (type) query = query.eq('site_type', type);
  if (q) query = query.ilike('name', `%${q}%`);

  const { data: sites, count } = await query;
  const totalPages = Math.ceil((count || 0) / perPage);

  const REGIONS = ['서울','부산','경기','인천','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'];

  // 지역별 카운트
  const { data: regionCounts } = await (sb as any).from('apt_sites')
    .select('region').eq('is_active', true).gte('content_score', 25);
  const rCounts: Record<string, number> = {};
  (regionCounts || []).forEach((r: any) => { rCounts[r.region] = (rCounts[r.region] || 0) + 1; });

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* ItemList — 구글 캐러셀 리치 결과 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: `아파트 현장 목록${region ? ` — ${region}` : ''}`,
        numberOfItems: count || 0,
        itemListElement: (sites || []).slice(0, 10).map((s: any, i: number) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: s.name,
          url: `${SITE_URL}/apt/sites/${s.slug}`,
        })),
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: '아파트 현장 정보',
        description: `전국 ${count || 0}개 아파트 현장의 분양·재개발·미분양 정보`,
        url: `${SITE_URL}/apt/sites`,
        isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL },
      }) }} />

      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>아파트 현장 정보</h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', margin: '0 0 16px' }}>전국 {(count || 0).toLocaleString()}개 현장의 분양·재개발·미분양 정보</p>

      {/* 지역 필터 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <Link href="/apt/sites" style={{ padding: '6px 14px', borderRadius: 20, fontSize: 'var(--fs-xs)', fontWeight: 600, textDecoration: 'none', background: !region ? 'var(--brand)' : 'var(--bg-surface)', color: !region ? '#fff' : 'var(--text-secondary)', border: `1px solid ${!region ? 'var(--brand)' : 'var(--border)'}` }}>전체</Link>
        {REGIONS.map(r => (
          <Link key={r} href={`/apt/sites?region=${r}${type ? `&type=${type}` : ''}${q ? `&q=${q}` : ''}`} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 'var(--fs-xs)', fontWeight: 600, textDecoration: 'none', background: region === r ? 'var(--brand)' : 'var(--bg-surface)', color: region === r ? '#fff' : 'var(--text-secondary)', border: `1px solid ${region === r ? 'var(--brand)' : 'var(--border)'}` }}>
            {r} {rCounts[r] ? <span style={{ opacity: 0.7 }}>({rCounts[r]})</span> : null}
          </Link>
        ))}
      </div>

      {/* 타입 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['', 'subscription', 'redevelopment', 'unsold'].map(t => (
          <Link key={t} href={`/apt/sites?${region ? `region=${region}&` : ''}type=${t}${q ? `&q=${q}` : ''}`} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 'var(--fs-xs)', fontWeight: 600, textDecoration: 'none', background: type === t ? 'var(--brand)' : 'var(--bg-surface)', color: type === t ? '#fff' : 'var(--text-secondary)', border: `1px solid ${type === t ? 'var(--brand)' : 'var(--border)'}` }}>
            {t ? typeLabel[t] : '전체'}
          </Link>
        ))}
      </div>

      {/* 현장 목록 */}
      {(sites || []).map((s: any) => (
        <Link key={s.slug} href={`/apt/sites/${s.slug}`} className="kd-card" style={{ display: 'block', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 8, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 10, fontSize: 'var(--fs-xs)', fontWeight: 700, background: typeBg[s.site_type], color: typeColor[s.site_type] }}>
                  {typeLabel[s.site_type]}
                </span>
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                {s.region} {s.sigungu || ''} · {s.total_units ? `${s.total_units.toLocaleString()}세대` : ''}
              </div>
            </div>
            {(s.interest_count || 0) > 0 && (
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--brand)' }}>{s.interest_count}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>관심</div>
              </div>
            )}
          </div>
        </Link>
      ))}

      {/* 빈 결과 */}
      {(!sites || sites.length === 0) && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 'var(--fs-xl)', marginBottom: 8 }}>🏗️</div>
          <p style={{ fontSize: 'var(--fs-sm)' }}>조건에 맞는 현장이 없습니다</p>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '16px 0' }}>
          {page > 1 && <Link href={`/apt/sites?page=${page - 1}${region ? `&region=${region}` : ''}${type ? `&type=${type}` : ''}${q ? `&q=${q}` : ''}`} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)' }}>← 이전</Link>}
          <span style={{ padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{page} / {totalPages}</span>
          {page < totalPages && <Link href={`/apt/sites?page=${page + 1}${region ? `&region=${region}` : ''}${type ? `&type=${type}` : ''}${q ? `&q=${q}` : ''}`} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)' }}>다음 →</Link>}
        </div>
      )}
    </div>
  );
}
