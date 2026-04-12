import Link from 'next/link';
import { CATEGORIES, CALC_REGISTRY } from '@/lib/calc/registry';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: '무료 계산기 모음 — 세금·부동산·주식·대출',
  description: '취득세, 양도세, 복리, 연봉 실수령액, 대출 상환, 청약 가점 등 145종 무료 계산기. 2026년 최신 세법 반영.',
  alternates: { canonical: `${SITE_URL}/calc` },
  openGraph: {
    title: '무료 계산기 모음 — 카더라',
    description: '세금·부동산·주식·대출 145종 무료 계산기',
    url: `${SITE_URL}/calc`,
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('무료 계산기 모음')}&design=2&subtitle=${encodeURIComponent('세금·부동산·주식·대출 145종')}`, width: 1200, height: 630 }, { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('계산기')}&category=blog`, width: 630, height: 630 }],
  },
  keywords: ['계산기', '무료 계산기', '세금 계산기', '대출 계산기', '양도세 계산기', '취득세 계산기', '실수령액 계산기', '카더라'],
  twitter: { card: 'summary_large_image', title: '무료 계산기 모음 — 카더라', description: '세금·부동산·주식·대출 145종 무료 계산기' },
  other: {
    'naver:site_name': '카더라', 'naver:author': '카더라',
    'naver:description': '취득세, 양도세, 복리, 연봉 실수령액, 대출 상환, 청약 가점 등 145종 무료 계산기. 2026년 최신 세법 반영.',
    'naver:written_time': '2026-01-15T00:00:00Z',
    'naver:updated_time': '2026-04-12T00:00:00Z',
    'article:section': '계산기',
    'article:tag': '계산기,세금,부동산,주식,대출,무료',
  },
};

export default function CalcHubPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: 'https://kadeora.app' },
          { '@type': 'ListItem', position: 2, name: '계산기' },
        ],
      })}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: '카더라 무료 계산기 모음',
        numberOfItems: CALC_REGISTRY.length,
        itemListElement: CALC_REGISTRY.slice(0, 10).map((c, i) => ({
          '@type': 'ListItem', position: i + 1,
          url: 'https://kadeora.app/calc/' + c.category + '/' + c.slug,
          name: c.title,
          image: 'https://kadeora.app/api/og?title=' + encodeURIComponent(c.title) + '&design=2&category=calc',
        })),
      })}} />
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, marginBottom: 4, letterSpacing: '-0.5px' }}>무료 계산기 모음</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>세금 · 부동산 · 주식 · 대출 · 연금 — {CALC_REGISTRY.length}종 무료 제공</p>

      {CATEGORIES.map(cat => {
        const calcs = CALC_REGISTRY.filter(c => c.category === cat.id);
        if (calcs.length === 0) return null;
        return (
          <div key={cat.id} style={{ marginBottom: 24 }}>
            <Link href={`/calc/${cat.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, textDecoration: 'none' }}>
              <span style={{ fontSize: 20 }}>{cat.icon}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{cat.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{calcs.length}종 →</span>
            </Link>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
              {calcs.map(c => (
                <Link key={c.slug} href={`/calc/${c.category}/${c.slug}`} style={{
                  display: 'block', padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                }}>
                  {c.titleShort}
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      <div className="blog-content" style={{ marginTop: 32 }}>
        <h2>카더라 계산기 소개</h2>
        <p>카더라는 부동산, 주식, 세금, 대출, 연금 등 투자와 생활에 필요한 각종 계산기를 무료로 제공합니다. 모든 계산기는 2026년 최신 세법과 요율을 반영하며, 법적 근거를 명시하고 있습니다. 계산 결과는 참고용이며, 실제 세금 신고나 금융 의사결정 시 전문가 상담을 권장합니다.</p>
      </div>
    </div>
    </>
  );
}