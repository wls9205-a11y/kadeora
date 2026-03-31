import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: '블로그 시리즈',
  description: '카더라 블로그 시리즈 — 주제별로 엮인 연재 콘텐츠. 주식, 부동산, 재테크 심층 분석을 시리즈로 읽어보세요.',
  alternates: { canonical: SITE_URL + '/blog/series' },
  openGraph: {
    title: '블로그 시리즈',
    description: '주제별 연재 콘텐츠 — 심층 분석 시리즈',
    url: SITE_URL + '/blog/series',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('블로그 시리즈')}&design=2&category=blog`, width: 1200, height: 630, alt: '카더라 블로그 시리즈' }],
  },
  twitter: { card: 'summary_large_image' },
  other: { 'naver:written_time': '2026-01-15T00:00:00Z', 'naver:updated_time': new Date().toISOString(), 'dg:plink': SITE_URL + '/blog/series' },
};

export const revalidate = 3600;

export default async function BlogSeriesPage() {
  let seriesList: any[] = [];
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from('blog_series')
      .select('id,title,slug,description,cover_image,category,post_count,is_active').eq('is_active', true)
      .order('post_count', { ascending: false });
    seriesList = data || [];
  } catch { }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '블로그', item: SITE_URL + '/blog' }, { '@type': 'ListItem', position: 3, name: '시리즈' }] }) }} />
      <div style={{ marginBottom: 'var(--sp-xl)' }}>
        <Link href="/blog" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 블로그</Link>
        <h1 style={{ margin: '8px 0 0', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>📚 시리즈</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>주제별로 묶어서 읽는 연재 콘텐츠</p>
      </div>

      {seriesList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
          <BookOpen size={40} style={{ marginBottom: 'var(--sp-md)', opacity: 0.5 }} />
          <p style={{ fontSize: 'var(--fs-sm)' }}>아직 시리즈가 없습니다</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--sp-md)' }}>
          {seriesList.map(s => {
            const catColor = s.category === 'stock' ? '#00E5FF' : s.category === 'apt' ? '#00FF87' : s.category === 'finance' ? '#FFE000' : '#C084FC';
            return (
            <Link key={s.id} href={`/blog/series/${s.slug}`} className="kd-card-hover" style={{
              display: 'block', textDecoration: 'none',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            }}>
              {/* 매거진 커버 */}
              <div style={{ height: 80, background: `linear-gradient(135deg, ${catColor}18 0%, ${catColor}08 100%)`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, position: 'relative' }}>
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-card)', background: `${catColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xl)', flexShrink: 0 }}>
                  {s.category === 'stock' ? '📈' : s.category === 'apt' ? '🏢' : s.category === 'finance' ? '💰' : '📝'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{s.title}</h2>
                  {s.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</p>}
                </div>
                <div style={{ position: 'absolute', top: 10, right: 14, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-xl)', background: `${catColor}20`, color: catColor, border: `1px solid ${catColor}40` }}>
                  {s.post_count}편
                </div>
              </div>
              {/* 진행률 바 */}
              <div style={{ padding: '0 20px 12px' }}>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-hover)', marginTop: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min((s.post_count / 50) * 100, 100)}%`, background: `linear-gradient(90deg, ${catColor}, var(--brand))`, borderRadius: 2 }} />
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
