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
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('블로그 시리즈')}&category=blog`, width: 1200, height: 630, alt: '카더라 블로그 시리즈' }],
  },
  twitter: { card: 'summary_large_image' },
  other: { 'naver:written_time': new Date().toISOString(), 'dg:plink': SITE_URL + '/blog/series' },
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
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '블로그', item: SITE_URL + '/blog' }, { '@type': 'ListItem', position: 3, name: '시리즈' }] }) }} />
      <div style={{ marginBottom: 20 }}>
        <Link href="/blog" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 블로그</Link>
        <h1 style={{ margin: '8px 0 0', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>📚 시리즈</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>주제별로 묶어서 읽는 연재 콘텐츠</p>
      </div>

      {seriesList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
          <BookOpen size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 'var(--fs-sm)' }}>아직 시리즈가 없습니다</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {seriesList.map(s => (
            <Link key={s.id} href={`/blog/series/${s.slug}`} className="kd-card-hover" style={{
              display: 'block', textDecoration: 'none',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {s.cover_image && (
                  <div style={{ width: 80, height: 60, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                    <Image src={s.cover_image} alt={s.title || ''} fill sizes="80px" style={{ objectFit: 'cover' }} loading="lazy" unoptimized={!s.cover_image.includes('supabase.co')} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{s.title}</h2>
                  {s.description && (
                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontWeight: 600 }}>{s.post_count}편</span>
                    {s.category && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: s.category === 'stock' ? 'rgba(96,165,250,0.1)' : s.category === 'apt' ? 'rgba(52,211,153,0.1)' : 'rgba(167,139,250,0.1)', color: s.category === 'stock' ? 'var(--accent-blue)' : s.category === 'apt' ? 'var(--accent-green)' : 'var(--accent-purple)' }}>{s.category === 'stock' ? '주식' : s.category === 'apt' ? '청약' : s.category === 'unsold' ? '미분양' : s.category === 'finance' ? '재테크' : s.category}</span>}
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-hover)', marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min((s.post_count / 50) * 100, 100)}%`, background: 'var(--brand)', borderRadius: 2 }} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
