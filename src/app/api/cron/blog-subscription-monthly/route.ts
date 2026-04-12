import { buildFinancePrompt, generateAndValidate } from '@/lib/blog-prompt-templates';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';

export const maxDuration = 300;

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('blog-subscription-monthly', async () => {
    const sb = getSupabaseAdmin();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = `${year}년 ${month}월`;
    const slug = `subscription-schedule-${year}-${String(month).padStart(2, '0')}`;

    // 중복 체크
    const { data: ex } = await sb.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
    if (ex) return { created: 0, reason: 'already_exists' };

    // 이번달 + 다음달 청약 조회
    const { data: subs } = await (sb as any).from('apt_subscriptions')
      .select('house_manage_no,house_nm,hssply_adres,tot_suply_hshldco,rcept_bgnde,rcept_endde,przwner_presnatn_de')
      .gte('rcept_bgnde', `${year}${String(month).padStart(2, '0')}01`)
      .lte('rcept_bgnde', `${year}${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}28`)
      .order('rcept_bgnde', { ascending: true })
      .limit(30);

    const title = `${monthStr} 청약 일정 총정리 — 주요 단지·접수기간·당첨 발표일`;
    const subList = (subs || []).map((s: any) => {
      const bgnDate = s.rcept_bgnde ? `${s.rcept_bgnde.slice(0,4)}.${s.rcept_bgnde.slice(4,6)}.${s.rcept_bgnde.slice(6,8)}` : '미정';
      const endDate = s.rcept_endde ? `${s.rcept_endde.slice(0,4)}.${s.rcept_endde.slice(4,6)}.${s.rcept_endde.slice(6,8)}` : '미정';
      return `### ${s.house_nm}
- **위치**: ${s.hssply_adres || '미정'}
- **세대수**: ${(s.tot_suply_hshldco || 0).toLocaleString()}세대
- **접수기간**: ${bgnDate} ~ ${endDate}
${s.przwner_presnatn_de ? `- **당첨 발표**: ${s.przwner_presnatn_de.slice(0,4)}.${s.przwner_presnatn_de.slice(4,6)}.${s.przwner_presnatn_de.slice(6,8)}` : ''}`;
    }).join('\n\n');

      // AI 생성 (하드코딩 → 완성형)
      const links = [
        '[무료 계산기 모음 →](/calc)',
        '[부동산 정보 →](/apt)',
        '[카더라 블로그 →](/blog?category=apt)',
        '[커뮤니티 →](/feed)',
        '[주식 시세 →](/stock)',
      ];
      const prompt = buildFinancePrompt(topic.title || calc?.title || '', 'apt', links);
      const aiResult = await generateAndValidate(prompt, 'apt');
      if (!aiResult) continue;

    const res = await safeBlogInsert(sb, {
      slug,
      title,
      content,
      category: 'apt',
      tags: ['청약', `${month}월 청약`, '청약 일정', '아파트 분양', '2026'],
      source_type: 'subscription-monthly',
      cron_type: 'blog-subscription-monthly',
      data_date: now.toISOString().slice(0, 10),
      meta_description: generateMetaDesc(content, title, 'apt'),
      meta_keywords: generateMetaKeywords('apt', ['청약', `${month}월`, '일정']),
      is_published: true,
    });

    return { created: res.success ? 1 : 0 };
  });
  return NextResponse.json(result, { status: 200 });
}
