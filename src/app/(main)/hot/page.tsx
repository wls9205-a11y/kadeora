import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase-server';
import HotClient from './HotClient';

export const metadata: Metadata = {
  title: '오늘의 HOT',
  description: '오늘 가장 인기있는 카더라 게시글',
};

export const dynamic = 'force-dynamic';

const MEDAL: Record<number, { emoji: string; color: string }> = {
  1: { emoji: '🥇', color: '#FFD700' },
  2: { emoji: '🥈', color: '#C0C0C0' },
  3: { emoji: '🥉', color: '#CD7F32' },
};

const CATEGORY_LABEL: Record<string, string> = {
  stock: '📈 주식', apt: '🏠 부동산', local: '🏘 우리동네', free: '💬 자유',
};

const REGION_SECTIONS = ['서울', '부산', '경기', '인천'];

export default async function HotPage() {
  const sb = await createSupabaseServer();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let { data: topPosts } = await sb
    .from('posts')
    .select('id,title,category,likes_count,region_id,author_id,profiles!posts_author_id_fkey(nickname)')
    .eq('is_deleted', false)
    .gte('created_at', weekAgo)
    .order('likes_count', { ascending: false })
    .limit(5);

  // 7일 데이터 없으면 30일로 fallback
  if (!topPosts || topPosts.length === 0) {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await sb.from('posts')
      .select('id,title,category,likes_count,region_id,author_id,profiles!posts_author_id_fkey(nickname)')
      .eq('is_deleted', false).gte('created_at', monthAgo)
      .order('likes_count', { ascending: false }).limit(5);
    topPosts = data;
  }

  const regionPosts: Record<string, any[]> = {};
  for (const region of REGION_SECTIONS) {
    const { data } = await sb
      .from('posts')
      .select('id,title,category,likes_count,profiles!posts_author_id_fkey(nickname)')
      .eq('is_deleted', false)
      .eq('region_id', region)
      .gte('created_at', weekAgo)
      .order('likes_count', { ascending: false })
      .limit(3);
    if (data && data.length > 0) regionPosts[region] = data;
  }

  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRange = `${weekStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~ ${now.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`;

  return (
    <HotClient>
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>⚡ 오늘의 HOT 게시글</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>{dateRange}</p>
      </div>

      {/* 전국 TOP 5 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>전국 TOP 5</h2>
        {(topPosts ?? []).length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>이번 주 데이터가 아직 없어요</p>
        ) : (
          (topPosts ?? []).map((post: any, i: number) => {
            const medal = MEDAL[i + 1];
            return (
              <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < (topPosts?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: medal ? 20 : 14, fontWeight: 700, color: medal?.color ?? 'var(--text-tertiary)', width: 28, textAlign: 'center', flexShrink: 0 }}>
                  {medal?.emoji ?? `${i + 1}`}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {CATEGORY_LABEL[post.category] ?? ''} · {(post.profiles as any)?.nickname ?? '익명'}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 700, flexShrink: 0 }}>❤ {post.likes_count ?? 0}</span>
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
            <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>📍 {region} TOP 3</h2>
            {posts.map((post: any, i: number) => {
              const medal = MEDAL[i + 1];
              return (
                <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < posts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: medal ? 18 : 14, fontWeight: 700, color: medal?.color ?? 'var(--text-tertiary)', width: 28, textAlign: 'center', flexShrink: 0 }}>
                    {medal?.emoji ?? `${i + 1}`}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{(post.profiles as any)?.nickname ?? '익명'}</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 700, flexShrink: 0 }}>❤ {post.likes_count ?? 0}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
    </HotClient>
  );
}
