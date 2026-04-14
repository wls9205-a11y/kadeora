import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 120;

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const BATCH = 40;

const CAT_QUERIES: Record<string, string[]> = {
  stock: ['주식 차트 분석','증권 거래소','코스피 시장','투자 포트폴리오','금융 데이터 그래프','경제 성장 그래프','주식 투자 전략'],
  apt: ['아파트 조감도','신축 아파트 단지','부동산 분양 현장','아파트 모델하우스','주거 단지 전경','건설 현장 타워크레인'],
  unsold: ['미분양 아파트','신축 아파트 내부','분양 현장 견본주택','빈 아파트 거실','건설 현장 준공','부동산 매물'],
  finance: ['재테크 저축','금융 계산기','세금 신고 서류','투자 금화','가계부 예산','카드 결제 금융'],
  economy: ['경제 지표 그래프','환율 변동','GDP 성장률','물가 상승 인플레이션','고용 시장 통계'],
  tax: ['세금 계산','연말정산 서류','부동산 세금','종합소득세 신고','세금 절세 전략'],
  life: ['생활 정보','주거 인테리어','도시 풍경','라이프스타일','일상 생활 팁'],
  general: ['데이터 분석','정보 기술','비즈니스 회의'],
};

const CAT_LABEL: Record<string, string> = {
  stock: '주식', apt: '부동산', unsold: '미분양', finance: '재테크',
  economy: '경제', tax: '세금', life: '생활', general: '정보',
};

