import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';

const API_KEY = () => process.env.ANTHROPIC_API_KEY || '';
export const maxDuration = 120;

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('blog-subscription-alert', async () => {
    const sb = getSupabaseAdmin();
    if (!API_KEY()) return { processed: 0, failed: 1, metadata: { error: 'ANTHROPIC_API_KEY missing' } };

    const { data: newSubs } = await (sb as any).from('apt_subscriptions')
      .select('id, house_manage_no, name, region, supply_count, rcept_bgnde, rcept_endde, przwner_presnatn_de')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false }).limit(5);

    if (!newSubs?.length) return { processed: 0 };

    let created = 0, failed = 0;
    for (const sub of newSubs) {
      const slug = `apt-sub-analysis-${sub.house_manage_no}-2026`;
      const { data: existing } = await sb.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (existing) continue;

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY(), 'anthropic-version': ANTHROPIC_VERSION },
          body: JSON.stringify({
            model: AI_MODEL_HAIKU, max_tokens: 4000,
            messages: [{ role: 'user', content: `한국 아파트 청약 분석글. 단지: ${sub.name}, 지역: ${sub.region}, 세대수: ${sub.supply_count}, 접수: ${sub.rcept_bgnde}~${sub.rcept_endde}. 2500자+ 마크다운, 입지분석/분양가/가점예측/전략/FAQ5개 포함.` }],
          }),
        });
        if (!res.ok) { failed++; continue; }
        const data = await res.json();
        const content = data.content?.[0]?.text || '';
        if (content.length < 800) { failed++; continue; }

        const title = `${sub.name} 청약 완전 분석 — ${sub.region} 일정·세대수·가점 전략 (2026)`;
        const metaDesc = `${sub.name} ${sub.region} 청약 분석. ${sub.supply_count}세대, 접수 ${sub.rcept_bgnde}~${sub.rcept_endde}.`.slice(0, 160);
        await sb.from('blog_posts').insert({
          slug, title, content, category: 'apt', is_published: true, author_id: 'system', view_count: 0,
          meta_description: metaDesc,
          cover_image: `/api/og?title=${encodeURIComponent(sub.name + ' 청약 분석')}&category=apt&author=${encodeURIComponent('카더라 부동산팀')}&design=2`,
          image_alt: `${sub.name} 청약 분석`, excerpt: metaDesc.slice(0, 100),
        });
        created++;

        // 푸시 발송 (전체 구독자)
        try {
          const { sendPushBroadcast } = await import('@/lib/push-utils');
          await sendPushBroadcast({
            title: `🏢 ${sub.name} 청약 분석`,
            body: `${sub.region} ${sub.supply_count}세대 · 접수 ${sub.rcept_endde}까지`,
            url: `/blog/${slug}`,
            tag: `blog-sub-${sub.house_manage_no}`,
            image: `/api/og?title=${encodeURIComponent(sub.name + ' 청약 분석')}&category=apt&design=2`,
          });
        } catch {}
      } catch { failed++; }
    }

    return { processed: newSubs.length, created, failed, metadata: { api_name: 'anthropic', api_calls: created } };
  });
  return NextResponse.json({ ok: true, ...result });
});
