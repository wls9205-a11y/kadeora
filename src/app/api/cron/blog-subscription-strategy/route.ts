import { diversifyPrompt } from '@/lib/blog-prompt-diversity';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-subscription-strategy', async () => {
    const supabase = getSupabaseAdmin();
    if (!process.env.ANTHROPIC_API_KEY) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_api_key' } };

    const now = new Date();
    const nextWeek = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    const { data: upcoming } = await supabase.from('apt_subscriptions')
      .select('house_nm, house_manage_no, region_nm, hssply_adres, tot_supply_hshld_co, rcept_bgnde, rcept_endde, constructor_nm')
      .gte('rcept_bgnde', today).lte('rcept_bgnde', nextWeek)
      .order('rcept_bgnde', { ascending: true }).limit(10);

    const { data: ongoing } = await supabase.from('apt_subscriptions')
      .select('house_nm, region_nm, tot_supply_hshld_co, rcept_bgnde, rcept_endde, constructor_nm')
      .lte('rcept_bgnde', today).gte('rcept_endde', today).limit(5);

    const allApts = [...(upcoming || []), ...(ongoing || [])];
    if (allApts.length < 2) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'not_enough_data' } };

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: existing } = await supabase.from('blog_posts')
      .select('id').eq('is_published', true)
      .ilike('title', '%청약%전략%')
      .gte('published_at', weekAgo).limit(1);
    if (existing?.length) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'already_exists' } };

    const monthWeek = `${now.getMonth() + 1}월 ${Math.ceil(now.getDate() / 7)}째주`;
    const aptList = allApts.map(a =>
      `- ${a.house_nm} (${a.region_nm}): ${a.tot_supply_hshld_co}세대, 접수 ${a.rcept_bgnde}~${a.rcept_endde}, 시공 ${a.constructor_nm || '미정'}`
    ).join('\n');

    const prompt = diversifyPrompt(`한국 부동산 투자 정보 플랫폼 '카더라'의 청약 전략 가이드 블로그를 작성하세요.
${monthWeek} 청약 현황:
${aptList}
접수 예정 ${(upcoming || []).length}건, 접수 중 ${(ongoing || []).length}건

규칙: 위 현장명/세대수/일정 본문에 포함, 2000자 이상, h2 4개(이번 주 일정/주목 현장/당첨 전략/주의사항), 가점제/추첨제 팁 포함, ✅📌⚠️ 이모지 활용, 마크다운.
JSON만: {"title":"제목(40자이내)","content":"마크다운본문","excerpt":"요약(100자이내)","tags":["태그1","태그2"]}`);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 5000, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) { if (res.status === 529 || res.status === 402) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'anthropic_credit_exhausted' } }; return { processed: 1, created: 0, failed: 1 }; }
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return { processed: 1, created: 0, failed: 1 };
      const parsed = JSON.parse(match[0]);
      if (!parsed.title || !parsed.content) return { processed: 1, created: 0, failed: 1 };

      const content = ensureMinLength(parsed.content, 'apt', 2000);
      const slug = `subscription-strategy-${now.toISOString().slice(0, 10)}-${Date.now().toString(36)}`;

      const inserted = await safeBlogInsert(supabase, {
        title: parsed.title, slug, content,
        excerpt: parsed.excerpt || parsed.title,
        category: 'apt',
        tags: parsed.tags || ['청약', '전략'],
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('apt', parsed.tags),
        source_type: 'ai',
        source_ref: `sub-strategy-${now.toISOString().slice(0, 10)}`,
      });
      return { processed: 1, created: inserted.success ? 1 : 0, failed: 0 };
    } catch {
      return { processed: 1, created: 0, failed: 1 };
    }
  });

  return NextResponse.json({ ok: true, ...result });
}
