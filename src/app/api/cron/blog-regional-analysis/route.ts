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

      const content = `## ${region} 아파트 시장 개요

${region} 지역의 주요 아파트 단지 ${sites.length}곳을 분석합니다. 총 ${totalUnits.toLocaleString()}세대 규모입니다.

## 주요 단지 현황

${sites.map((s: any, i: number) => `### ${i + 1}. ${s.name}
- **위치**: ${s.address || region}
- **세대수**: ${(s.total_units || 0).toLocaleString()}세대
- **시공사**: ${s.builder_name || '미정'}
${s.move_in_date ? `- **입주 예정**: ${s.move_in_date}` : ''}
`).join('\n')}

## ${region} 부동산 전망

2026년 ${region} 부동산 시장은 공급 물량과 대출 규제에 따라 지역별로 차별화된 흐름을 보일 것으로 전망됩니다.

## 관련 정보

- [${region} 청약 정보](${SITE_URL}/apt/region/${encodeURIComponent(region)})
- [전국 아파트 지도](${SITE_URL}/apt/map)
- [청약 가점 계산기](${SITE_URL}/calc/real-estate/subscription-score)
`;

      const res = await safeBlogInsert(sb, {
        slug,
        title,
        content,
        category: 'apt',
        tags: [region, '아파트', '시세', '부동산', '2026'],
        source_type: 'regional-analysis',
        cron_type: 'blog-regional-analysis',
        data_date: today,
        meta_description: generateMetaDesc(content, title, 'apt'),
        meta_keywords: generateMetaKeywords('apt', [region, '아파트', '시세']),
        is_published: true,
      });
      if (res.success) created++;
      if (created >= 3) break;
    }

    return { created };
  });
  return NextResponse.json(result, { status: 200 });
}
