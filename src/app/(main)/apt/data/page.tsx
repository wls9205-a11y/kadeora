import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { SITE_URL as SITE } from '@/lib/constants';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '부동산 통계 자료실 — 시군구별 청약·분양·실거래 데이터',
  description: '전국 시군구별 아파트 청약 일정, 분양가, 미분양, 실거래가 통계 자료를 무료로 다운로드하세요. 카더라 독점 데이터 분석.',
  keywords: ['부동산 통계', '청약 통계', '시군구별 분양가', '미분양 통계', '실거래 데이터', '아파트 데이터 다운로드'],
  openGraph: {
    title: '부동산 통계 자료실 — 카더라',
    description: '전국 시군구별 청약·분양·미분양·실거래 데이터 무료 다운로드',
    url: `${SITE}/apt/data`,
    siteName: '카더라', locale: 'ko_KR', type: 'website',
    images: [{ url: `${SITE}/api/og?title=${encodeURIComponent('부동산 통계 자료실')}&category=apt&design=2`, width: 1200, height: 630 }],
  },
  alternates: { canonical: `${SITE}/apt/data` },
  other: {
    'naver:author': '카더라 부동산팀',
    'naver:written_time': '2026-01-15T00:00:00Z',
    'naver:updated_time': new Date().toISOString(),
    'naver:site_name': '카더라',
    'article:section': '부동산',
    'article:tag': '부동산통계,청약통계,분양가,미분양,실거래데이터',
  },
};

export const revalidate = 3600;

// 지역 목록 
const REGIONS = [
  { code: '서울', label: '서울특별시' },
  { code: '부산', label: '부산광역시' },
  { code: '대구', label: '대구광역시' },
  { code: '인천', label: '인천광역시' },
  { code: '광주', label: '광주광역시' },
  { code: '대전', label: '대전광역시' },
  { code: '울산', label: '울산광역시' },
  { code: '세종', label: '세종특별자치시' },
  { code: '경기', label: '경기도' },
  { code: '강원', label: '강원특별자치도' },
  { code: '충북', label: '충청북도' },
  { code: '충남', label: '충청남도' },
  { code: '전북', label: '전북특별자치도' },
  { code: '전남', label: '전라남도' },
  { code: '경북', label: '경상북도' },
  { code: '경남', label: '경상남도' },
  { code: '제주', label: '제주특별자치도' },
];

