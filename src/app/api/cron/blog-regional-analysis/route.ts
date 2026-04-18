import { buildFinancePrompt, generateAndValidate } from '@/lib/blog-prompt-templates';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

const REGIONS = ['서울', '경기', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '경북', '경남', '전북', '전남', '제주'];

export async function GET(_req: NextRequest) {
  // 세션 138: 7일 38회 실행 / 0 processed / 평균 52초 (~33분 누적). 월별 지역 리포트 이미 다 발행됨.
  return NextResponse.json({ ok: true, disabled: true, reason: 'session-138: 0 processed in 7d, regional reports exhausted' });

  // eslint-disable-next-line no-unreachable
  const result = await withCronLogging('blog-regional-analysis', async () => {
    const sb = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);
    let created = 0;
    let aiCalls = 0;
    const MAX_AI_CALLS = 1; // 타임아웃 완전 방지: 1회로 제한

    // 날짜 기반 오프셋 → 매일 다른 지역부터 시작 (17일이면 전체 순환)
    const dayOfMonth = new Date().getDate();
    const offset = dayOfMonth % REGIONS.length;

    for (let i = 0; i < REGIONS.length; i++) {
      if (created >= 2 || aiCalls >= MAX_AI_CALLS) break;
      const region = REGIONS[(i + offset) % REGIONS.length];
      const slug = `regional-market-${region}-${month}`;
      const { data: ex } = await sb.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (ex) continue;

      const title = `${region} 부동산 시장 동향 ${month} — 실거래가·미분양·청약 분석`;
      const links = [
        '[전체 청약 일정 →](/apt)', '[미분양 현황 →](/apt?tab=unsold)',
        `[${region} 블로그 →](/blog?category=apt)`, '[취득세 계산기 →](/calc/real-estate/acquisition-tax)',
        '[커뮤니티 →](/feed)',
      ];
      const prompt = buildFinancePrompt(title, 'apt', links);
      aiCalls++;
      const aiResult = await generateAndValidate(prompt, 'apt');
      if (!aiResult) continue;

      const res = await safeBlogInsert(sb, {
        slug, title, content: aiResult.content, category: 'apt',
        tags: [region, '부동산', '시장 동향', '실거래', month],
        source_type: 'regional-analysis', cron_type: 'blog-regional-analysis', data_date: today,
        meta_description: generateMetaDesc(aiResult.content, title, 'apt'),
        meta_keywords: generateMetaKeywords('apt', [region, '부동산', '시장']),
        is_published: true,
      });
      if (res.success) created++;
      if (created >= 2) break;
    }
    return { created };
  });
  return NextResponse.json(result, { status: 200 });
}
