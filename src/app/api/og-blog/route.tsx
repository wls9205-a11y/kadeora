import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import { sanitizeForOG } from '@/lib/og-sanitize';
import { barColor, titleLines, BRAND_BG_SOLID, GOLD } from '@/lib/og/brand';
import { BrandCard } from '@/lib/og/frame';

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

/**
 * 카드 2~6 배경. 본문 갤러리용이라 T1 범위 밖이다(§3.1, §6.8) — 건드리지 않는다.
 * ⚠️ 카드 1(커버)과 폴백은 §1 브랜드 서피스를 «자기가» 칠한다. 여기로 오지 않는다.
 */
function bgFor(card: number, post: BlogRow | null): string {
  if (card === 6) return '#FAC775'; // CTA amber — 카드 6 은 T1 범위 밖(§6.8)
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
  if (typeof v !== 'string') return fallback;
  return sanitizeForOG(v) || fallback;
}

/**
 * T1 §1 — 커버(카드 1). 목록·검색 썸네일이라 네이버에서 ~120px 로 축소돼 뜬다.
 *
 * ⚠️ 제목 원문을 sanitizeForOG 로 먼저 씻지 말 것.
 *    sanitizeForOG 는 U+2014 em dash 를 ASCII '-' 로 바꾸는데, §2 의 절단 문자에서
 *    '-' 는 «일부러» 빠져 있다(범천1-1, 반여3-1 이 잘려서). 씻고 넣으면 절단이
 *    통째로 안 먹는다. 원문 → titleLines → 줄 단위 sanitize 순서를 지킨다.
 *    titleLines 자체 화이트리스트가 이미 한글/영숫자/·/-/공백만 남기므로 안전하다.
 */
function renderCover(post: BlogRow): React.ReactElement {
  const raw = (typeof post.title === 'string' && post.title.trim())
    ? post.title
    : (typeof post.slug === 'string' ? post.slug : '');
  const lines = titleLines(raw).map((l) => sanitizeForOG(l) || l);
  const bar = barColor({
    category: post.category,
    subCategory: post.sub_category,
    cronType: post.cron_type,
    title: raw,
  });
  return <BrandCard lines={lines} frame={SIDE} bar={bar} />;
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
      <div style={{ display:'flex', fontSize: 22, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 2 }}>{sectionTitle.toUpperCase()}</div>
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
                <div style={{ display:'flex', fontSize: 26, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.4, letterSpacing: -0.5 }}>{text.slice(0, 90)}</div>
              </div>
            );
          })
        ) : (
          <div style={{ display:'flex', fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{tldrSrc ? tldrSrc.slice(0, 200) : '본문에서 자세히 확인하세요.'}</div>
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
      <div style={{ display:'flex', fontSize: 22, color: 'rgba(26,26,24,0.55)', fontWeight: 800, letterSpacing: 2 }}>NEXT · 더 알아보기</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display:'flex', width: 56, height: 4, background: '#1A1A18' }} />
        <div style={{ display:'flex', fontSize: 32, fontWeight: 700, color: 'rgba(26,26,24,0.66)', letterSpacing: -0.5 }}>{headline}</div>
        <div style={{ display:'flex', fontSize: target.length > 14 ? 56 : 72, fontWeight: 900, color: '#1A1A18', letterSpacing: -2.5, lineHeight: 1.05 }}>{target.slice(0, 24)}</div>
        <div style={{ display:'flex', fontSize: 22, color: 'rgba(26,26,24,0.66)', fontWeight: 700 }}>{ctaUrl}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display:'flex', background: '#1A1A18', color: '#FAC775', fontSize: 26, fontWeight: 900, padding: '14px 28px', borderRadius: 999, letterSpacing: -0.5 }}>{buttonLabel}</div>
        <div style={{ display:'flex', fontSize: 18, color: '#1A1A18', fontWeight: 800 }}>kadeora.app</div>
      </div>
    </div>
  );
}

