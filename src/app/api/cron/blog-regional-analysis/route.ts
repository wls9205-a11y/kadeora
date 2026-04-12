import { buildFinancePrompt, generateAndValidate } from '@/lib/blog-prompt-templates';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';

export const maxDuration = 300;

const REGIONS = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'];

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('blog-regional-analysis', async () => {
    const sb = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);
    let created = 0;

    for (const region of REGIONS) {
      const slug = `regional-apt-${encodeURIComponent(region)}-${month}`.replace(/%/g, '');
      const { data: ex } = await sb.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (ex) continue;

      // 해당 지역 단지 데이터 조회
      const { data: sites } = await (sb as any).from('apt_sites')
        .select('name,address,total_units,builder_name,move_in_date')
        .ilike('address', `%${region}%`)
        .eq('is_active', true)
        .order('total_units', { ascending: false })
        .limit(10);

      if (!sites || sites.length < 3) continue;

      const totalUnits = sites.reduce((a: number, s: any) => a + (s.total_units || 0), 0);
      const title = `${region} 아파트 시장 현황 ${month} — 주요 단지 분석`;

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
        content: aiResult.content,
        category: 'apt',
        tags: [region, '아파트', '시세', '부동산', '2026'],
        source_type: 'regional-analysis',
        cron_type: 'blog-regional-analysis',
        data_date: today,
        meta_description: generateMetaDesc(content, title, 'apt'),
        meta_keywords: generateMetaKeywords('apt', [region, '아파트', '시세']),
        sub_category: '부동산일반',
        seo_score: aiResult.score,
        seo_tier: aiResult.tier,
        is_published: true,
      });
      if (res.success) created++;
      if (created >= 3) break;
    }

    return { created };
  });
  return NextResponse.json(result, { status: 200 });
}
