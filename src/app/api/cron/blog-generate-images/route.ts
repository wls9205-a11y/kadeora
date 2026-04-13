import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 60;

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const BATCH = 50;

const CAT_QUERIES: Record<string, string[]> = {
  stock: [
    'stock market chart', 'trading screen data', 'financial graph analytics',
    'stock exchange building', 'business meeting corporate', 'economy growth chart',
    'investment portfolio', 'cryptocurrency trading', 'market analysis data',
  ],
  apt: [
    'apartment building exterior', 'korean apartment complex', 'residential tower',
    'real estate property', 'modern apartment interior', 'city skyline buildings',
    'house keys real estate', 'apartment balcony view', 'construction crane building',
  ],
  unsold: [
    'empty apartment room', 'new construction building', 'housing development site',
    'vacant building exterior', 'construction site crane', 'real estate sign sale',
  ],
  finance: [
    'money savings coins', 'financial planning calculator', 'tax document papers',
    'investment gold coins', 'budget spreadsheet laptop', 'credit card payment',
  ],
  general: [
    'data analysis laptop', 'information technology', 'community people meeting',
  ],
};

const CAT_LABEL: Record<string, string> = {
  stock: '주식', apt: '부동산', unsold: '미분양', finance: '재테크', general: '정보',
};

async function fetchUnsplash(query: string, count = 15): Promise<{
  url: string; alt: string; caption: string;
}[]> {
  if (!UNSPLASH_KEY) return [];
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
    );
    if (!res.ok) { console.error('[unsplash] API error:', res.status); return []; }
    const data = await res.json();
    return (data.results || []).map((p: any) => ({
      url: `${p.urls.regular}&w=1200&h=630&fit=crop`,
      alt: p.alt_description || p.description || query,
      caption: `Photo by ${p.user.name} on Unsplash`,
    }));
  } catch (e) { console.error('[unsplash]', e); return []; }
}

