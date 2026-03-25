import { SITE_URL } from '@/lib/constants';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase-server';
import HotClient from './HotClient';

export const metadata: Metadata = {
  title: '오늘의 HOT',
  description: '오늘 가장 인기있는 카더라 게시글. 실시간 추천수 기반 인기 글을 확인하세요.',
  alternates: { canonical: SITE_URL + '/hot' },
  openGraph: {
    title: '오늘의 HOT',
    description: '실시간 인기 게시글 TOP',
    url: SITE_URL + '/hot',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('오늘의 HOT')}&category=general`, width: 1200, height: 630, alt: '카더라 HOT' }],
  },
  twitter: { card: 'summary_large_image' },
  other: { 'naver:written_time': new Date().toISOString() },
};

export const revalidate = 60;

const MEDAL: Record<number, string> = {
  1: '🥇', 2: '🥈', 3: '🥉', 4: '4️⃣', 5: '5️⃣',
};

const CATEGORY_LABEL: Record<string, string> = {
  stock: '📈 주식', apt: '🏠 부동산', local: '🏘 우리동네', free: '💬 자유',
};

const REGION_SECTIONS = ['서울', '부산', '경기', '인천'];

const withTimeout = <T,>(p: PromiseLike<T>, ms = 5000): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

export default async function HotPage() {
  let topPosts: any[] | null = null;
  const regionPosts: Record<string, any[]> = {};

  try {
    const sb = await createSupabaseServer();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const topResult = await withTimeout(
      sb.from('posts')
        .select('id,title,slug,category,likes_count,comments_count,view_count,region_id,author_id,profiles!posts_author_id_fkey(nickname)')
        .eq('is_deleted', false).gte('created_at', weekAgo)
        .order('likes_count', { ascending: false }).limit(5)
    );
    topPosts = (topResult as any)?.data ?? null;

    if (!topPosts || topPosts.length === 0) {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const fallback = await withTimeout(
        sb.from('posts')
          .select('id,title,slug,category,likes_count,comments_count,view_count,region_id,author_id,profiles!posts_author_id_fkey(nickname)')
          .eq('is_deleted', false).gte('created_at', monthAgo)
          .order('likes_count', { ascending: false }).limit(5)
      );
      topPosts = (fallback as any)?.data ?? null;
    }

    const regionResults = await Promise.allSettled(
      REGION_SECTIONS.map(region =>
        withTimeout(
          sb.from('posts')
            .select('id,title,slug,category,likes_count,comments_count,view_count,profiles!posts_author_id_fkey(nickname)')
            .eq('is_deleted', false).eq('region_id', region).gte('created_at', weekAgo)
            .order('likes_count', { ascending: false }).limit(3)
        )
      )
    );
    REGION_SECTIONS.forEach((region, i) => {
      const r = regionResults[i];
      const data = r.status === 'fulfilled' ? (r.value as any)?.data : null;
      if (data && data.length > 0) regionPosts[region] = data;
    });
  } catch { }

  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRange = `${weekStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~ ${now.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`;

  return (
    <HotClient>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"홈","item":SITE_URL},{"@type":"ListItem","position":2,"name":"HOT 게시글","item":SITE_URL + "/hot"}]}) }} />
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>🔥 HOT 게시글</h1>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{dateRange}</p>
      </div>

      {/* 전국 TOP 5 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>전국 TOP 5</h2>
        {(topPosts ?? []).length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>이번 주 데이터가 아직 없어요</p>
        ) : (
          (topPosts ?? []).map((post: any, i: number) => {
              const isTop3 = i < 3;
              return (
              <Link key={post.id} href={`/feed/${post.slug || post.id}`} className="kd-feed-card" style={{
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12,
                padding: isTop3 ? '14px 12px' : '10px 4px',
                borderBottom: i < (topPosts?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none',
                background: isTop3 ? 'var(--brand-bg)' : 'transparent',
                borderRadius: isTop3 ? 10 : 6,
                marginBottom: isTop3 ? 4 : 0,
                transition: 'background var(--transition-fast)',
              }}>
                <span style={{ fontSize: isTop3 ? 24 : 18, width: 32, textAlign: 'center', flexShrink: 0 }}>
                  {MEDAL[i + 1] ?? `${i + 1}`}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: isTop3 ? 15 : 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {CATEGORY_LABEL[post.category] ?? ''} · {post.profiles?.nickname ?? '익명'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: isTop3 ? 14 : 12, color: 'var(--brand)', fontWeight: 700 }}>❤ {post.likes_count ?? 0}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>💬 {post.comments_count ?? 0} · 👁 {post.view_count ?? 0}</div>
                </div>
              </Link>
              );
            })
        )}
      </div>

      {/* 지역별 TOP 3 */}
      {REGION_SECTIONS.map(region => {
        const posts = regionPosts[region];
        if (!posts || posts.length === 0) return null;
        return (
          <div key={region} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>📍 {region} TOP 3</h2>
            {posts.map((post: any, i: number) => (
                <Link key={post.id} href={`/feed/${post.slug || post.id}`} className="kd-feed-card" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: i < posts.length - 1 ? '1px solid var(--border)' : 'none', borderRadius: 6, transition: 'background var(--transition-fast)' }}>
                  <span style={{ fontSize: 'var(--fs-xl)', width: 28, textAlign: 'center', flexShrink: 0 }}>
                    {MEDAL[i + 1] ?? `${i + 1}`}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{post.profiles?.nickname ?? '익명'}</div>
                  </div>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--brand)', fontWeight: 700, flexShrink: 0 }}>❤ {post.likes_count ?? 0}</span>
                </Link>
              ))}
          </div>
        );
      })}
    </div>
    </HotClient>
  );
}
