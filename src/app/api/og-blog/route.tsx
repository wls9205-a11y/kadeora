import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

let _fontCache: ArrayBuffer | null = null;
function loadFont(): ArrayBuffer | null {
  if (_fontCache) return _fontCache;
  try {
    const buf = readFileSync(join(process.cwd(), 'public/fonts/NotoSansKR-Bold.woff'));
    _fontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return _fontCache;
  } catch { return null; }
}

const SIDE = 630;

const CATEGORY_LABEL: Record<string, string> = {
  apt: '부동산',
  stock: '주식',
  unsold: '미분양',
  finance: '재테크',
  general: '뉴스',
};

interface BlogRow {
  slug: string;
  title: string;
  category?: string | null;
  sub_category?: string | null;
  cron_type?: string | null;
  excerpt?: string | null;
  tldr?: string | null;
  key_points?: any;
  tags?: string[] | null;
  cover_image?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  hub_cta_target?: string | null;
  hub_apt_slug?: string | null;
  view_count?: number | null;
  reading_minutes?: number | null;
  data_date?: string | null;
  meta_description?: string | null;
}

async function fetchPost(slug: string): Promise<BlogRow | null> {
  try {
    const sb = getSupabaseAdmin();
    const cols = 'slug,title,category,sub_category,cron_type,excerpt,tldr,key_points,tags,cover_image,published_at,created_at,hub_cta_target,hub_apt_slug,view_count,reading_minutes,data_date,meta_description';
    const { data } = await (sb as any).from('blog_posts').select(cols).eq('slug', slug).eq('is_published', true).maybeSingle();
    if (!data) return null;
    // 정규화 — title/excerpt/tldr 등이 null 인 row 가 존재. 렌더러에서 .length / .slice 직접 접근하므로 string 강제.
    const row = data as BlogRow;
    return {
      ...row,
      title: typeof row.title === 'string' && row.title ? row.title : (row.slug || '카더라 콘텐츠'),
      excerpt: typeof row.excerpt === 'string' ? row.excerpt : null,
      tldr: typeof row.tldr === 'string' ? row.tldr : null,
      meta_description: typeof row.meta_description === 'string' ? row.meta_description : null,
      hub_cta_target: typeof row.hub_cta_target === 'string' ? row.hub_cta_target : null,
      hub_apt_slug: typeof row.hub_apt_slug === 'string' ? row.hub_apt_slug : null,
    } as BlogRow;
  } catch { return null; }
}

function bgFor(card: number, post: BlogRow | null): string {
  if (card === 6) return '#FAC775'; // CTA amber
  if (card === 1) return '#1A1A18';
  const cat = post?.category;
  if (card === 2) {
    if (cat === 'apt') return '#085041';
    if (cat === 'stock') return '#0C447C';
    if (cat === 'unsold') return '#854F0B';
    return '#3C3489';
  }
  if (card === 3) return '#0F6E56';
  if (card === 4) return '#791F1F';
  if (card === 5) return '#0C447C';
  return '#2C2C2A';
}

// ── 안전한 string/array 접근 헬퍼 (각 render fn 내부 가드용) ─────────────
function safeStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function fmtDate(s?: string | null): string {
  const v = safeStr(s);
  return v ? v.slice(0, 10) : '';
}

function renderCover(post: BlogRow): React.ReactElement {
  const title = safeStr(post.title) || safeStr(post.slug) || '카더라 콘텐츠';
  const cat = CATEGORY_LABEL[safeStr(post.category)] || '카더라';
  const sub = safeStr(post.sub_category);
  const titleFS = title.length > 30 ? 36 : title.length > 22 ? 44 : title.length > 14 ? 56 : 68;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 56 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ background: '#FAC775', color: '#1A1A18', fontSize: 22, fontWeight: 800, padding: '6px 16px', borderRadius: 999 }}>{cat}</div>
        {sub && <div style={{ background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', fontSize: 22, fontWeight: 700, padding: '6px 16px', borderRadius: 999 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 56, height: 4, background: '#FAC775' }} />
        <div style={{ fontSize: titleFS, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.15, letterSpacing: -1.5 }}>{title}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 18, fontWeight: 700 }}>
        <span>카더라 · {fmtDate(post.published_at || post.created_at)}</span>
        <span>kadeora.app</span>
      </div>
    </div>
  );
}

function renderKeyPoints(post: BlogRow, card: number): React.ReactElement {
  const title = safeStr(post.title) || safeStr(post.slug) || '카더라';
  const points: unknown[] = Array.isArray(post.key_points) ? post.key_points : [];
  const tldrSrc = safeStr(post.tldr) || safeStr(post.excerpt) || safeStr(post.meta_description);
  const titleByCard: Record<number, string> = { 2: '핵심 포인트', 3: '데이터·분석', 4: '시점·일정', 5: '비교·결론' };
  const sectionTitle = titleByCard[card] || '핵심';
  const startIdx = Math.max(0, (card - 2) * 2);
  const sliceArr = points.slice(startIdx, startIdx + 2);

  // key_points 가 비어있거나 현재 카드 인덱스 범위 초과면 tldr 풀텍스트로 graceful fallback.
  const useTldr = sliceArr.length === 0;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 56, justifyContent: 'space-between' }}>
      <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 2 }}>{sectionTitle.toUpperCase()}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!useTldr ? (
          sliceArr.map((kp: any, i: number) => {
            // kp 가 string / { text } / { point } / 그 외 어떤 모양이어도 throw 없이 string 도출.
            let text = '';
            if (typeof kp === 'string') text = kp;
            else if (kp && typeof kp === 'object') text = safeStr((kp as any).text) || safeStr((kp as any).point) || '';
            if (!text) text = '본문에서 자세히 확인하세요.';
            const num = startIdx + i + 1;
            return (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: '#FAC775', color: '#1A1A18', fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{num}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.4, letterSpacing: -0.5 }}>{text.slice(0, 90)}</div>
              </div>
            );
          })
        ) : (
          <div style={{ fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{tldrSrc ? tldrSrc.slice(0, 200) : '본문에서 자세히 확인하세요.'}</div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 16, fontWeight: 700 }}>
        <span>{title.slice(0, 28)}{title.length > 28 ? '...' : ''}</span>
        <span>kadeora.app</span>
      </div>
    </div>
  );
}

