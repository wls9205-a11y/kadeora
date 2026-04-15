import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 300;

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

const CAT_LABEL: Record<string, string> = {
  stock: '주식', apt: '부동산', unsold: '미분양', finance: '재테크',
  economy: '경제', tax: '세금', life: '생활', general: '정보',
};

async function fetchNaverImages(query: string, count = 5): Promise<{ url: string; alt: string; caption: string }[]> {
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${count}&sort=sim&filter=large`,
      {
        headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || [])
      .filter((item: any) => parseInt(item.sizewidth || '0') >= 400 && parseInt(item.sizeheight || '0') >= 250)
      .map((item: any) => ({
        url: (item.link || '').replace(/^http:\/\//, 'https://'),
        alt: (item.title || query).replace(/<[^>]*>/g, ''),
        caption: `출처: ${(() => { try { return new URL(item.link || '').hostname; } catch { return '웹'; } })()}`,
      }));
  } catch { return []; }
}

function extractKeywords(title: string, cat: string): string {
  const clean = title.replace(/[|—·()（）\[\]「」『』""'']/g, ' ').replace(/\d{4}년?/g, '');
  const words = clean.split(/\s+/).filter(w => w.length >= 2 && w.length <= 10);
  return `${words.slice(0, 3).join(' ')} ${CAT_LABEL[cat] || '정보'}`;
}

// GET /api/admin/batch-image-fix?secret=xxx&limit=500
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '500'), 1000);
  const sb = getSupabaseAdmin();

  // OG 커버인 글 조회 (조회수 높은 순 우선)
  const { data: posts, error: fetchErr } = await sb
    .from('blog_posts')
    .select('id, title, category, image_alt, cover_image')
    .eq('is_published', true)
    .like('cover_image', '%/api/og?%')
    .order('view_count', { ascending: false })
    .limit(limit);

  if (fetchErr || !posts?.length) {
    return NextResponse.json({ ok: true, processed: 0, remaining: 0, error: fetchErr?.message });
  }

  let updated = 0;
  let failed = 0;
  let imagesInserted = 0;

  for (const post of posts) {
    const cat = post.category || 'general';
    const kw = extractKeywords(post.title, cat);
    const imgs = await fetchNaverImages(kw, 5);
    
    // Rate limit: 10 req/sec
    await new Promise(r => setTimeout(r, 110));

    if (imgs.length === 0) {
      failed++;
      continue;
    }

    // Position 0: 실사진 커버
    const inserts: any[] = [];
    const label = CAT_LABEL[cat] || '정보';
    
    inserts.push({
      post_id: post.id, image_url: imgs[0].url,
      alt_text: post.image_alt || `${post.title} — ${label}`,
      caption: imgs[0].caption, image_type: 'stock_photo', position: 0,
    });

    // Position 1: OG 인포그래픽
    inserts.push({
      post_id: post.id,
      image_url: `${SITE_URL}/api/og?title=${encodeURIComponent((post.title || '').slice(0, 40))}&category=${cat}&author=${encodeURIComponent('카더라 ' + label + '팀')}&design=${1 + Math.floor(Math.random() * 6)}`,
      alt_text: `${post.title} — 카더라 ${label} 인포그래픽`,
      caption: `카더라 ${label} 데이터 분석`, image_type: 'infographic', position: 1,
    });

    // Position 2~4: 추가 실사진
    for (let i = 1; i < Math.min(imgs.length, 4); i++) {
      inserts.push({
        post_id: post.id, image_url: imgs[i].url,
        alt_text: `${post.title} — ${label} 이미지 ${i + 1}`,
        caption: imgs[i].caption, image_type: 'stock_photo', position: i + 1,
      });
    }

    // Upsert images
    const { error: upsertErr } = await (sb as any)
      .from('blog_post_images')
      .upsert(inserts, { onConflict: 'post_id,position', ignoreDuplicates: false });

    if (!upsertErr) {
      imagesInserted += inserts.length;
      // Update cover_image
      await sb.from('blog_posts')
        .update({ cover_image: imgs[0].url })
        .eq('id', post.id);
      updated++;
    } else {
      failed++;
    }
  }

  // 남은 OG 커버 수 확인
  const { count } = await sb.from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)
    .like('cover_image', '%/api/og?%');

  return NextResponse.json({
    ok: true, processed: posts.length, updated, failed,
    imagesInserted, remaining: count || 0,
  });
}
