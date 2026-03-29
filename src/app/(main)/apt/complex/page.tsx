import { createSupabaseServer } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import type { Metadata } from 'next';
import { fmtAmount } from '@/lib/format';
import ComplexClient from './ComplexClient';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '단지백과 — 입주 연차별 아파트 종합 가이드 | 카더라',
  description: '전국 아파트를 입주 연차별로 비교하세요. 신축부터 30년+ 구축까지, 매매·전세·월세 실거래가와 시세 추이를 한눈에.',
  alternates: { canonical: `${SITE_URL}/apt/complex` },
  openGraph: {
    title: '단지백과 | 카더라',
    description: '입주 연차별 아파트 종합 가이드 — 매매·전세·월세 시세 비교',
    url: `${SITE_URL}/apt/complex`,
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('단지백과')}&category=apt&design=2&subtitle=${encodeURIComponent('입주 연차별 아파트 가이드')}`, width: 1200, height: 630 }],
  },
  other: { 'naver:author': '카더라 부동산팀', 'og:updated_time': new Date().toISOString() },
};

const AGE_GROUPS = ['신축', '5년차', '10년차', '15년차', '20년차', '25년차', '30년+'];
const REGIONS = ['서울', '경기', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

function getAgeGroup(builtYear: number): string {
  const age = 2026 - builtYear;
  if (age <= 3) return '신축';
  if (age <= 8) return '5년차';
  if (age <= 13) return '10년차';
  if (age <= 18) return '15년차';
  if (age <= 23) return '20년차';
  if (age <= 28) return '25년차';
  return '30년+';
}

export default async function ComplexPage() {
  const sb = await createSupabaseServer();

  // 연차별 통계 (매매)
  const { data: trades } = await sb.from('apt_transactions')
    .select('apt_name, region_nm, sigungu, built_year, deal_amount, exclusive_area')
    .gt('deal_amount', 0)
    .not('built_year', 'is', null)
    .limit(10000) as { data: any[] | null };

  // 전월세 통계
  const { data: rents } = await (sb as any).from('apt_rent_transactions')
    .select('apt_name, region_nm, sigungu, built_year, rent_type, deposit, monthly_rent')
    .gt('deposit', 0)
    .not('built_year', 'is', null)
    .limit(50000);

  // 연차별 집계
  const ageStats = new Map<string, { cnt: number; totalPrice: number; apts: Set<string>; sigungus: Set<string> }>();
  AGE_GROUPS.forEach(g => ageStats.set(g, { cnt: 0, totalPrice: 0, apts: new Set(), sigungus: new Set() }));

  for (const t of (trades || [])) {
    const group = getAgeGroup(t.built_year);
    const stat = ageStats.get(group);
    if (stat) {
      stat.cnt++;
      stat.totalPrice += t.deal_amount;
      stat.apts.add(`${t.apt_name}__${t.sigungu}`);
      stat.sigungus.add(t.sigungu);
    }
  }

  const ageChartData = AGE_GROUPS.map(g => {
    const s = ageStats.get(g)!;
    return { group: g, avg: s.cnt > 0 ? Math.round(s.totalPrice / s.cnt) : 0, count: s.cnt, apts: s.apts.size };
  });

  // 지역별 통계
  const regionStats = new Map<string, { sales: number; rents: number; apts: Set<string> }>();
  for (const t of (trades || [])) {
    const r = t.region_nm;
    if (!regionStats.has(r)) regionStats.set(r, { sales: 0, rents: 0, apts: new Set() });
    const s = regionStats.get(r)!;
    s.sales++;
    s.apts.add(t.apt_name);
  }
  for (const r of (rents || [])) {
    const reg = r.region_nm;
    if (!regionStats.has(reg)) regionStats.set(reg, { sales: 0, rents: 0, apts: new Set() });
    regionStats.get(reg)!.rents++;
  }

  const regionData = REGIONS.map(r => {
    const s = regionStats.get(r);
    return { region: r, sales: s?.sales || 0, rents: s?.rents || 0, apts: s?.apts.size || 0 };
  }).filter(r => r.sales > 0 || r.rents > 0);

  // 인기 단지 TOP 20 (거래 많은 순)
  const complexMap = new Map<string, { aptName: string; sigungu: string; region: string; builtYear: number; saleCount: number; lastPrice: number; lastDate: string; jeonse: number; monthly: number; monthlyRent: number }>();

  for (const t of (trades || [])) {
    const key = `${t.apt_name}__${t.sigungu}`;
    if (!complexMap.has(key)) {
      complexMap.set(key, { aptName: t.apt_name, sigungu: t.sigungu, region: t.region_nm, builtYear: t.built_year, saleCount: 0, lastPrice: t.deal_amount, lastDate: '', jeonse: 0, monthly: 0, monthlyRent: 0 });
    }
    const c = complexMap.get(key)!;
    c.saleCount++;
    if (!c.lastDate || t.deal_date > c.lastDate) { c.lastPrice = t.deal_amount; c.lastDate = t.deal_date; }
  }

  for (const r of (rents || [])) {
    const key = `${r.apt_name}__${r.sigungu}`;
    const c = complexMap.get(key);
    if (c) {
      if (r.rent_type === 'jeonse' && r.deposit > c.jeonse) c.jeonse = r.deposit;
      if (r.rent_type === 'monthly') { if (r.deposit > c.monthly) c.monthly = r.deposit; if (r.monthly_rent > c.monthlyRent) c.monthlyRent = r.monthly_rent; }
    }
  }

  const topComplexes = [...complexMap.values()]
    .sort((a, b) => b.saleCount - a.saleCount)
    .slice(0, 60)
    .map(c => ({
      ...c,
      ageGroup: getAgeGroup(c.builtYear),
      jeonseRatio: c.jeonse && c.lastPrice ? Math.round((c.jeonse / c.lastPrice) * 100) : null,
    }));

  const totalApts = new Set([...(trades || []).map(t => `${t.apt_name}__${t.sigungu}`)]).size;
  const totalRentApts = new Set([...(rents || []).map((r: any) => `${r.apt_name}__${r.sigungu}`)]).size;

  return (
    <article style={{ maxWidth: 960, margin: '0 auto', padding: '0 14px 80px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: '단지백과 — 입주 연차별 아파트 가이드',
        description: '전국 아파트를 입주 연차별로 비교하는 종합 가이드',
        url: `${SITE_URL}/apt/complex`,
        isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL },
      })}} />

      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <nav style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8, display: 'flex', gap: 4 }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>홈</Link><span>›</span>
          <Link href="/apt" style={{ color: 'inherit', textDecoration: 'none' }}>부동산</Link><span>›</span>
          <span style={{ color: 'var(--text-primary)' }}>단지백과</span>
        </nav>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>🏢 단지백과</h1>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          입주 연차별 아파트 종합 가이드 — 매매 {totalApts.toLocaleString()}개 · 전월세 {totalRentApts.toLocaleString()}개 단지
        </p>
      </div>

      {/* 연차별 시세 비교 */}
      <div className="kd-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📊 연차별 평균 매매가</div>
        {ageChartData.map(d => {
          const maxAvg = Math.max(...ageChartData.map(x => x.avg));
          const pct = maxAvg > 0 ? (d.avg / maxAvg) * 100 : 0;
          return (
            <div key={d.group} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', minWidth: 48 }}>{d.group}</span>
              <div style={{ flex: 1, height: 22, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: d.group === '신축' ? 'var(--brand)' : d.group.includes('30') ? 'var(--accent-red)' : 'var(--accent-blue)', transition: 'width 0.3s' }} />
                {d.avg > 0 && (
                  <span style={{ position: 'absolute', right: 8, top: 3, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {fmtAmount(d.avg)}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 50, textAlign: 'right' }}>{d.apts}개 단지</span>
            </div>
          );
        })}
      </div>

      {/* 지역별 현황 */}
      <div className="kd-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🗺️ 지역별 현황</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {regionData.map(r => (
            <Link key={r.region} href={`/apt/complex?region=${r.region}`} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {r.region}
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.apts}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 클라이언트 필터 + 카드 그리드 */}
      <ComplexClient complexes={topComplexes} ageGroups={AGE_GROUPS} regions={regionData.map(r => r.region)} />
    </article>
  );
}