function renderCta(post: BlogRow): React.ReactElement {
  const slug = safeStr(post.hub_apt_slug);
  const postSlug = safeStr(post.slug);
  const hasTarget = !!safeStr(post.hub_cta_target);
  // hub_cta_target/hub_apt_slug 가 둘 다 없으면 generic CTA, 본문 슬러그가 있으면 /blog/{slug}, 그것도 없으면 /feed.
  const target = hasTarget ? safeStr(post.hub_cta_target) : '카더라에서 더 보기';
  const headline = hasTarget ? '이 글에서 다룬 단지' : '관련 글 더 보기';
  const ctaUrl = slug
    ? `kadeora.app/apt/${slug}`
    : postSlug
      ? `kadeora.app/blog/${postSlug}`
      : 'kadeora.app/feed';
  const buttonLabel = slug ? '단지 페이지로 →' : (hasTarget ? '더 알아보기 →' : '카더라 둘러보기 →');
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 56, justifyContent: 'space-between' }}>
      <div style={{ fontSize: 22, color: 'rgba(26,26,24,0.55)', fontWeight: 800, letterSpacing: 2 }}>NEXT · 더 알아보기</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ width: 56, height: 4, background: '#1A1A18' }} />
        <div style={{ fontSize: 32, fontWeight: 700, color: 'rgba(26,26,24,0.66)', letterSpacing: -0.5 }}>{headline}</div>
        <div style={{ fontSize: target.length > 14 ? 56 : 72, fontWeight: 900, color: '#1A1A18', letterSpacing: -2.5, lineHeight: 1.05 }}>{target.slice(0, 24)}</div>
        <div style={{ fontSize: 22, color: 'rgba(26,26,24,0.66)', fontWeight: 700 }}>{ctaUrl}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ background: '#1A1A18', color: '#FAC775', fontSize: 26, fontWeight: 900, padding: '14px 28px', borderRadius: 999, letterSpacing: -0.5 }}>{buttonLabel}</div>
        <div style={{ fontSize: 18, color: '#1A1A18', fontWeight: 800 }}>kadeora.app</div>
      </div>
    </div>
  );
}

function renderFallback(slug: string | null): React.ReactElement {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 56, justifyContent: 'space-between', background: '#1A1A18' }}>
      <div style={{ fontSize: 22, color: '#FAC775', fontWeight: 800 }}>카더라 블로그</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 56, height: 4, background: '#FAC775' }} />
        <div style={{ fontSize: 64, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: -2 }}>{slug ? slug : '카더라 콘텐츠'}</div>
      </div>
      <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>kadeora.app · 주식·부동산·재테크</div>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const slug = sp.get('slug')?.trim().slice(0, 200) || null;
  const cardRaw = parseInt(sp.get('card') || '1', 10);
  const card = Math.min(6, Math.max(1, isNaN(cardRaw) ? 1 : cardRaw));

  const fontData = loadFont();
  const fontOpts = fontData
    ? { fonts: [{ name: 'NotoSansKR', data: fontData, style: 'normal' as const, weight: 700 as const }] }
    : {};
  const ff = fontData ? 'NotoSansKR, sans-serif' : 'sans-serif';

  let post: BlogRow | null = null;
  try {
    if (slug) post = await fetchPost(slug);
  } catch (err) {
    console.error('[og-blog] fetchPost error:', err);
    post = null;
  }

  // body 구성 + ImageResponse 모두 단일 try 로 감싸서 어떤 필드 접근 throw 가 일어나도 fallback redirect 로 우아하게 다운그레이드.
  try {
    let body: React.ReactElement;
    if (!post) {
      body = renderFallback(slug);
    } else if (card === 1) {
      body = renderCover(post);
    } else if (card === 6) {
      body = renderCta(post);
    } else {
      body = renderKeyPoints(post, card);
    }

    const wrapped = (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: bgFor(card, post), fontFamily: ff }}>
        {body}
      </div>
    );

    const img = new ImageResponse(wrapped, {
      width: SIDE,
      height: SIDE,
      emoji: 'twemoji',
      ...fontOpts,
    });
    return new Response(await img.arrayBuffer(), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-OG-Card': String(card),
        'X-OG-Slug': slug || 'fallback',
      },
    });
  } catch (err) {
    // s239-p1: console.error 분할 (Vercel log 1 row 길이 제한 — 단일 호출 시 stack 잘림)
    const e = err as Error;
    console.error('[og-blog] message=', e?.message);
    console.error('[og-blog] stack=', e?.stack);
    console.error('[og-blog] class=', e?.constructor?.name);
    console.error('[og-blog] code=', (err as any)?.code);
    console.error('[og-blog] input=', JSON.stringify({ slug, card, fontLoaded: !!fontData, hasPost: !!post, postCategory: post?.category, titleLen: post?.title?.length }));
    return Response.redirect('https://kadeora.app/images/brand/kadeora-hero.png', 302);
  }
}
