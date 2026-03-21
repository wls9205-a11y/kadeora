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

    // 3. 같은 지역 청약 비교 콘텐츠
    const slug3 = `apt-compare-${weekStr}`;
    const { data: e3 } = await admin.from('blog_posts').select('id').eq('slug', slug3).maybeSingle();
    if (!e3) {
      const { data: allApts } = await admin.from('apt_subscriptions')
        .select('house_nm, region_nm, house_manage_no, tot_supply_hshld_co, rcept_bgnde, rcept_endde')
        .order('rcept_bgnde', { ascending: false }).limit(20);
      // 같은 지역 페어 찾기
      const byRegion: Record<string, any[]> = {};
      (allApts ?? []).forEach(a => { const r = a.region_nm; if (!byRegion[r]) byRegion[r] = []; byRegion[r].push(a); });
      const pair = Object.entries(byRegion).find(([, v]) => v.length >= 2);
      if (pair) {
        const [region, items] = pair;
        const [a, b] = items;
        const cmpTitle = `${a.house_nm} vs ${b.house_nm} — ${region} 청약 비교`;
        const cmpContent = `## ${cmpTitle}\n\n| 항목 | ${a.house_nm} | ${b.house_nm} |\n|---|---|---|\n| 지역 | ${region} | ${region} |\n| 세대수 | ${(a.tot_supply_hshld_co ?? 0).toLocaleString()} | ${(b.tot_supply_hshld_co ?? 0).toLocaleString()} |\n| 접수 | ${a.rcept_bgnde?.slice(5) ?? '-'} ~ ${a.rcept_endde?.slice(5) ?? '-'} | ${b.rcept_bgnde?.slice(5) ?? '-'} ~ ${b.rcept_endde?.slice(5) ?? '-'} |\n\n---\n\n[${a.house_nm} 상세 →](/apt/${a.house_manage_no})\n[${b.house_nm} 상세 →](/apt/${b.house_manage_no})\n[${region} 청약 전체 →](/apt)\n\n> 청약홈 공공데이터 기반.`;
        await admin.from('blog_posts').insert({ slug: slug3, title: cmpTitle, content: cmpContent, excerpt: `${region} 두 청약 단지 비교.`, category: 'apt', tags: [a.house_nm, b.house_nm, `${region} 청약`, '청약비교'], source_type: 'auto', cron_type: 'weekly', cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(cmpTitle)}&type=blog` });
        created++;
      }
    }

    // 4. FAQ 자동 생성 (질문형 인기 글)
    const slug4 = `faq-${weekStr}`;
    const { data: e4 } = await admin.from('blog_posts').select('id').eq('slug', slug4).maybeSingle();
    if (!e4) {
      const weekAgo2 = new Date(Date.now() - 14 * 86400000).toISOString();
      const { data: qPosts } = await admin.from('posts')
        .select('title, slug, id, likes_count')
        .eq('is_deleted', false).gte('created_at', weekAgo2)
        .ilike('title', '%?%').order('likes_count', { ascending: false }).limit(8);
      if (qPosts && qPosts.length >= 3) {
        const faqItems = qPosts.map(q => `### Q. ${q.title}\n\n자세한 답변은 [원문 보기 →](/feed/${q.slug || q.id})에서 확인하세요.\n`).join('\n');
        const faqContent = `## 자주 묻는 질문 (${weekStr})\n\n${faqItems}\n---\n\n[카더라 피드 →](/feed)\n\n> 커뮤니티 인기 질문 기반 자동 생성.`;
        await admin.from('blog_posts').insert({ slug: slug4, title: `자주 묻는 질문 — 청약·주식·부동산 (${weekStr})`, content: faqContent, excerpt: '커뮤니티에서 가장 많이 물어본 질문 모음.', category: 'general', tags: ['FAQ', '자주묻는질문', '청약', '주식'], source_type: 'auto', cron_type: 'weekly', cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent('자주 묻는 질문')}&type=blog` });
        created++;
      }
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    console.error('[blog-weekly]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
