import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const weekStr = new Date().toISOString().slice(0, 10);
    let created = 0;

    // 1. 이번 주 청약 일정
    const slug1 = `apt-weekly-${weekStr}`;
    const { data: e1 } = await admin.from('blog_posts').select('id').eq('slug', slug1).maybeSingle();
    if (!e1) {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const { data: apts } = await admin.from('apt_subscriptions')
        .select('house_nm, region_nm, rcept_bgnde, rcept_endde, tot_supply_hshld_co, house_manage_no')
        .gte('rcept_endde', today).lte('rcept_bgnde', nextWeek).order('rcept_bgnde').limit(10);

      const table = (apts ?? []).map(a => `| [${a.house_nm}](/apt/${a.house_manage_no}) | ${a.region_nm} | ${a.rcept_bgnde?.slice(5)} ~ ${a.rcept_endde?.slice(5)} | ${(a.tot_supply_hshld_co ?? 0).toLocaleString()} |`).join('\n');
      const content = `## 이번 주 청약 일정 (${weekStr})\n\n| 단지명 | 지역 | 접수 기간 | 세대수 |\n|---|---|---|---|\n${table || '| 이번 주 접수 예정 청약이 없습니다 | | | |'}\n\n---\n\n[전체 청약 일정 보기 →](/apt)\n[청약 마감 알림 받기 →](/login)\n\n> 청약홈 공공데이터 기반. 정확한 정보는 청약홈에서 확인하세요.`;

      await admin.from('blog_posts').insert({ slug: slug1, title: `이번 주 아파트 청약 일정 총정리 (${weekStr})`, content, excerpt: `이번 주 접수 예정/진행 중인 청약 ${(apts ?? []).length}건 정리.`, category: 'apt', tags: ['청약일정', '이번주청약', '아파트분양'], source_type: 'auto' });
      created++;
    }

    // 2. HOT 게시글 주간 정리
    const slug2 = `hot-weekly-${weekStr}`;
    const { data: e2 } = await admin.from('blog_posts').select('id').eq('slug', slug2).maybeSingle();
    if (!e2) {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: hot } = await admin.from('posts')
        .select('id, title, slug, likes_count, comments_count, category')
        .eq('is_deleted', false).gte('created_at', weekAgo)
        .order('likes_count', { ascending: false }).limit(5);

      const list = (hot ?? []).map((p, i) => `${i + 1}. [${p.title}](/feed/${p.slug || p.id}) — 좋아요 ${p.likes_count} · 댓글 ${p.comments_count}`).join('\n');
      const content = `## 이번 주 HOT 게시글 TOP 5\n\n${list || '이번 주 인기 게시글이 없습니다.'}\n\n---\n\n[HOT 페이지 보기 →](/hot)\n[피드에서 토론 참여 →](/feed)\n\n> 카더라 커뮤니티 좋아요 기준 집계.`;

      await admin.from('blog_posts').insert({ slug: slug2, title: `이번 주 카더라 HOT 게시글 TOP 5 (${weekStr})`, content, excerpt: '이번 주 커뮤니티에서 가장 인기 있던 게시글 TOP 5.', category: 'general', tags: ['HOT', '인기글', '커뮤니티'], source_type: 'auto' });
      created++;
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    console.error('[blog-weekly]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
