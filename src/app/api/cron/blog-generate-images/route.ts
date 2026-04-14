import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import { withCronAuth } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const BATCH = 200;

const CAT_QUERIES: Record<string, string[]> = {
  stock: ['주식 차트 분석', '증권 거래소', '경제 성장 그래프', '투자 포트폴리오', '금융 데이터'],
  apt: ['아파트 단지 조감도', '신축 아파트 외관', '아파트 모델하우스', '부동산 분양 현장', '아파트 인테리어'],
  unsold: ['미분양 아파트', '신축 빈 아파트', '건설 현장 크레인', '분양 모델하우스'],
  finance: ['재테크 저축', '세금 신고 서류', '투자 금화', '가계부 예산 관리'],
  economy: ['경제 지표 그래프', 'GDP 성장률', '물가 상승', '경제 전망 분석'],
  tax: ['세금 계산기', '연말정산 서류', '종합소득세', '세무 상담'],
  life: ['생활 정보', '공공서비스 안내', '주민센터', '생활비 절약'],
  general: ['데이터 분석 노트북', '정보 기술', '커뮤니티 미팅'],
};

const CAT_LABEL: Record<string, string> = {
  stock: '주식', apt: '부동산', unsold: '미분양', finance: '재테크',
  economy: '경제', tax: '세금', life: '생활', general: '정보',
};

