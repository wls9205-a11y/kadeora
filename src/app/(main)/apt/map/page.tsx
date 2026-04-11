import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import MapWrapper from './MapWrapper';
import ShareButtons from '@/components/ShareButtons';

export const metadata: Metadata = {
  title: '부동산 지도',
  description: '전국 청약·분양·재개발·미분양 정보를 지도에서 한눈에 확인하세요. 지역별 시세, 청약 일정, 미분양 현황까지.',
  alternates: { canonical: SITE_URL + '/apt/map' },
  robots: { index: true, follow: true, 'max-snippet': -1 as const, 'max-image-preview': 'large' as const },
  openGraph: {
    title: '부동산 지도',
    description: '전국 청약·분양·재개발·미분양 지도 보기',
    url: SITE_URL + '/apt/map',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('부동산 지도')}&design=2&subtitle=${encodeURIComponent('전국 청약·분양·미분양 한눈에')}`, width: 1200, height: 630, alt: '카더라 부동산 지도' },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('부동산 지도')}&category=apt`, width: 630, height: 630 },
    ],
  },
  twitter: { card: 'summary_large_image' },
  other: { 'naver:written_time': new Date().toISOString(), 'naver:updated_time': new Date().toISOString(), 'naver:author': '카더라',
      'article:section': '부동산', 'dg:plink': SITE_URL + '/apt/map' },
};

const REGIONS = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'];

export default async function AptMapPage() {
  const sb = await createSupabaseServer();

  const [subR, unsoldR, redevR, tradeR] = await Promise.all([
    sb.from('apt_subscriptions').select('region_nm').gte('rcept_endde', new Date().toISOString().slice(0, 10)).limit(5000),
    sb.from('unsold_apts').select('region_nm').eq('is_active', true).limit(5000),
    sb.from('redevelopment_projects').select('region').eq('is_active', true).limit(5000),
    sb.from('apt_transactions').select('region_nm').gte('deal_date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)).limit(5000),
  ]);

  // Count by region
  const subByRegion: Record<string, number> = {};
  const unsoldByRegion: Record<string, number> = {};
  const redevByRegion: Record<string, number> = {};
  (subR.data || []).forEach((r: any) => {
    const key = REGIONS.find(reg => (r.region_nm || '').startsWith(reg));
    if (key) subByRegion[key] = (subByRegion[key] || 0) + 1;
  });
  (unsoldR.data || []).forEach((r: any) => {
    const key = REGIONS.find(reg => (r.region_nm || '').startsWith(reg));
    if (key) unsoldByRegion[key] = (unsoldByRegion[key] || 0) + 1;
  });
  (redevR.data || []).forEach((r: any) => {
    const key = REGIONS.find(reg => (r.region || '').startsWith(reg));
    if (key) redevByRegion[key] = (redevByRegion[key] || 0) + 1;
  });
  const tradeByRegion: Record<string, number> = {};
  (tradeR?.data || []).forEach((r: { region_nm: string | null }) => {
    const key = REGIONS.find(reg => (r.region_nm || '').startsWith(reg));
    if (key) tradeByRegion[key] = (tradeByRegion[key] || 0) + 1;
  });

  return (
    <>      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "지도에서 청약 현장을 볼 수 있나요?", acceptedAnswer: { "@type": "Answer", text: "카더라 부동산 지도에서 전국 청약·분양·미분양·재개발 현장을 확인할 수 있습니다." } }] }) }} />

    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '부동산', item: SITE_URL + '/apt' }, { '@type': 'ListItem', position: 3, name: '지도' }] }) }} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-md)' }}>
          <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🗺️ 지역별 부동산 현황</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
            <ShareButtons title="지역별 부동산 현황 — 청약·미분양·재개발 지도" postId="apt-map" />
            <Link href="/apt" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 부동산</Link>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--sp-sm)' }}>
          {REGIONS.map(r => {
            const sub = subByRegion[r] || 0;
            const unsold = unsoldByRegion[r] || 0;
            const redev = redevByRegion[r] || 0;
            return (
              <Link key={r} href={`/apt/region/${encodeURIComponent(r)}`} style={{
                padding: 14, borderRadius: 'var(--radius-card)', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                textDecoration: 'none', color: 'inherit', transition: 'border-color var(--transition-fast)',
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>{r}</div>
                <div style={{ display: 'flex', gap: 'var(--sp-xs)', flexWrap: 'wrap' }}>
                  {sub > 0 && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(52,211,153,0.1)', color: 'var(--accent-green)', fontWeight: 600 }}>청약 {sub}</span>}
                  {unsold > 0 && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,107,107,0.1)', color: 'var(--accent-red)', fontWeight: 600 }}>미분양 {unsold}</span>}
                  {redev > 0 && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,159,67,0.1)', color: 'var(--accent-orange)', fontWeight: 600 }}>재개발 {redev}</span>}
                  {(tradeByRegion[r] || 0) > 0 && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.1)', color: 'var(--accent-blue)', fontWeight: 600 }}>실거래 {tradeByRegion[r]}</span>}
                  {sub === 0 && unsold === 0 && redev === 0 && (tradeByRegion[r] || 0) === 0 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>데이터 준비 중</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <div style={{ marginTop: 'var(--sp-xl)' }}>
        <MapWrapper />
      </div>
  
    </>);
}