/** 글을 못 찾았을 때. 커버 자리에 그대로 노출되므로 §1 규격을 따른다. */
function renderFallback(slug: string | null): React.ReactElement {
  const lines = titleLines(slug).map((l) => sanitizeForOG(l) || l);
  return <BrandCard lines={lines} frame={SIDE} bar={barColor({ title: slug })} />;
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

  // s241 W2/W3: body 구성 + ImageResponse 분리 — render fn throw vs ImageResponse throw 식별.
  let body: React.ReactElement;
  try {
    if (!post) {
      body = renderFallback(slug);
    } else if (card === 1) {
      body = renderCover(post);
    } else if (card === 6) {
      body = renderCta(post);
    } else {
      body = renderKeyPoints(post, card);
    }
  } catch (renderErr) {
    console.error('[og-blog] render-fn-throw card=', card, 'msg=', (renderErr as Error)?.message?.slice(0, 80));
    console.error('[og-blog] render-fn-throw cls=', (renderErr as Error)?.constructor?.name);
    body = renderFallback(slug);
  }

  try {
    // §1: 커버(카드 1)와 폴백은 BrandCard 가 자기 배경을 칠한다. 여기서 덧칠하면
    // 브랜드 네이비 위에 옛 단색이 깔려 그라디언트가 죽는다.
    const isBrandSurface = !post || card === 1;
    const wrapped = (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: ff,
          ...(isBrandSurface ? { background: BRAND_BG_SOLID } : { background: bgFor(card, post) }),
        }}
      >
        {body}
      </div>
    );

    const img = new ImageResponse(wrapped, {
      width: SIDE,
      height: SIDE,
      ...fontOpts,
    });
    return new Response(await img.arrayBuffer(), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-OG-Card': String(card),
        // 헤더는 ByteString(0-255)만 허용 — 한글 슬러그를 그대로 넣으면 throw → catch → fallback.
        // encodeURIComponent 로 ASCII 화 (이미지 본문의 한글은 정상, 헤더만 인코딩).
        'X-OG-Slug': encodeURIComponent(slug || 'fallback'),
      },
    });
  } catch (err) {
    // s239-p1: console.error 분할 (Vercel log 1 row 길이 제한 — 단일 호출 시 stack 잘림)
    // s240 W2: chunk 분할 강화 (80자) — MCP truncate 우회
    const e = err as Error;
    const msg = e?.message ?? '';
    const stk = e?.stack ?? '';
    const cls = e?.constructor?.name ?? '';
    const code = (err as any)?.code ?? '';
    const inp = JSON.stringify({ slug, card, fontLoaded: !!fontData, hasPost: !!post, postCategory: post?.category, titleLen: post?.title?.length });
    console.error('[og-blog] cls=', cls, 'code=', code);
    for (let i = 0; i < msg.length; i += 80) console.error('[og-blog] m' + (i / 80) + '=', msg.slice(i, i + 80));
    for (let i = 0; i < Math.min(stk.length, 480); i += 80) console.error('[og-blog] s' + (i / 80) + '=', stk.slice(i, i + 80));
    for (let i = 0; i < inp.length; i += 80) console.error('[og-blog] i' + (i / 80) + '=', inp.slice(i, i + 80));
    // s263 Phase 2.1++: redirect 302 제거. catch 안에서 폰트/한글 의존성 없는 simple
    // ImageResponse 반환 (로고 + KADEORA 영문) — 카카오/네이버 미리보기에 무엇이라도 표시 보장.
    try {
      const fbImg = new ImageResponse(
        (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: BRAND_BG_SOLID, color: '#fff', fontFamily: 'sans-serif' }}>
            <div style={{ display:'flex', fontSize: 28, color: GOLD, letterSpacing: 4, marginBottom: 16, fontWeight: 900 }}>KADEORA</div>
            <div style={{ display:'flex', fontSize: 56, fontWeight: 900, letterSpacing: -1 }}>blog</div>
          </div>
        ),
        { width: SIDE, height: SIDE },
      );
      return new Response(await fbImg.arrayBuffer(), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900', 'X-OG-Fallback': '1' },
      });
    } catch {
      return Response.redirect(`${SITE_URL}/images/brand/kadeora-hero.png`, 302);
    }
  }
}
