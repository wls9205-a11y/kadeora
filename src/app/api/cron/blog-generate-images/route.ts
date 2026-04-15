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
  stock: ['주식 증권 시장 차트', '코스피 주식 거래', '투자 분석 차트', '증권사 트레이딩'],
  apt: ['아파트 단지 전경', '신축 아파트 외관', '아파트 모델하우스 내부', '분양 현장 조감도'],
  unsold: ['미분양 아파트 현장', '아파트 건설 현장', '빈 아파트 단지'],
  finance: ['재테크 저축 은행', '금융 투자 자산관리', '적금 예금 비교'],
  economy: ['경제 성장 지표 그래프', '한국은행 기준금리', '물가 상승 소비자'],
  tax: ['세금 연말정산 서류', '종합소득세 신고', '세무사 세금 계산'],
  redev: ['재개발 재건축 현장', '정비사업 철거 현장', '도시재생 공사'],
  life: ['생활 정보 서비스', '공공서비스 민원', '생활비 절약 가계부'],
  general: ['데이터 분석 리포트', '정보 기술 디지털', '온라인 서비스'],
};

// sub_category별 더 정확한 검색어
const SUB_CAT_QUERIES: Record<string, string[]> = {
  '청약·분양': ['청약 모델하우스 분양', '아파트 분양 현장 조감도', '청약 당첨 발표'],
  '실거래·시세': ['아파트 시세 매매', '부동산 실거래가 변동', '아파트 단지 전경'],
  '수급분석': ['주식 수급 차트 외국인', '기관 매수 매도 현황', '투자 자금 흐름'],
  '목표주가': ['증권사 리포트 목표주가', '주식 종목 분석', '애널리스트 전망'],
  '종목분석': ['주식 종목 재무제표', '기업 실적 발표', '주식 펀더멘탈 분석'],
  '배당분석': ['배당주 투자 배당금', '배당 수익률 주식', '배당 달력 투자'],
  '해외주식': ['미국 뉴욕증시 월스트리트', 'NYSE 나스닥 해외주식', 'S&P500 미국 시장'],
  '국내주식': ['코스피 코스닥 국내주식', '한국 증권시장 거래소', '국내 주식 투자'],
  '비교분석': ['주식 종목 비교 차트', '투자 수익률 비교 분석', 'PER PBR 밸류에이션'],
  '재테크일반': ['재테크 자산관리 투자', '목돈 만들기 적금', '금융 상품 비교'],
  '재개발·재건축': ['재개발 현장 정비사업', '재건축 아파트 철거', '도시정비 사업'],
  '미분양현황': ['미분양 아파트 빈 단지', '지방 미분양 현황', '분양 시장 전망'],
  '섹터전망': ['산업 섹터 전망 분석', '반도체 바이오 업종', '테마주 섹터 투자'],
  '부동산일반': ['부동산 시장 전망', '주택 정책 부동산', '집값 전망 분석'],
};

// 이미지 URL 블랙리스트 (관련 없는 사이트)
const IMG_BLOCK_DOMAINS = [
  'utoimage', 'freepik', 'shutterstock', 'pixabay', 'unsplash', 'istockphoto',
  'namu.wiki', 'wikipedia', 'youtube.com', 'pinimg.com', 'ohousecdn',
  'blog.kakaocdn.net/dn/0/', 'tistory.com/image/0/',
];

