import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import Anthropic from '@anthropic-ai/sdk';

/**
 * blog-subscription-alert — 신규 청약 공고 감지 → AI 분석글 자동 생성
 * 
 * 1. apt_subscriptions에서 최근 추가된 공고 확인
 * 2. 이미 분석글이 있는지 확인
 * 3. 없으면 AI로 분석글 자동 생성 + 발행
 */
async function handler() {
  const sb = getSupabaseAdmin();
  const results = { checked: 0, created: 0, skipped: 0 };

  // 1. 최근 7일 추가된 청약 공고
  const { data: newSubs } = await (sb as any).from('apt_subscriptions')
    .select('id, house_manage_no, name, region, supply_count, rcept_bgnde, rcept_endde, przwner_presnatn_de')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (!newSubs?.length) return { ...results, message: 'No new subscriptions' };
  results.checked = newSubs.length;

  for (const sub of newSubs) {
    // 2. 이미 분석글 존재하는지 확인
    const targetSlug = `apt-sub-analysis-${sub.house_manage_no}-2026`;
    const { data: existing } = await sb
      .from('blog_posts')
      .select('id')
      .eq('slug', targetSlug)
      .maybeSingle();

    if (existing) { results.skipped++; continue; }

    // 3. AI 분석글 생성
    try {
      const anthropic = new Anthropic();
      const prompt = `한국 아파트 청약 분석글을 작성해주세요.

단지명: ${sub.name}
지역: ${sub.region}
세대수: ${sub.supply_count}세대
접수기간: ${sub.rcept_bgnde} ~ ${sub.rcept_endde}
당첨발표: ${sub.przwner_presnatn_de || '미정'}

다음 구조로 3,000자 이상 작성:
1. 단지 기본 정보 (위치, 규모, 시공사)
2. 입지 분석 (교통, 학군, 편의시설)
3. 분양가 분석 및 주변 시세 비교
4. 가점 커트라인 예측 (과거 유사 단지 참고)
5. 청약 전략 (가점제 vs 추첨제)
6. FAQ 5개 (JSON 형식: [{q:"질문",a:"답변"}])

마크다운 형식, 한국어로 작성.`;

      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = (msg.content[0] as any).text || '';
      if (content.length < 1000) continue;

      // FAQ 추출
      const faqMatch = content.match(/\[[\s\S]*?\{[\s\S]*?q[\s\S]*?\}[\s\S]*?\]/);
      let faqJson = null;
      try { if (faqMatch) faqJson = JSON.parse(faqMatch[0]); } catch {}

      // 발행
      const title = `${sub.name} 청약 완전 분석 — ${sub.region} 일정·세대수·경쟁률·가점 전략 (2026)`;
      const metaDesc = `${sub.name} ${sub.region} 청약 분석. ${sub.supply_count}세대 모집, 접수 ${sub.rcept_bgnde}~${sub.rcept_endde}. 가점 커트라인 예측과 청약 전략.`;

      await sb.from('blog_posts').insert({
        slug: targetSlug,
        title,
        content,
        category: 'apt',
        is_published: true,
        author_id: 'system',
        view_count: 0,
        meta_description: metaDesc.slice(0, 160),
        cover_image: `/api/og?title=${encodeURIComponent(sub.name + ' 청약 분석')}&category=apt&author=${encodeURIComponent('카더라 부동산팀')}&design=2`,
        image_alt: `${sub.name} 청약 분석`,
        excerpt: metaDesc.slice(0, 100),
      });

      results.created++;
    } catch (e: any) {
      // 에러 시 다음 항목 계속
      continue;
    }
  }

  return results;
}

export const GET = withCronLogging('blog-subscription-alert', handler);
export const maxDuration = 120;
