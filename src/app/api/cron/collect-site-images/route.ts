import { errMsg } from '@/lib/error-utils';
export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY;
const BATCH_SIZE = 400;

interface ImageResult { title: string; url: string; thumbnail: string; source: string }

/** 네이버 이미지 검색 */
async function searchNaver(query: string, display = 3): Promise<ImageResult[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${display}&sort=sim`,
      { headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      title: (item.title || '').replace(/<[^>]*>/g, ''),
      url: item.link,
      thumbnail: item.thumbnail,
      source: 'naver',
    }));
  } catch { return []; }
}

/** 카카오 이미지 검색 (Daum) — 월 30만건 무료 */
async function searchKakao(query: string, size = 3): Promise<ImageResult[]> {
  if (!KAKAO_REST_KEY) return [];
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/search/image?query=${encodeURIComponent(query)}&size=${size}&sort=accuracy`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.documents || []).map((doc: any) => ({
      title: (doc.display_sitename || doc.collection || '').replace(/<[^>]*>/g, ''),
      url: doc.image_url,
      thumbnail: doc.thumbnail_url,
      source: 'kakao',
    }));
  } catch { return []; }
}

/** 단지 하나에 대해 네이버+카카오 병렬로 이미지 수집 */
async function collectForSite(name: string): Promise<ImageResult[]> {
  const queries = [`${name} 아파트 조감도`, `${name} 투시도`, `${name} 분양`];

  // 네이버 5개 + 카카오 5개 = 10개 쿼리 병렬 실행
  const promises = queries.flatMap(q => [searchNaver(q, 5), searchKakao(q, 5)]);
  const results = await Promise.allSettled(promises);
  const allImages: ImageResult[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allImages.push(...r.value);
  }

  // 관련성 필터 + 중복 제거 + 최대 7장
  const seen = new Set<string>();
  return allImages.filter(img => {
    if (!img.url || seen.has(img.url)) return false;
    if (!isRelevantImage(img, name)) return false;
    seen.add(img.url);
    return true;
  }).slice(0, 7);
}

/** 아파트 관련 이미지인지 판별 + 타사 워터마크 차단 */
function isRelevantImage(img: ImageResult, aptName: string): boolean {
  const caption = (img.title || '').toLowerCase();
  const url = (img.url || '').toLowerCase();

  // 0) 타사 워터마크가 포함된 이미지 차단
  const WATERMARK_DOMAINS = [
    'hogangnono', 'zigbang', 'kbland', 'land.naver', 'landthumb',
    'r114.co.kr', 'drapt.com', 'apt2you', 'peterpanz',
    'dabangapp', 'station3', // 다방
    'realestate.daum', 'soomgo', 'ppomppu',
    'chosun.com', 'hankyung.com', // 언론사 (워터마크 있음)
    'mk.co.kr', 'sedaily.com', 'fnnews.com',
  ];
  if (WATERMARK_DOMAINS.some(d => url.includes(d))) return false;

  // 0-b) 캡션에 타사 서비스명 (워터마크 소스)
  const WATERMARK_CAPTIONS = [
    '호갱노노', '직방', 'kb부동산', '네이버부동산', '다방',
    '피터팬', '부동산114', '한경', '매경', '조선일보',
  ];
  if (WATERMARK_CAPTIONS.some(w => caption.includes(w))) return false;

  // 1) URL 차단 — 스톡사이트, 위키, 무관 도메인
  const BAD_DOMAINS = [
    'utoimage', 'freepik', 'shutterstock', 'clipart', 'istockphoto',
    'namu.wiki', 'wikipedia', 'pixabay', 'unsplash', 'pexels',
    'youtube.com', 'youtu.be', 'tiktok.com',
    'ohousecdn', 'ohou.se',
    'pinimg.com', // Pinterest
  ];
  if (BAD_DOMAINS.some(d => url.includes(d))) return false;

  // 2) 캡션 차단 — 무관 콘텐츠
  const BAD_CAPTIONS = [
    '스톡 이미지', '클립아트', '벡터', '일러스트', '프리진',
    '의학과', '병원', '치과', '의원', '약국', '한의원',
    '맛집', '카페', '식당', '레스토랑', '호텔', '펜션', '모텔',
    '유튜브', '게임', '영화', '드라마', '웹툰',
    '시세', '매물', '실거래가', '시세표',
    '스포츠', '야구', '축구', '농구',
  ];
  if (BAD_CAPTIONS.some(w => caption.includes(w))) return false;

  // 3) 이미지가 너무 작으면 제외 (썸네일/아이콘)
  if (/\b(icon|favicon|logo|badge|button)\b/i.test(url)) return false;

  // 4) 아파트 이름이 캡션에 포함 → 높은 관련성
  const nameCore = aptName.replace(/\s+/g, '').slice(0, 6).toLowerCase();
  if (nameCore.length >= 3 && caption.replace(/\s+/g, '').includes(nameCore)) return true;

  // 5) 긍정 키워드 — 아파트/부동산 관련
  const GOOD_WORDS = [
    '조감도', '투시도', '배치도', '분양', '착공', '준공',
    '아파트', '단지', '외관', '견본주택', '모델하우스',
    '청약', '입주', '시공', '건설', '재개발', '재건축',
    '주택', '세대', '공급', '타워', '블록', '지구',
  ];
  if (GOOD_WORDS.some(w => caption.includes(w))) return true;

  // 6) 이미지 URL에 아파트 관련 패턴
  if (/apt|apart|danji|villa|tower|block/i.test(url)) return true;

  // 뉴스 이미지는 보도용 사진일 가능성 높음 (조감도/현장)
  if (url.includes('imgnews.naver.net') && caption.length > 5) return true;

  return false;
}

