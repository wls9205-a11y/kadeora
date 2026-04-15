import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 300;

const NID = process.env.NAVER_CLIENT_ID || '';
const NSC = process.env.NAVER_CLIENT_SECRET || '';

async function naver(query: string, count = 5) {
  try {
    const r = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${count}&sort=sim&filter=large`,
      { headers: { 'X-Naver-Client-Id': NID, 'X-Naver-Client-Secret': NSC }, signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.items||[])
      .filter((i:any) => parseInt(i.sizewidth||'0')>=300 && parseInt(i.sizeheight||'0')>=200)
      .map((i:any) => ({
        url: (i.link||'').replace(/^http:\/\//,'https://'),
        alt: (i.title||query).replace(/<[^>]*>/g,''),
        thumb: (i.thumbnail||'').replace(/^http:\/\//,'https://'),
      }));
  } catch { return []; }
}

// GET /api/admin/batch-image-fix?secret=xxx&mode=complex|sites|blog&limit=200
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams;
  if (s.get('secret') !== process.env.CRON_SECRET) return NextResponse.json({error:'unauthorized'},{status:401});
  const mode = s.get('mode') || 'blog';
  const limit = Math.min(parseInt(s.get('limit')||'200'), 2000);
  const sb = getSupabaseAdmin();
  if (mode==='complex') return doComplex(sb,limit);
  if (mode==='sites') return doSites(sb,limit);
  return doBlog(sb,limit);
}

async function doComplex(sb:any, limit:number) {
  const {data:rows,error}=await sb.from('apt_complex_profiles')
    .select('id,apt_name,sigungu,region_nm')
    .or('images.is.null,images.eq.[]')
    .order('sale_count_1y',{ascending:false}).limit(limit);
  if(error||!rows?.length){
    const {count}=await sb.from('apt_complex_profiles').select('id',{count:'exact',head:true}).or('images.is.null,images.eq.[]');
    return NextResponse.json({ok:true,mode:'complex',processed:0,remaining:count||0});
  }
  let ok=0,fail=0;
  for(const r of rows){
    const imgs=await naver(`${r.apt_name} ${r.sigungu||''} 아파트`,5);
    await new Promise(r=>setTimeout(r,110));
    if(!imgs.length){fail++;continue;}
    const arr=imgs.map(i=>({url:i.url,source:'naver',caption:i.alt,thumbnail:i.thumb||i.url,collected_at:new Date().toISOString()}));
    const {error:e}=await sb.from('apt_complex_profiles').update({images:arr}).eq('id',r.id);
    if(!e) ok++; else fail++;
  }
  const {count}=await sb.from('apt_complex_profiles').select('id',{count:'exact',head:true}).or('images.is.null,images.eq.[]');
  return NextResponse.json({ok:true,mode:'complex',processed:rows.length,updated:ok,failed:fail,remaining:count||0});
}

async function doSites(sb:any, limit:number) {
  const {data:rows,error}=await (sb as any).from('apt_sites')
    .select('id,name,region,district')
    .or('images.is.null,images.eq.[]')
    .order('id',{ascending:true}).limit(limit);
  if(error||!rows?.length){
    const {count}=await (sb as any).from('apt_sites').select('id',{count:'exact',head:true}).or('images.is.null,images.eq.[]');
    return NextResponse.json({ok:true,mode:'sites',processed:0,remaining:count||0});
  }
  let ok=0,fail=0;
  for(const r of rows){
    const imgs=await naver(`${r.name} ${r.district||r.region||''} 아파트`,5);
    await new Promise(r=>setTimeout(r,110));
    if(!imgs.length){fail++;continue;}
    const arr=imgs.map(i=>({url:i.url,source:'naver',caption:i.alt,thumbnail:i.thumb||i.url,collected_at:new Date().toISOString()}));
    const upd:any={images:arr};
    const {error:e}=await (sb as any).from('apt_sites').update(upd).eq('id',r.id);
    if(!e) ok++; else fail++;
  }
  // og_image도 images에서 채우기
  await (sb as any).rpc('exec_sql', { query: "UPDATE apt_sites SET og_image_url = images->0->>'url' WHERE (og_image_url IS NULL OR og_image_url = '') AND images IS NOT NULL AND jsonb_array_length(images) > 0" }).catch(() => {});
  const {count}=await (sb as any).from('apt_sites').select('id',{count:'exact',head:true}).or('images.is.null,images.eq.[]');
  return NextResponse.json({ok:true,mode:'sites',processed:rows.length,updated:ok,failed:fail,remaining:count||0});
}

async function doBlog(sb:any, limit:number) {
  const {data:posts}=await sb.from('blog_posts')
    .select('id,title,category,image_alt,cover_image')
    .eq('is_published',true).like('cover_image','%/api/og?%')
    .order('view_count',{ascending:false}).limit(limit);
  if(!posts?.length) return NextResponse.json({ok:true,mode:'blog',processed:0,remaining:0});
  const CL:Record<string,string>={stock:'주식',apt:'부동산',unsold:'미분양',finance:'재테크',economy:'경제',tax:'세금',life:'생활',general:'정보'};
  let ok=0,fail=0;
  for(const p of posts){
    const c=p.category||'general';
    const w=p.title.replace(/[|—·()\[\]]/g,' ').replace(/\d{4}년?/g,'').split(/\s+/).filter((w:string)=>w.length>=2&&w.length<=10);
    const imgs=await naver(`${w.slice(0,3).join(' ')} ${CL[c]||'정보'}`,5);
    await new Promise(r=>setTimeout(r,110));
    if(!imgs.length){fail++;continue;}
    const ins=[{post_id:p.id,image_url:imgs[0].url,alt_text:p.image_alt||p.title,caption:imgs[0].alt,image_type:'stock_photo',position:0}];
    ins.push({post_id:p.id,image_url:`${SITE_URL}/api/og?title=${encodeURIComponent(p.title.slice(0,40))}&category=${c}&design=${1+Math.floor(Math.random()*6)}`,alt_text:`${p.title} 인포`,caption:'카더라',image_type:'infographic',position:1});
    for(let i=1;i<Math.min(imgs.length,4);i++) ins.push({post_id:p.id,image_url:imgs[i].url,alt_text:`${p.title} ${i+1}`,caption:imgs[i].alt,image_type:'stock_photo',position:i+1});
    await (sb as any).from('blog_post_images').upsert(ins,{onConflict:'post_id,position',ignoreDuplicates:false});
    await sb.from('blog_posts').update({cover_image:imgs[0].url}).eq('id',p.id);
    ok++;
  }
  const {count}=await sb.from('blog_posts').select('id',{count:'exact',head:true}).eq('is_published',true).like('cover_image','%/api/og?%');
  return NextResponse.json({ok:true,mode:'blog',processed:posts.length,updated:ok,failed:fail,remaining:count||0});
}