export default async function AptDataPage() {
  const sb = await createSupabaseServer();

  // 청약 통계 집계
  const { count: totalSites } = await (sb as any).from('subscription_sites').select('id', { count: 'exact', head: true });
  const { count: totalUnsold } = await (sb as any).from('unsold_apartments').select('id', { count: 'exact', head: true });

  // 지역별 청약 건수
  const { data: regionStats } = await (sb as any).from('subscription_sites').select('region').order('region');
  const regionCounts: Record<string, number> = {};
  (regionStats ?? []).forEach((r: any) => {
    const key = r.region?.slice(0, 2) || '기타';
    regionCounts[key] = (regionCounts[key] || 0) + 1;
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DataCatalog',
    name: '카더라 부동산 통계 자료실',
    description: '전국 시군구별 아파트 청약·분양·미분양·실거래 데이터',
    url: `${SITE}/apt/data`,
    provider: { '@type': 'Organization', name: '카더라', url: SITE },
    inLanguage: 'ko-KR',
    dateModified: new Date().toISOString(),
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 80px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"카더라","item":SITE},{"@type":"ListItem","position":2,"name":"부동산","item":`${SITE}/apt`},{"@type":"ListItem","position":3,"name":"통계 자료실"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"부동산 통계 자료는 어디서 확인하나요?","acceptedAnswer":{"@type":"Answer","text":"카더라 부동산 통계 자료실에서 전국 시군구별 청약·분양·미분양·실거래 데이터를 무료로 확인할 수 있습니다."}},{"@type":"Question","name":"실거래가 데이터는 얼마나 자주 업데이트되나요?","acceptedAnswer":{"@type":"Answer","text":"카더라의 실거래가 데이터는 국토교통부 실거래가 공개시스템과 연동되어 매일 자동 업데이트됩니다."}}]}) }} />

      {/* 헤더 */}
      <div style={{ padding: '24px 0 16px' }}>
        <nav style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, display: 'flex', gap: 4 }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
          <span>›</span>
          <Link href="/apt" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>부동산</Link>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>통계 자료실</span>
        </nav>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.5px' }}>
          📊 부동산 통계 자료실
        </h1>
        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
          전국 시군구별 아파트 청약·분양·미분양·실거래 데이터를 무료로 다운로드하세요.<br />
          부동산 전문가, 분석가를 위한 카더라 독점 통계 자료입니다.
        </p>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 28 }}>
        {[
          { label: '청약 현장', value: totalSites?.toLocaleString() ?? '-', emoji: '🏗️' },
          { label: '미분양 현황', value: totalUnsold?.toLocaleString() ?? '-', emoji: '🏚️' },
          { label: '제공 지역', value: '17개 시도', emoji: '🗺️' },
          { label: '업데이트', value: '매일', emoji: '🔄' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{k.emoji}</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{k.value}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* 다운로드 카테고리 */}
      <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>📥 데이터 카테고리</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 32 }}>
        {[
          { title: '청약 일정 및 분양가', desc: '접수중·예정 청약 현장의 분양가·세대수·일정 데이터', icon: '🏗️',
            links: [{ href: '/api/data/apt-subscription?format=xlsx', label: 'Excel', color: 'var(--accent-green)' }, { href: '/api/data/apt-subscription?format=csv', label: 'CSV', color: 'var(--accent-blue)' }] },
          { title: '미분양 현황', desc: '전국 시도별·시군구별 미분양 아파트 현황 데이터', icon: '🏚️',
            links: [{ href: '/api/data/apt-unsold?format=xlsx', label: 'Excel', color: 'var(--accent-green)' }, { href: '/api/data/apt-unsold?format=csv', label: 'CSV', color: 'var(--accent-blue)' }] },
          { title: '단지백과 기본 정보', desc: '전국 34,000+ 아파트 단지의 기본 정보·세대수·준공일', icon: '🏢',
            links: [{ href: '/api/data/apt-complex?format=xlsx', label: 'Excel', color: 'var(--accent-green)' }, { href: '/api/data/apt-complex?format=csv', label: 'CSV', color: 'var(--accent-blue)' }] },
        ].map(item => (
          <div key={item.title} style={{
            padding: 18, borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>{item.icon}</span>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</div>
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>{item.desc}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {item.links.map(l => (
                <a key={l.label} href={l.href} download style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: 700,
                  textDecoration: 'none', background: `color-mix(in srgb, ${l.color} 15%, transparent)`,
                  color: l.color, border: `1px solid color-mix(in srgb, ${l.color} 30%, transparent)`,
                }}>📥 {l.label}</a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 지역별 데이터 */}
      <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>🗺️ 지역별 데이터</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 32 }}>
        {REGIONS.map(r => (
          <Link key={r.code} href={`/apt/region/${r.code}`} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            textDecoration: 'none', color: 'var(--text-primary)',
            fontSize: 'var(--fs-sm)', fontWeight: 600,
          }}>
            <span>{r.label}</span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 400 }}>
              {regionCounts[r.code] || 0}건
            </span>
          </Link>
        ))}
      </div>

      {/* 비로그인 가입 유도 */}
      <div style={{
        padding: 24, borderRadius: 'var(--radius-lg)', textAlign: 'center',
        background: 'linear-gradient(135deg, var(--brand-bg), var(--accent-green-bg))',
        border: '1px solid var(--brand-border)',
      }}>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
          더 많은 데이터를 원하시나요?
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          카더라에 가입하면 실거래가 비교, AI 분석, 맞춤 알림까지 무료로 이용하실 수 있습니다.
        </div>
        <Link href="/login?redirect=/apt/data" style={{
          display: 'inline-block', padding: '12px 32px', borderRadius: 'var(--radius-pill)',
          background: 'var(--kakao-bg)', color: 'var(--kakao-text)',
          fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none',
        }}>
          카카오로 3초 가입
        </Link>
      </div>
    </div>
  );
}