const CAT_LABEL: Record<string, string> = {
  stock: '주식', apt: '부동산', unsold: '미분양', finance: '재테크',
  economy: '경제', tax: '세금', life: '생활', general: '정보', redev: '재개발',
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
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[blog-generate-images] Naver API error: ${res.status} ${res.statusText} | query="${query}" | body=${body.slice(0, 200)}`);
      return [];
    }
    const data = await res.json();
    const results = (data.items || [])
      .filter((item: any) => {
        const w = parseInt(item.sizewidth || '0');
        const h = parseInt(item.sizeheight || '0');
        if (w < 400 || h < 250) return false;
        const url = (item.link || '').toLowerCase();
        if (IMG_BLOCK_DOMAINS.some(d => url.includes(d))) return false;
        return true;
      })
      .map((item: any) => ({
        url: (item.link || '').replace(/^http:\/\//, 'https://'),
        alt: (item.title || query).replace(/<[^>]*>/g, ''),
        caption: `출처: ${(() => { try { return new URL(item.link || '').hostname; } catch { return '웹'; } })()}`,
      }));
    if (results.length === 0 && (data.items || []).length > 0) {
      console.warn(`[blog-generate-images] Naver returned ${data.items.length} items but 0 passed size filter (>=400x250) | query="${query}"`);
    }
    return results;
  } catch (err: any) {
    console.error(`[blog-generate-images] Naver fetch error: ${err.message} | query="${query}"`);
    return [];
  }
}

function extractKeywords(title: string, cat: string, subCat?: string | null): string {
  // 특수문자 제거하되 한글/영문/숫자 보존
  const clean = title.replace(/[|—·()（）\[\]「」『』""''%]/g, ' ').replace(/\d{4}년?/g, '');
  const words = clean.split(/\s+/).filter(w => w.length >= 2 && w.length <= 12);
  
  // 핵심 엔티티 추출: 아파트명, 회사명, 지역명 등 (한글 2자 이상 고유명사)
  const entities = words.filter(w => 
    /[가-힣]{2,}/.test(w) && 
    !['분석', '전망', '비교', '가이드', '정리', '요약', '방법', '완벽', '최신', '현황', '이란', '어떻게'].includes(w)
  ).slice(0, 3);
  
  const catWord = CAT_LABEL[cat] || '정보';
  const subWord = subCat ? (SUB_CAT_QUERIES[subCat]?.[0]?.split(' ')[0] || '') : '';
  
  return `${entities.join(' ')} ${subWord || catWord}`.trim();
}

async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.json({ ok: true, processed: 0, error: 'NAVER API keys not set' }, { status: 200 });
  }

  try {
    // OG 커버인 글 우선 조회 (이슈 블로그 최우선 → 나머지 최신순)
    const { data: issuePosts } = await sb
      .from('blog_posts')
      .select('id, title, category, sub_category, image_alt, cover_image')
      .eq('source_type', 'auto_issue')
      .like('cover_image', '%/api/og?%')
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: normalPosts } = await sb
      .from('blog_posts')
      .select('id, title, category, sub_category, image_alt, cover_image')
      .eq('is_published', true)
      .or('source_type.is.null,source_type.neq.auto_issue')
      .like('cover_image', '%/api/og?%')
      .order('created_at', { ascending: false })
      .limit(BATCH - (issuePosts?.length || 0));

    const posts = [...(issuePosts || []), ...(normalPosts || [])];

    if (!posts?.length) return NextResponse.json({ ok: true, processed: 0, msg: 'all covers are real images' });

    console.log(`[blog-generate-images] ${posts.length}건 OG 커버 → 실사진 교체 시작`);

    // 카테고리별 네이버 이미지 캐시
    const catCache: Record<string, { url: string; alt: string; caption: string }[]> = {};
    const categories: string[] = Array.from(new Set(posts.map((p: any) => String(p.category || 'general'))));

    for (const cat of categories) {
      const queries = CAT_QUERIES[cat as string] || CAT_QUERIES.general;
      // sub_category별 쿼리도 섞어서 정확도 향상
      const subCats = Array.from(new Set(posts.filter((p: any) => p.category === cat && p.sub_category).map((p: any) => p.sub_category)));
      const subQueries = subCats.flatMap(sc => SUB_CAT_QUERIES[sc] || []);
      const allQueries = [...queries, ...subQueries];
      const q1 = allQueries[Math.floor(Math.random() * allQueries.length)];
      const q2 = allQueries[Math.floor(Math.random() * allQueries.length)];
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
      const kw = extractKeywords(post.title, cat, post.sub_category);
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