async function handler(_req: NextRequest) {
  const start = Date.now();
  const sb = getSupabaseAdmin();
  let collected = 0;
  let skipped = 0;
  const errors: string[] = [];

  const hasApi = !!(NAVER_CLIENT_ID && NAVER_CLIENT_SECRET) || !!KAKAO_REST_KEY;
  if (!hasApi) {
    return NextResponse.json({ error: 'No search API keys set (NAVER or KAKAO)' }, { status: 200 });
  }

  // 이미지 없는 현장 조회
  const { data: sites } = await sb.from('apt_sites')
    .select('id, name, region, sigungu, site_type, images')
    .eq('is_active', true)
    .order('interest_count', { ascending: false })
    .limit(BATCH_SIZE * 3);

  const targets = (sites || []).filter((s: Record<string, any>) => {
    const imgs = s.images;
    return !imgs || !Array.isArray(imgs) || imgs.length === 0;
  }).slice(0, BATCH_SIZE);

  if (!targets || targets.length === 0) {
    return NextResponse.json({ success: true, collected: 0, message: 'All sites have images' });
  }

  // 5건씩 병렬 처리 (API 부하 분산)
  const PARALLEL = 5;
  for (let i = 0; i < targets.length; i += PARALLEL) {
    // 타임아웃 방어 (270초 넘으면 중단)
    if (Date.now() - start > 270_000) break;

    const batch = targets.slice(i, i + PARALLEL);
    const results = await Promise.allSettled(
      batch.map(async (site: Record<string, any>) => {
        const images = await collectForSite(site.name);
        if (images.length === 0) {
          // 세션 145: images=[] 덮어쓰기 금지 (실 이미지 말소 방지). updated_at 만 갱신.
          await sb.from('apt_sites').update({ updated_at: new Date().toISOString() }).eq('id', site.id);
          skipped++; return;
        }

        const imageData = images.map(img => ({
          url: img.url,
          thumbnail: img.thumbnail,
          source: img.source,
          caption: img.title,
          collected_at: new Date().toISOString(),
        }));

        await sb.from('apt_sites').update({
          images: imageData,
          updated_at: new Date().toISOString(),
        }).eq('id', site.id);

        collected++;
      })
    );

    for (const r of results) {
      if (r.status === 'rejected') errors.push(errMsg(r.reason));
    }

    // 배치 간 최소 딜레이
    await new Promise(r => setTimeout(r, 30));
  }

  return NextResponse.json({
    success: true,
    collected,
    skipped,
    total_checked: Math.min(targets.length, Math.ceil((Date.now() - start) / 200)),
    elapsed: `${Date.now() - start}ms`,
    sources: { naver: !!NAVER_CLIENT_ID, kakao: !!KAKAO_REST_KEY },
    errors: errors.length ? errors.slice(0, 5) : undefined,
  });
}

export const GET = withCronAuth(handler);
