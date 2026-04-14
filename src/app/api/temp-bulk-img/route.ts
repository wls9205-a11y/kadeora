// 임시 일회성 벌크 이미지 수집 — 즉시 반환 + after() 백그라운드 처리
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { errMsg } from '@/lib/error-utils';

export const maxDuration = 300;
export const runtime = 'nodejs';

const ONE_TIME_TOKEN = 'f41f6717-5aff-4ff2-93d6-e9daf032689c';
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY;
const PARALLEL = 10;

interface ImageResult { title: string; url: string; thumbnail: string; source: string }

async function searchNaver(query: string, display = 3): Promise<ImageResult[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${display}&sort=sim`,
      { headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      title: (item.title || '').replace(/<[^>]*>/g, ''),
      url: item.link, thumbnail: item.thumbnail, source: 'naver',
    }));
  } catch { return []; }
}

async function searchKakao(query: string, size = 3): Promise<ImageResult[]> {
  if (!KAKAO_REST_KEY) return [];
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/search/image?query=${encodeURIComponent(query)}&size=${size}&sort=accuracy`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.documents || []).map((doc: any) => ({
      title: (doc.display_sitename || '').replace(/<[^>]*>/g, ''),
      url: doc.image_url, thumbnail: doc.thumbnail_url, source: 'kakao',
    }));
  } catch { return []; }
}

function isRelevant(img: ImageResult, name: string): boolean {
  const cap = (img.title || '').toLowerCase();
  const url = (img.url || '').toLowerCase();
  const BAD = ['hogangnono','zigbang','kbland','land.naver','r114.co.kr','drapt.com','chosun.com','hankyung.com','mk.co.kr','utoimage','freepik','shutterstock','namu.wiki','wikipedia','pixabay','unsplash','youtube.com','ohousecdn','pinimg.com'];
  if (BAD.some(d => url.includes(d))) return false;
  const BAD_CAP = ['호갱노노','직방','kb부동산','네이버부동산','다방','한경','매경','스톡 이미지','병원','치과','맛집','호텔','유튜브','게임','영화','시세','매물','스포츠'];
  if (BAD_CAP.some(w => cap.includes(w))) return false;
  if (/\b(icon|favicon|logo|badge|button)\b/i.test(url)) return false;
  const core = name.replace(/\s+/g, '').slice(0, 6).toLowerCase();
  if (core.length >= 3 && cap.replace(/\s+/g, '').includes(core)) return true;
  const GOOD = ['조감도','투시도','배치도','분양','착공','준공','아파트','단지','외관','모델하우스','청약','입주','건설','재개발','재건축','주택','세대'];
  if (GOOD.some(w => cap.includes(w))) return true;
  if (/apt|apart|danji|villa|tower/i.test(url)) return true;
  if (url.includes('imgnews.naver.net') && cap.length > 5) return true;
  return false;
}

async function collectForSite(name: string): Promise<ImageResult[]> {
  const queries = [`${name} 아파트 조감도`, `${name} 투시도`, `${name} 분양`];
  const promises = queries.flatMap(q => [searchNaver(q, 3), searchKakao(q, 3)]);
  const results = await Promise.allSettled(promises);
  const all: ImageResult[] = [];
  for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
  const seen = new Set<string>();
  return all.filter(img => {
    if (!img.url || seen.has(img.url)) return false;
    if (!isRelevant(img, name)) return false;
    seen.add(img.url);
    return true;
  }).slice(0, 6);
}

async function runBulk() {
  const sb = getSupabaseAdmin();
  const start = Date.now();

  const { data: sites } = await sb.from('apt_sites')
    .select('id, name, site_type, images')
    .eq('is_active', true)
    .order('interest_count', { ascending: false })
    .limit(1200);

  const targets = (sites || []).filter((s: Record<string, any>) => {
    const imgs = s.images;
    return !imgs || !Array.isArray(imgs) || imgs.length === 0;
  }).slice(0, 400);

  for (let i = 0; i < targets.length; i += PARALLEL) {
    if (Date.now() - start > 270_000) break;
    const batch = targets.slice(i, i + PARALLEL);
    await Promise.allSettled(
      batch.map(async (site: Record<string, any>) => {
        try {
          const images = await collectForSite(site.name);
          if (images.length === 0) return;
          await sb.from('apt_sites').update({
            images: images.map(img => ({ url: img.url, thumbnail: img.thumbnail, source: img.source, caption: img.title, collected_at: new Date().toISOString() })),
            updated_at: new Date().toISOString(),
          }).eq('id', site.id);
        } catch { /* continue */ }
      })
    );
    await new Promise(r => setTimeout(r, 20));
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== ONE_TIME_TOKEN) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hasApi = !!(NAVER_CLIENT_ID && NAVER_CLIENT_SECRET) || !!KAKAO_REST_KEY;
  if (!hasApi) return NextResponse.json({ error: 'No API keys', naver: !!NAVER_CLIENT_ID, kakao: !!KAKAO_REST_KEY });

  // 진행 전 현재 상태 확인
  const { count: before } = await getSupabaseAdmin().from('apt_sites')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .or('images.is.null,images.eq.[]');

  // 백그라운드로 처리 시작 (즉시 반환)
  after(runBulk());

  return NextResponse.json({
    status: 'started',
    remaining_before: before ?? '?',
    message: '백그라운드 처리 시작됨. /api/temp-bulk-img/status 로 진행 확인',
    apis: { naver: !!NAVER_CLIENT_ID, kakao: !!KAKAO_REST_KEY },
  });
}