async function fetchNaverImages(query: string, count = 10): Promise<{
  url: string; alt: string; caption: string;
}[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${count}&sort=sim&filter=large`,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || [])
      .filter((item: any) => {
        const w = parseInt(item.sizewidth || '0');
        const h = parseInt(item.sizeheight || '0');
        return w >= 400 && h >= 250;
      })
      .map((item: any) => ({
        url: item.link || '',
        alt: (item.title || query).replace(/<[^>]*>/g, ''),
        caption: `출처: ${(() => { try { return new URL(item.link || '').hostname; } catch { return '웹'; } })()}`,
      }));
  } catch { return []; }
}

function extractKeywords(title: string, cat: string): string {
  const clean = title.replace(/[|—·()（）\[\]「」『』""'']/g, ' ').replace(/\d{4}년?/g, '');
  const words = clean.split(/\s+/).filter(w => w.length >= 2 && w.length <= 10);
  const catWord = CAT_LABEL[cat] || '정보';
  return `${words.slice(0, 3).join(' ')} ${catWord}`;
}

async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.json({ ok: true, processed: 0, error: 'NAVER API keys not set' }, { status: 200 });
  }

  try {
    // OG 커버인 글 우선 조회 (실사진이 필요한 글)
    const { data: posts } = await sb
      .from('blog_posts')
      .select('id, title, category, sub_category, image_alt, cover_image')
      .eq('is_published', true)
      .like('cover_image', '%/api/og?%')
      .order('created_at', { ascending: false })
      .limit(BATCH);

    if (!posts?.length) return NextResponse.json({ ok: true, processed: 0, msg: 'all covers are real images' });

    console.log(`[blog-generate-images] ${posts.length}건 OG 커버 → 실사진 교체 시작`);

    // 카테고리별 네이버 이미지 캐시
    const catCache: Record<string, { url: string; alt: string; caption: string }[]> = {};
    const categories: string[] = Array.from(new Set(posts.map((p: any) => String(p.category || 'general'))));

    for (const cat of categories) {
      const queries = CAT_QUERIES[cat as string] || CAT_QUERIES.general;
      const q1 = queries[Math.floor(Math.random() * queries.length)];
      const q2 = queries[Math.floor(Math.random() * queries.length)];
      const [imgs1, imgs2] = await Promise.all([fetchNaverImages(q1, 10), fetchNaverImages(q2, 10)]);
      const seen = new Set<string>();
      catCache[cat] = [...imgs1, ...imgs2].filter(img => {
        if (seen.has(img.url)) return false;
        seen.add(img.url); return true;
      });
      await new Promise(r => setTimeout(r, 100));
    }

    const inserts: any[] = [];
    const catIdx: Record<string, number> = {};

    for (const post of posts) {
      const cat = post.category || 'general';
      const cache = catCache[cat] || [];
      if (!catIdx[cat]) catIdx[cat] = 0;
      const label = CAT_LABEL[cat] || '정보';

      // 제목 기반 검색
      let titleImgs: { url: string; alt: string; caption: string }[] = [];
      const kw = extractKeywords(post.title, cat);
      titleImgs = await fetchNaverImages(kw, 5);
      await new Promise(r => setTimeout(r, 50));

      // Position 0: 제목 기반 (썸네일 후보)
      const img0 = titleImgs[0] || (cache.length > 0 ? cache[catIdx[cat] % cache.length] : null);
      if (img0) {
        catIdx[cat]++;
        inserts.push({
          post_id: post.id, image_url: img0.url,
          alt_text: post.image_alt || `${post.title} — ${label} 관련 이미지`,
          caption: img0.caption, image_type: 'stock_photo', position: 0,
        });
      }

      // Position 1: OG 인포그래픽
      inserts.push({
        post_id: post.id,
        image_url: `${SITE_URL}/api/og?title=${encodeURIComponent((post.title || '').slice(0, 40))}&category=${cat}&author=${encodeURIComponent('카더라 ' + label + '팀')}&design=${1 + Math.floor(Math.random() * 6)}`,
        alt_text: `${post.title} — 카더라 ${label} 인포그래픽`,
        caption: `카더라 ${label} 데이터 분석`, image_type: 'infographic', position: 1,
      });

      // Position 2: 제목 기반 두 번째
      const img2 = titleImgs[1] || (cache.length > 0 ? cache[catIdx[cat] % cache.length] : null);
      if (img2) {
        catIdx[cat]++;
        inserts.push({
          post_id: post.id, image_url: img2.url,
          alt_text: `${post.title} — ${label} 추가 이미지`,
          caption: img2.caption, image_type: 'stock_photo', position: 2,
        });
      }

      // Position 3: 카테고리 기반 (다양성)
      if (cache.length > 0) {
        const img3 = cache[catIdx[cat] % cache.length];
        catIdx[cat]++;
        inserts.push({
          post_id: post.id, image_url: img3.url,
          alt_text: `${post.title} — ${label} 관련`,
          caption: img3.caption, image_type: 'stock_photo', position: 3,
        });
      }

      // Position 4: OG 비교 인포그래픽
      inserts.push({
        post_id: post.id,
        image_url: `${SITE_URL}/api/og?title=${encodeURIComponent((post.title || '').slice(0, 35) + ' 비교분석')}&category=${cat}&author=${encodeURIComponent('카더라')}&design=${1 + Math.floor(Math.random() * 6)}`,
        alt_text: `${post.title} — 비교 분석 인포그래픽`,
        caption: `카더라 ${label} 비교 분석`, image_type: 'infographic', position: 4,
      });

      // Position 5: 네 번째 이미지
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

      // cover_image 업데이트 — OG 텍스트 배너 → 실사진 (position 0에 실사진이 있으면)
      const coverUpdates = inserts.filter(i => i.position === 0 && !i.image_url.includes('/api/og'));
      for (const cu of coverUpdates) {
        await sb.from('blog_posts')
          .update({ cover_image: cu.image_url })
          .eq('id', cu.post_id)
          .like('cover_image', '%/api/og?%');
      }
    }

    // 커버 백필: 이미 이미지가 있지만 OG 커버인 글 → position 0 실사진으로 교체 (매 실행 50건)
    try {
      const { data: ogCovers } = await sb.from('blog_posts')
        .select('id').eq('is_published', true)
        .like('cover_image', '%/api/og?%')
        .order('view_count', { ascending: false })
        .limit(50);
      if (ogCovers?.length) {
        const ogIds = ogCovers.map((p: any) => p.id);
        const { data: pos0 } = await (sb as any).from('blog_post_images')
          .select('post_id, image_url').in('post_id', ogIds).eq('position', 0)
          .not('image_url', 'like', '%/api/og%');
        for (const img of (pos0 || [])) {
          await sb.from('blog_posts').update({ cover_image: img.image_url }).eq('id', img.post_id);
        }
        if (pos0?.length) console.log(`[blog-generate-images] cover backfill: ${pos0.length}건 교체`);
      }
    } catch {}

    return NextResponse.json({
      ok: true, processed: posts.length, inserted: inserts.length,
      cache_sizes: Object.fromEntries(Object.entries(catCache).map(([k, v]) => [k, v.length])),
    });
  } catch (err: any) {
    console.error('[blog-generate-images]', err);
    return NextResponse.json({ ok: true, error: err.message }, { status: 200 });
  }
}

export const GET = withCronAuth(handler);
