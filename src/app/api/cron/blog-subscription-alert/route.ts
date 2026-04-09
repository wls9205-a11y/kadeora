import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';

const API_KEY = () => process.env.ANTHROPIC_API_KEY || '';

/**
 * blog-subscription-alert — 신규 청약 공고 감지 → AI 분석글 자동 생성
 */
async function handler() {
  const sb = getSupabaseAdmin();
  const results = { checked: 0, created: 0, skipped: 0, errors: [] as string[] };

  if (!API_KEY()) return { ...results, error: 'ANTHROPIC_API_KEY missing' };

  const { data: newSubs } = await (sb as any).from('apt_subscriptions')
    .select('id, house_manage_no, name, region, supply_count, rcept_bgnde, rcept_endde, przwner_presnatn_de')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (!newSubs?.length) return { ...results, message: 'No new subscriptions' };
  results.checked = newSubs.length;

  for (const sub of newSubs) {
    const targetSlug = `apt-sub-analysis-${sub.house_manage_no}-2026`;
    const { data: existing } = await sb.from('blog_posts').select('id').eq('slug', targetSlug).maybeSingle();
    if (existing) { results.skipped++; continue; }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY(), 'anthropic-version': ANTHROPIC_VERSION },
        body: JSON.stringify({
          model: AI_MODEL_HAIKU,
          max_tokens: 4000,
          messages: [{ role: 'user', content: `한국 아파트 청약 분석글을 작성해주세요.

단지명: ${sub.name}
지역: ${sub.region}
세대수: ${sub.supply_count}세대
접수기간: ${sub.rcept_bgnde} ~ ${sub.rcept_endde}
당첨발표: ${sub.przwner_presnatn_de || '미정'}

다음 구조로 2,500자 이상 마크다운으로 작성:
1. 단지 기본 정보
2. 입지 분석 (교통, 학군, 편의시설)
3. 분양가 분석 및 주변 시세 비교
4. 가점 커트라인 예측
5. 청약 전략 추천
6. FAQ 5개

한국어, 마크다운 형식.` }],
        }),
      });

      if (!res.ok) { results.errors.push(`API ${res.status}`); continue; }
      const data = await res.json();
      const content = data.content?.[0]?.text || '';
      if (content.length < 800) continue;

      const title = `${sub.name} 청약 완전 분석 — ${sub.region} 일정·세대수·경쟁률·가점 전략 (2026)`;
      const metaDesc = `${sub.name} ${sub.region} 청약 분석. ${sub.supply_count}세대, 접수 ${sub.rcept_bgnde}~${sub.rcept_endde}. 가점 커트라인 예측과 전략.`.slice(0, 160);

      await sb.from('blog_posts').insert({
        slug: targetSlug, title, content, category: 'apt', is_published: true,
        author_id: 'system', view_count: 0, meta_description: metaDesc,
        cover_image: `/api/og?title=${encodeURIComponent(sub.name + ' 청약 분석')}&category=apt&author=${encodeURIComponent('카더라 부동산팀')}&design=2`,
        image_alt: `${sub.name} 청약 분석`, excerpt: metaDesc.slice(0, 100),
      });
      results.created++;
    } catch (e: any) {
      results.errors.push(e.message?.slice(0, 100));
    }
  }
  return results;
}

export const GET = withCronLogging('blog-subscription-alert', handler);
export const maxDuration = 120;
