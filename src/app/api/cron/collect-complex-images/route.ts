import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

export const maxDuration = 300;
export const runtime = 'nodejs';

const NAVER_ID = process.env.NAVER_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const BATCH = 500;
const PARALLEL = 20;

interface Img { title: string; url: string; thumbnail: string; source: string }

async function nv(q: string): Promise<Img[]> {
  if (!NAVER_ID || !NAVER_SECRET) return [];
  try {
    const r = await fetch(`https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(q)}&display=5&sort=sim`,
      { headers: { 'X-Naver-Client-Id': NAVER_ID, 'X-Naver-Client-Secret': NAVER_SECRET }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    return ((await r.json()).items||[]).map((x:any)=>({title:(x.title||'').replace(/<[^>]*>/g,''),url:x.link,thumbnail:x.thumbnail,source:'naver'}));
  } catch { return []; }
}

async function kk(q: string): Promise<Img[]> {
  if (!KAKAO_KEY) return [];
  try {
    const r = await fetch(`https://dapi.kakao.com/v2/search/image?query=${encodeURIComponent(q)}&size=5&sort=accuracy`,
      { headers: { Authorization:`KakaoAK ${KAKAO_KEY}` }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    return ((await r.json()).documents||[]).map((x:any)=>({title:(x.display_sitename||'').replace(/<[^>]*>/g,''),url:x.image_url,thumbnail:x.thumbnail_url,source:'kakao'}));
  } catch { return []; }
}

function cleanName(name: string): string {
  return name.replace(/\([^)]*\)/g,'').replace(/\d+동$/,'').replace(/\s+/g,' ').trim();
}

function ok(img: Img, name: string): boolean {
  const cap=(img.title||'').toLowerCase(),url=(img.url||'').toLowerCase();
  const BAD=['hogangnono','zigbang','kbland','land.naver','r114.co.kr','drapt.com','chosun.com','hankyung.com','mk.co.kr','utoimage','freepik','shutterstock','namu.wiki','wikipedia','pixabay','youtube.com','ohousecdn','pinimg.com'];
  if (BAD.some(d=>url.includes(d))) return false;
  const BADC=['호갱노노','직방','kb부동산','네이버부동산','다방','한경','매경','스톡 이미지','병원','치과','맛집','호텔','유튜브','게임','시세','매물','스포츠'];
  if (BADC.some(w=>cap.includes(w))) return false;
  if (/\b(icon|favicon|logo|badge|button)\b/i.test(url)) return false;
  const core=cleanName(name).replace(/\s+/g,'').slice(0,5).toLowerCase();
  if (core.length>=3 && cap.replace(/\s+/g,'').includes(core)) return true;
  const GOOD=['조감도','투시도','배치도','분양','착공','준공','아파트','단지','외관','모델하우스','청약','입주','건설','재개발','재건축','주택','세대','공급','타워'];
  if (GOOD.some(w=>cap.includes(w))) return true;
  if (/apt|apart|danji|villa|tower/i.test(url)) return true;
  if (url.includes('imgnews.naver.net') && cap.length>5) return true;
  return false;
}

async function collect(name: string, sigungu: string): Promise<Img[]> {
  const clean=cleanName(name);
  const qs=[`${sigungu} ${clean} 아파트`, `${clean} ${sigungu} 아파트 외관`];
  const results=await Promise.allSettled(qs.flatMap(q=>[nv(q),kk(q)]));
  const all: Img[]=[];
  for (const r of results) if (r.status==='fulfilled') all.push(...r.value);
  const seen=new Set<string>();
  let imgs=all.filter(i=>{if(!i.url||seen.has(i.url))return false;seen.add(i.url);return ok(i,name);}).slice(0,5);
  if (!imgs.length){const s2=new Set<string>();imgs=all.filter(i=>{if(!i.url||s2.has(i.url))return false;s2.add(i.url);return true;}).slice(0,3);}
  return imgs;
}

async function handler(_req: NextRequest) {
  const start=Date.now();
  const sb=getSupabaseAdmin();

  const {data:rows}=await (sb as any).from('apt_complex_profiles')
    .select('id, apt_name, sigungu').is('images',null)
    .order('sale_count_1y',{ascending:false}).limit(BATCH);

  const targets=(rows||[]) as any[];
  if (!targets.length) return NextResponse.json({message:'완료',processed:0});

  let collected=0,skipped=0;
  for (let i=0;i<targets.length;i+=PARALLEL) {
    if (Date.now()-start>270_000) break;
    await Promise.allSettled(targets.slice(i,i+PARALLEL).map(async(row:any)=>{
      const imgs=await collect(row.apt_name,row.sigungu||'');
      if (!imgs.length){await (sb as any).from('apt_complex_profiles').update({images:[]}).eq('id',row.id);skipped++;return;}
      await (sb as any).from('apt_complex_profiles').update({
        images:imgs.map(m=>({url:m.url,thumbnail:m.thumbnail,source:m.source,caption:m.title,collected_at:new Date().toISOString()})),
        updated_at:new Date().toISOString()
      }).eq('id',row.id);
      collected++;
    }));
    await new Promise(r=>setTimeout(r,50));
  }
  return NextResponse.json({processed:targets.length,collected,skipped,elapsed:`${((Date.now()-start)/1000).toFixed(1)}s`});
}
export const GET = withCronAuth(handler);