async function searchNaverImages(query: string, count = 5): Promise<{ url: string; alt: string; caption: string }[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${count}&sort=sim&filter=large`,
      { headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || [])
      .filter((item: any) => parseInt(item.sizewidth || '0') >= 400 && parseInt(item.sizeheight || '0') >= 250)
      .slice(0, count)
      .map((item: any) => ({
        url: item.link || '',
        alt: (item.title || query).replace(/<[^>]*>/g, ''),
        caption: `출처: ${(() => { try { return new URL(item.link || '').hostname; } catch { return '네이버'; } })()}`,
      }));
  } catch { return []; }
}

function extractKeywords(title: string, cat: string): string {
  const clean = title.replace(/[|—·()（）\[\]「」『』""''…]/g, ' ').replace(/\d{4}년?/g, '');
  const words = clean.split(/\s+/).filter(w => w.length >= 2 && w.length <= 10);
  return `${words.slice(0, 3).join(' ')} ${CAT_LABEL[cat] || '정보'}`;
}

function makeInfoUrl(title: string, cat: string, design: number): string {
  return `${SITE_URL}/api/og?title=${encodeURIComponent((title || '').slice(0, 45))}&category=${cat}&author=${encodeURIComponent('카더라 ' + (CAT_LABEL[cat] || '분석') + '팀')}&design=${design}`;
}

async function handler(_req: NextRequest) {
  const start = Date.now();
  const sb = getSupabaseAdmin();

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.json({ ok: true, processed: 0, error: 'NAVER API keys not set' }, { status: 200 });
  }

  try {
    const { data: posts } = await sb
      .from('blog_posts')
      .select('id, title, category, sub_category, image_alt')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(BATCH * 2);

    if (!posts?.length) return NextResponse.json({ ok: true, processed: 0 });

    const postIds = posts.map(p => p.id);
    const { data: existing } = await (sb as any)
      .from('blog_post_images').select('post_id').in('post_id', postIds);
    const existingIds = new Set((existing || []).map((e: any) => e.post_id));
    const needImages = posts.filter(p => !existingIds.has(p.id)).slice(0, BATCH);

    if (!needImages.length) return NextResponse.json({ ok: true, processed: 0, msg: 'all covered' });

    // 카테고리별 이미지 캐시
    const catCache: Record<string, { url: string; alt: string; caption: string }[]> = {};
    const categories = [...new Set(needImages.map((p: any) => (p.category || 'general') as string))];

    for (const cat of categories) {
      const queries = CAT_QUERIES[cat as string] || CAT_QUERIES.general;
      const q1 = queries[Math.floor(Math.random() * queries.length)];
      const q2 = queries[(Math.floor(Math.random() * queries.length) + 1) % queries.length];
      const [imgs1, imgs2] = await Promise.all([searchNaverImages(q1, 10), searchNaverImages(q2, 10)]);
      const seen = new Set<string>();
      catCache[cat as string] = [...imgs1, ...imgs2].filter(img => {
        if (!img.url || seen.has(img.url)) return false;
        seen.add(img.url); return true;
      });
      await new Promise(r => setTimeout(r, 100));
    }

    // 각 글에 6장 할당 (실사진 4 + 인포그래픽 2)
    const inserts: any[] = [];
    const catIdx: Record<string, number> = {};
    let coverUpdated = 0;

    for (const post of needImages) {
      const cat = post.category || 'general';
      const cache = catCache[cat] || [];
      if (!catIdx[cat]) catIdx[cat] = 0;
      const label = CAT_LABEL[cat] || '정보';

      // 제목 기반 맞춤 이미지
      let titleImgs: { url: string; alt: string; caption: string }[] = [];
      try {
        titleImgs = await searchNaverImages(extractKeywords(post.title, cat), 4);
        await new Promise(r => setTimeout(r, 50));
      } catch {}

      // Position 0: 주제 맞춤 (썸네일)
      const img0 = titleImgs[0] || (cache.length > 0 ? cache[catIdx[cat] % cache.length] : null);
      if (img0) {
        catIdx[cat]++;
        inserts.push({ post_id: post.id, image_url: img0.url, alt_text: post.image_alt || `${post.title} — ${label} 관련 이미지`, caption: img0.caption, image_type: 'stock_photo', position: 0 });
      }

      // Position 1: OG 인포그래픽
      const d1 = 1 + Math.floor(Math.random() * 6);
      inserts.push({ post_id: post.id, image_url: makeInfoUrl(post.title, cat, d1), alt_text: `${post.title} — 카더라 ${label} 인포그래픽`, caption: `카더라 ${label} 데이터 분석`, image_type: 'infographic', position: 1 });

      // Position 2: 두 번째 실사진
      const img2 = titleImgs[1] || (cache.length > 0 ? cache[catIdx[cat] % cache.length] : null);
      if (img2) { catIdx[cat]++; inserts.push({ post_id: post.id, image_url: img2.url, alt_text: `${post.title} — ${label} 추가 이미지`, caption: img2.caption, image_type: 'stock_photo', position: 2 }); }

      // Position 3: 카테고리 기반 (다양성)
      if (cache.length > 0) { const img3 = cache[catIdx[cat] % cache.length]; catIdx[cat]++; inserts.push({ post_id: post.id, image_url: img3.url, alt_text: `${post.title} — ${label} 관련`, caption: img3.caption, image_type: 'stock_photo', position: 3 }); }

      // Position 4: OG 비교 인포그래픽
      const d4 = 1 + ((d1 + 2) % 6);
      inserts.push({ post_id: post.id, image_url: makeInfoUrl(post.title.slice(0, 30) + ' 비교', cat, d4), alt_text: `${post.title} — 비교 분석 인포그래픽`, caption: `카더라 ${label} 비교 분석`, image_type: 'infographic', position: 4 });

      // Position 5: 세 번째 실사진
      const img5 = titleImgs[2] || (cache.length > 0 ? cache[catIdx[cat] % cache.length] : null);
      if (img5) { catIdx[cat]++; inserts.push({ post_id: post.id, image_url: img5.url, alt_text: `${post.title} — ${label} 참고 이미지`, caption: img5.caption, image_type: 'stock_photo', position: 5 }); }
    }

    // DB 삽입
    if (inserts.length > 0) {
      const { error } = await (sb as any)
        .from('blog_post_images')
        .upsert(inserts, { onConflict: 'post_id,position', ignoreDuplicates: true });
      if (error) console.error('[blog-generate-images] upsert error:', error);

      // cover_image 교체 (OG 텍스트 배너 → 실사진)
      const coverCandidates = inserts.filter(i => i.position === 0 && i.image_type === 'stock_photo');
      for (const c of coverCandidates) {
        try {
          const { data: updated } = await sb.from('blog_posts')
            .update({ cover_image: c.image_url })
            .eq('id', c.post_id)
            .like('cover_image', '%/api/og%')
            .select('id');
          if (updated && updated.length > 0) coverUpdated++;
        } catch {}
      }
    }

    return NextResponse.json({
      ok: true, processed: needImages.length, inserted: inserts.length,
      cover_updated: coverUpdated,
      cache_sizes: Object.fromEntries(Object.entries(catCache).map(([k, v]) => [k, v.length])),
      elapsed: `${Date.now() - start}ms`,
    }, { status: 200 });
  } catch (err: any) {
    console.error('[blog-generate-images]', err);
    return NextResponse.json({ ok: true, error: err.message, elapsed: `${Date.now() - start}ms` }, { status: 200 });
  }
}

export const GET = withCronAuth(handler);
