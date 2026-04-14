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
  robots: { index: true, follow: true, 'max-image-preview': 'large' as const, 'max-snippet': -1 as const },
  openGraph: {
    title: '오늘의 HOT',
    description: '실시간 인기 게시글 TOP',
    url: SITE_URL + '/hot',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('오늘의 HOT')}&design=2&category=general`, width: 1200, height: 630, alt: '카더라 HOT' },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('오늘의 HOT')}&category=general`, width: 630, height: 630, alt: '카더라 HOT' },
    ],
  },
  twitter: { card: 'summary_large_image' },
  other: { 'naver:written_time': new Date().toISOString(), 'naver:updated_time': new Date().toISOString(), 'dg:plink': SITE_URL + '/hot', 'naver:author': '카더라', 'og:updated_time': new Date().toISOString(), 'article:section': '커뮤니티', 'article:tag': '인기글,HOT,추천,커뮤니티,주식,부동산' },
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
    {/* SEO 전용 히어로 이미지 — 시각적으로 숨김, 크롤러 인식용 */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>

      {/* ── 헤더 ── */}
      <div style={{ marginBottom: 14 }}>
        <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
          <a href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</a>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>HOT</span>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ position:"absolute", width:1, height:1, overflow:"hidden", clip:"rect(0,0,0,0)" }}>🔥 이번 주 HOT</h1>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              <time dateTime={new Date().toISOString()}>{dateRange}</time> · 좋아요 기준
            </div>
          </div>
          <SectionShareButton section="hot" label="이번 주 HOT 게시글 모음" pagePath="/hot" />
        </div>
      </div>

      {/* ── 이번 주 요약 칩 ── */}
      {(() => {
        const totalLikes = (topPosts ?? []).reduce((s: number, p: any) => s + (p.likes_count ?? 0), 0);
        const totalComments = (topPosts ?? []).reduce((s: number, p: any) => s + (p.comments_count ?? 0), 0);
        const totalViews = (topPosts ?? []).reduce((s: number, p: any) => s + (p.view_count ?? 0), 0);
        return (
          <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-md)', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[
              { label: '게시글', value: (topPosts ?? []).length, unit: '편', max: 10, color: 'var(--brand)', icon: '📝' },
              { label: '좋아요', value: totalLikes, unit: '', max: 100, color: 'var(--accent-red)', icon: '🤍' },
              { label: '댓글', value: totalComments, unit: '', max: 50, color: 'var(--accent-green)', icon: '💬' },
              { label: '조회수', value: totalViews, unit: '', max: 5000, color: 'var(--accent-blue)', icon: '👁' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', flexShrink: 0, textAlign: 'center', minWidth: 60 }}>
                <div style={{ fontSize: 12, marginBottom: 2 }}>{s.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value.toLocaleString()}{s.unit}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{s.label}</div>
                <div style={{ height: 3, borderRadius: 4, background: 'var(--bg-hover)', marginTop: 'var(--sp-xs)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min((s.value / s.max) * 100, 100)}%`, borderRadius: 4, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── 커뮤니티 TOP 5 + 블로그 HOT 5 — 2단 그리드 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10, marginBottom: 14 }} className="mc-g2">

        {/* 커뮤니티 TOP 5 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>💬 커뮤니티 TOP</h2>
          {(topPosts ?? []).length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 12, fontSize: 12 }}>이번 주 데이터가 아직 없어요</p>
          ) : (
            (topPosts ?? []).map((post: any, i: number) => (
              <Link key={post.id} href={`/feed/${post.slug || post.id}`} className="kd-feed-card" style={{
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 0',
                borderBottom: i < (topPosts?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: i < 3 ? 15 : 12, width: 20, textAlign: 'center', flexShrink: 0 }}>
                  {MEDAL[i + 1] ?? `${i + 1}`}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                    {post.profiles?.nickname ?? '익명'} · ❤{post.likes_count ?? 0} · 💬{post.comments_count ?? 0}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* 블로그 HOT 5 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>📰 블로그 HOT</h2>
          {(hotBlogs ?? []).length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 12, fontSize: 12 }}>블로그 데이터 없음</p>
          ) : (
            (hotBlogs ?? []).map((b: any, i: number) => {
              const catLabel: Record<string, string> = { stock: '주식', apt: '청약', unsold: '미분양', finance: '재테크', general: '생활' };
              return (
                <Link key={b.slug} href={`/blog/${b.slug}`} className="kd-feed-card" style={{
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 0', color: 'inherit',
                  borderBottom: i < (hotBlogs?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: i < 3 ? 15 : 12, width: 20, textAlign: 'center', flexShrink: 0 }}>{MEDAL[i + 1] || `${i + 1}`}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      {catLabel[b.category] || b.category} · 👀{b.view_count}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* ── 지역별 HOT (데이터 있는 지역만, 가로 스크롤) ── */}
      {Object.keys(regionPosts).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>📍 지역별 HOT</h2>
          <div className="apt-pill-scroll kd-scroll-row" style={{ display: 'flex', gap: 'var(--sp-sm)', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
            {REGION_SECTIONS.map(region => {
              const posts = regionPosts[region];
              if (!posts || posts.length === 0) return null;
              return (
                <div key={region} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', minWidth: 220, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>📍 {region}</div>
                  {posts.map((post: any, i: number) => (
                    <Link key={post.id} href={`/feed/${post.slug || post.id}`} className="kd-feed-card" style={{
                      textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 0', color: 'inherit',
                      borderBottom: i < posts.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <span style={{ fontSize: 12, width: 18, textAlign: 'center', flexShrink: 0 }}>{MEDAL[i + 1]}</span>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
                      <span style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 700, flexShrink: 0 }}>❤{post.likes_count ?? 0}</span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 하단 CTA ── */}
      <div style={{ textAlign: 'center', padding: '16px 0 32px' }}>
        <Link href="/feed" style={{ display: 'inline-block', padding: 'var(--sp-md) var(--sp-2xl)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          📝 커뮤니티 전체 보기
        </Link>
      </div>

    </article>
    </HotClient>
  );
}
