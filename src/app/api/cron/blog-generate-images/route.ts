import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 30;

const CAT_LABEL: Record<string, string> = {
  stock: '주식', apt: '부동산', unsold: '미분양', finance: '재테크', general: '정보',
};

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const BATCH = 100;

  try {
    // 이미지 없는 게시글 찾기
    const { data: posts } = await sb
      .from('blog_posts')
      .select('id, title, category, cover_image, image_alt')
      .eq('is_published', true)
      .not('cover_image', 'is', null)
      .order('published_at', { ascending: false })
      .limit(BATCH);

    if (!posts?.length) return NextResponse.json({ ok: true, processed: 0 });

    const postIds = posts.map(p => p.id);
    const { data: existing } = await (sb as any)
      .from('blog_post_images')
      .select('post_id')
      .in('post_id', postIds);
    const existingIds = new Set((existing || []).map((e: any) => e.post_id));

    const needImages = posts.filter(p => !existingIds.has(p.id));
    if (!needImages.length) return NextResponse.json({ ok: true, processed: 0, msg: 'all done' });

    const inserts: any[] = [];
    for (const post of needImages) {
      const cat = post.category || 'general';
      const catLabel = CAT_LABEL[cat] || '정보';
      const altBase = post.image_alt || `${post.title} — 카더라 ${catLabel} 분석`;
      const coverUrl = post.cover_image?.startsWith('/') ? `${SITE_URL}${post.cover_image}` : post.cover_image;

      if (coverUrl) {
        inserts.push({
          post_id: post.id, image_url: coverUrl, alt_text: altBase,
          caption: `카더라 ${catLabel} 데이터 분석`, image_type: 'hero', position: 0,
        });
      }

      const titleShort = (post.title || '').slice(0, 40);
      const infoUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(titleShort)}&category=${cat}&design=2&subtitle=${encodeURIComponent(catLabel)}`;
      if (infoUrl !== coverUrl) {
        inserts.push({
          post_id: post.id, image_url: infoUrl,
          alt_text: `${post.title} 인포그래픽`, caption: null,
          image_type: 'infographic', position: 1,
        });
      }
    }

    if (inserts.length > 0) {
      await (sb as any).from('blog_post_images')
        .upsert(inserts, { onConflict: 'post_id,position', ignoreDuplicates: true });
    }

    return NextResponse.json({ ok: true, processed: needImages.length, inserted: inserts.length });
  } catch (err: any) {
    console.error('[blog-generate-images]', err);
    return NextResponse.json({ ok: true, error: err.message }, { status: 200 });
  }
}
