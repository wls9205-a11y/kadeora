// 임시 벌크 이미지 수집 — 동기 50건/회, 빠른 응답
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const runtime = 'nodejs';

const ONE_TIME_TOKEN = 'f41f6717-5aff-4ff2-93d6-e9daf032689c';
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY;
const BATCH = 50;    // 1회 처리 건수
const PARALLEL = 10; // 동시 처리

interface Img { title: string; url: string; thumbnail: string; source: string }

async function naver(q: string): Promise<Img[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const r = await fetch(`https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(q)}&display=3&sort=sim`,
      { headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.items||[]).map((x:any) => ({ title:(x.title||'').replace(/<[^>]*>/g,''), url:x.link, thumbnail:x.thumbnail, source:'naver' }));
  } catch { return []; }
}

async function kakao(q: string): Promise<Img[]> {
  if (!KAKAO_REST_KEY) return [];
  try {
    const r = await fetch(`https://dapi.kakao.com/v2/search/image?query=${encodeURIComponent(q)}&size=3&sort=accuracy`,
      { headers: { Authorization:`KakaoAK ${KAKAO_REST_KEY}` }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.documents||[]).map((x:any) => ({ title:(x.display_sitename||'').replace(/<[^>]*>/g,''), url:x.image_url, thumbnail:x.thumbnail_url, source:'kakao' }));
  } catch { return []; }
}

function ok(img: Img, name: string): boolean {
  const cap = (img.title||'').toLowerCase(), url = (img.url||'').toLowerCase();
  const BAD = ['hogangnono','zigbang','kbland','land.naver','r114.co.kr','drapt.com','chosun.com','hankyung.com','mk.co.kr','utoimage','freepik','shutterstock','namu.wiki','wikipedia','pixabay','youtube.com','ohousecdn','pinimg.com'];
  if (BAD.some(d=>url.includes(d))) return false;
  const BADC = ['호갱노노','직방','kb부동산','네이버부동산','다방','한경','매경','스톡 이미지','병원','치과','맛집','호텔','유튜브','게임','영화','시세','매물','스포츠'];
  if (BADC.some(w=>cap.includes(w))) return false;
  if (/\b(icon|favicon|logo|badge|button)\b/i.test(url)) return false;
  const core = name.replace(/\s+/g,'').slice(0,6).toLowerCase();
  if (core.length>=3 && cap.replace(/\s+/g,'').includes(core)) return true;
  const GOOD = ['조감도','투시도','배치도','분양','착공','준공','아파트','단지','외관','모델하우스','청약','입주','건설','재개발','재건축','주택','세대'];
  if (GOOD.some(w=>cap.includes(w))) return true;
  if (/apt|apart|danji|villa|tower/i.test(url)) return true;
  if (url.includes('imgnews.naver.net') && cap.length>5) return true;
  return false;
}

async function collect(name: string): Promise<Img[]> {
  const qs = [`${name} 아파트 조감도`, `${name} 투시도`, `${name} 분양`];
  const all: Img[] = [];
  const rs = await Promise.allSettled(qs.flatMap(q=>[naver(q),kakao(q)]));
  for (const r of rs) if (r.status==='fulfilled') all.push(...r.value);
  const seen = new Set<string>();
  return all.filter(i => { if (!i.url||seen.has(i.url)||!ok(i,name)) return false; seen.add(i.url); return true; }).slice(0,6);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== ONE_TIME_TOKEN) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = getSupabaseAdmin();
  const start = Date.now();

  const { data: sites } = await sb.from('apt_sites')
    .select('id, name, images')
    .eq('is_active', true)
    .order('interest_count', { ascending: false })
    .limit(BATCH * 3);

  const targets = (sites||[]).filter((s:any) => { const i=s.images; return !i||!Array.isArray(i)||i.length===0; }).slice(0, BATCH);

  let collected = 0, skipped = 0;

  for (let i = 0; i < targets.length; i += PARALLEL) {
    if (Date.now() - start > 55_000) break; // 55초 초과시 중단
    await Promise.allSettled(
      targets.slice(i, i+PARALLEL).map(async (site:any) => {
        const imgs = await collect(site.name);
        if (!imgs.length) { skipped++; return; }
        await sb.from('apt_sites').update({
          images: imgs.map(m=>({ url:m.url, thumbnail:m.thumbnail, source:m.source, caption:m.title, collected_at:new Date().toISOString() })),
          updated_at: new Date().toISOString()
        }).eq('id', site.id);
        collected++;
      })
    );
    await new Promise(r=>setTimeout(r,20));
  }

  const { count: remaining } = await sb.from('apt_sites')
    .select('*',{count:'exact',head:true}).eq('is_active',true).is('images',null);

  return NextResponse.json({ collected, skipped, remaining, elapsed: `${((Date.now()-start)/1000).toFixed(1)}s` });
}
