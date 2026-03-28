import { SITE_URL } from '@/lib/constants';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase-server';
import HotClient from './HotClient';
import SectionShareButton from '@/components/SectionShareButton';

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
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('오늘의 HOT')}&design=2&category=general`, width: 1200, height: 630, alt: '카더라 HOT' }],
  },
  twitter: { card: 'summary_large_image' },
  other: { 'naver:written_time': '2026-01-15T00:00:00Z', 'naver:updated_time': new Date().toISOString(), 'dg:plink': SITE_URL + '/hot', 'naver:author': '카더라', 'og:updated_time': new Date().toISOString() },
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
  let hotBlogs: any[] | null = null;
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
    topPosts = (topResult as { data: any })?.data ?? null;

    if (!topPosts || topPosts.length === 0) {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const fallback = await withTimeout(
        sb.from('posts')
          .select('id,title,slug,category,likes_count,comments_count,view_count,region_id,author_id,profiles!posts_author_id_fkey(nickname)')
          .eq('is_deleted', false).gte('created_at', monthAgo)
          .order('likes_count', { ascending: false }).limit(5)
      );
      topPosts = (fallback as { data: any })?.data ?? null;
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
      const data = r.status === 'fulfilled' ? (r.value as { data: any })?.data : null;
      if (data && data.length > 0) regionPosts[region] = data;
    });
    // 블로그 HOT 5
    const blogResult = await withTimeout(
      sb.from('blog_posts')
        .select('slug, title, category, view_count')
        .eq('is_published', true)
        .gte('created_at', weekAgo)
        .order('view_count', { ascending: false })
        .limit(5)
    );
    hotBlogs = (blogResult as { data: any })?.data ?? null;
  } catch { }

  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRange = `${weekStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~ ${now.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`;

  return (
    <HotClient>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"홈","item":SITE_URL},{"@type":"ListItem","position":2,"name":"HOT 게시글","item":SITE_URL + "/hot"}]}) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"HOT 게시글은 어떤 기준으로 선정되나요?","acceptedAnswer":{"@type":"Answer","text":"카더라 HOT 게시글은 최근 7일간 좋아요, 댓글, 조회수를 종합하여 가장 인기 있는 글을 자동으로 선정합니다."}},{"@type":"Question","name":"카더라 커뮤니티에서 어떤 글을 쓸 수 있나요?","acceptedAnswer":{"@type":"Answer","text":"주식 종목 분석, 부동산 청약 후기, 재테크 정보, 자유 토론 등 투자와 관련된 다양한 주제의 글을 자유롭게 작성할 수 있습니다."}}]}) }} />
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
            <a href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</a>
            <span>›</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>HOT</span>
          </nav>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/og?title=${encodeURIComponent('이번 주 HOT 게시글')}&design=2&category=free&subtitle=${encodeURIComponent('카더라 커뮤니티 인기글 TOP')}`} alt="카더라 이번 주 HOT 인기 게시글 — 주식 부동산 커뮤니티" width={1200} height={630} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 10, marginBottom: 12, border: '1px solid var(--border)' }} loading="eager" />
          <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>🔥 HOT 게시글</h1>
          <time dateTime={new Date().toISOString()} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date().toLocaleDateString('ko-KR')} 기준</time>
          <SectionShareButton section="hot" label="이번 주 HOT 게시글 모음" pagePath="/hot" />
        </div>
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
      {/* 블로그 HOT 5 */}
      {(hotBlogs ?? []).length > 0 && (
        <div style={{ marginTop: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px' }}>📰 블로그 HOT 5</h2>
          {(hotBlogs ?? []).map((b: any, i: number) => {
            const catLabel: Record<string, string> = { stock: '주식', apt: '청약', unsold: '미분양', finance: '재테크', general: '생활' };
            return (
              <Link key={b.slug} href={`/blog/${b.slug}`} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
                borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit',
              }}>
                <span style={{ fontSize: 16, minWidth: 24, textAlign: 'center' }}>{MEDAL[i + 1] || `${i + 1}`}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {catLabel[b.category] || b.category} · 👀 {b.view_count}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </article>
    </HotClient>
  );
}