function makeInfoUrl(title: string, cat: string): string {
  const t = (title || '').slice(0, 45);
  const label = CAT_LABEL[cat] || '정보';
  return `${SITE_URL}/api/og-infographic?title=${encodeURIComponent(t)}&category=${cat}&type=summary&items=${encodeURIComponent(`분류:${label},출처:카더라,업데이트:2026`)}`;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  try {
    const { data: posts } = await sb
      .from('blog_posts')
      .select('id, title, category, sub_category, image_alt')
      .eq('is_published', true)
      .order('view_count', { ascending: false, nullsFirst: false })
      .limit(BATCH * 2);

    if (!posts?.length) return NextResponse.json({ ok: true, processed: 0 });

    const postIds = posts.map(p => p.id);
    const { data: existing } = await (sb as any)
      .from('blog_post_images').select('post_id').in('post_id', postIds);
    const existingIds = new Set((existing || []).map((e: any) => e.post_id));
    const needImages = posts.filter(p => !existingIds.has(p.id)).slice(0, BATCH);

    if (!needImages.length) return NextResponse.json({ ok: true, processed: 0, msg: 'all done' });

    // 카테고리별 + 제목 키워드별 Unsplash 캐시
    const catCache: Record<string, { url: string; alt: string; caption: string }[]> = {};
    const categories = [...new Set(needImages.map(p => p.category || 'general'))];

    for (const cat of categories) {
      const queries = CAT_QUERIES[cat] || CAT_QUERIES.general;
      const q1 = queries[Math.floor(Math.random() * queries.length)];
      const q2 = queries[Math.floor(Math.random() * queries.length)];
      const [imgs1, imgs2] = await Promise.all([fetchUnsplash(q1, 15), fetchUnsplash(q2, 15)]);
      const seen = new Set<string>();
      catCache[cat] = [...imgs1, ...imgs2].filter(img => {
        if (seen.has(img.url)) return false;
        seen.add(img.url); return true;
      });
    }

    // 제목에서 검색 키워드 추출 (한글 명사 2~3개)
    function extractKeywords(title: string, cat: string): string {
      const clean = title.replace(/[|—·()（）\[\]「」『』""'']/g, ' ').replace(/\d{4}년?/g, '');
      const words = clean.split(/\s+/).filter(w => w.length >= 2 && w.length <= 10);
      const catWord = cat === 'apt' ? 'apartment korea' : cat === 'stock' ? 'stock market' : 'finance';
      return `${words.slice(0, 2).join(' ')} ${catWord}`;
    }

    // 각 글에 6장 할당 (Unsplash 4 + infographic 2)
    const inserts: any[] = [];
    const catIdx: Record<string, number> = {};

    for (const post of needImages) {
      const cat = post.category || 'general';
      const cache = catCache[cat] || [];
      if (!catIdx[cat]) catIdx[cat] = 0;
      const label = CAT_LABEL[cat] || '정보';

      // 제목 기반 검색으로 추가 이미지 시도
      let titleImgs: { url: string; alt: string; caption: string }[] = [];
      if (UNSPLASH_KEY) {
        const kw = extractKeywords(post.title, cat);
        titleImgs = await fetchUnsplash(kw, 5);
      }

      // Position 0: 제목 기반 Unsplash (주제 맞춤)
      const img0 = titleImgs[0] || cache[catIdx[cat] % Math.max(cache.length, 1)];
      if (img0) {
        catIdx[cat]++;
        inserts.push({
          post_id: post.id, image_url: img0.url,
          alt_text: post.image_alt || `${post.title} — ${label} 관련 이미지`,
          caption: img0.caption, image_type: 'stock_photo', position: 0,
        });
      }

      // Position 1: 핵심 데이터 인포그래픽
      inserts.push({
        post_id: post.id, image_url: makeInfoUrl(post.title, cat),
        alt_text: `${post.title} — 카더라 ${label} 인포그래픽`,
        caption: `카더라 ${label} 데이터 분석`, image_type: 'infographic', position: 1,
      });

      // Position 2: 제목 기반 Unsplash 두 번째
      const img2 = titleImgs[1] || cache[catIdx[cat] % Math.max(cache.length, 1)];
      if (img2) {
        catIdx[cat]++;
        inserts.push({
          post_id: post.id, image_url: img2.url,
          alt_text: `${post.title} — ${label} 추가 이미지`,
          caption: img2.caption, image_type: 'stock_photo', position: 2,
        });
      }

      // Position 3: 카테고리 기반 Unsplash (다양성)
      if (cache.length > 0) {
        const img3 = cache[catIdx[cat] % cache.length];
        catIdx[cat]++;
        inserts.push({
          post_id: post.id, image_url: img3.url,
          alt_text: `${post.title} — ${label} 관련`,
          caption: img3.caption, image_type: 'stock_photo', position: 3,
        });
      }

      // Position 4: 비교 인포그래픽
      const infoUrl2 = `${SITE_URL}/api/og-infographic?title=${encodeURIComponent((post.title || '').slice(0, 30) + ' 비교')}&category=${cat}&type=comparison&items=${encodeURIComponent(`분류:${label},출처:카더라`)}`;
      inserts.push({
        post_id: post.id, image_url: infoUrl2,
        alt_text: `${post.title} — 비교 분석 인포그래픽`,
        caption: `카더라 ${label} 비교 분석`, image_type: 'infographic', position: 4,
      });

      // Position 5: 네 번째 Unsplash (다양성)
      const img5 = titleImgs[2] || (cache.length > 0 ? cache[catIdx[cat] % cache.length] : null);
      if (img5) {
        catIdx[cat]++;
        inserts.push({
          post_id: post.id, image_url: img5.url,
          alt_text: `${post.title} — ${label} 참고 이미지`,
          caption: img5.caption, image_type: 'stock_photo', position: 5,
        });
      }
    }

    if (inserts.length > 0) {
      const { error } = await (sb as any)
        .from('blog_post_images')
        .upsert(inserts, { onConflict: 'post_id,position', ignoreDuplicates: true });
      if (error) console.error('[blog-generate-images] upsert error:', error);
    }

    return NextResponse.json({
      ok: true, processed: needImages.length, inserted: inserts.length,
      cache_sizes: Object.fromEntries(Object.entries(catCache).map(([k, v]) => [k, v.length])),
    });
  } catch (err: any) {
    console.error('[blog-generate-images]', err);
    return NextResponse.json({ ok: true, error: err.message }, { status: 200 });
  }
}
