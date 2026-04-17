/**
 * calc-topic-refresh — 계산기 토픽 클러스터 AI 갱신
 *
 * 주 1회 실행 (일요일 새벽)
 * 1. blog_post_ids 자동 매칭 (related_keywords ↔ blog 제목/본문)
 * 2. last_refreshed_at 30일 지난 토픽에 대해 AI 로 intro_html / faqs / meta_description 생성
 * 3. 검색량 업데이트는 수동 (네이버 키워드 도구는 비공개 API)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getConfig, getAIModel, shouldUsePromptCache } from '@/lib/app-config';
import { ANTHROPIC_VERSION } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface Topic {
  topic_slug: string;
  topic_label: string;
  related_keywords: string[];
  calc_slugs: string[];
  blog_post_ids: number[];
  last_refreshed_at: string | null;
}

async function doWork() {
  const sb = getSupabaseAdmin();

  // 마스터 킬
  const kill = await getConfig('master_kill', { all_crons_paused: false });
  if (kill.all_crons_paused) {
    return { processed: 0, metadata: { reason: 'master_kill' } };
  }

  const cfg = await getConfig('calc_seo', { topic_refresh_days: 30 });
  const refreshThresholdMs = cfg.topic_refresh_days * 86400 * 1000;

  // 검색량 높은 순으로 20개씩 처리
  const { data: topics } = await (sb as any).from('calc_topic_clusters')
    .select('topic_slug, topic_label, related_keywords, calc_slugs, blog_post_ids, last_refreshed_at')
    .eq('is_published', true)
    .order('search_volume_naver', { ascending: false })
    .limit(20);

  if (!topics?.length) return { processed: 0, metadata: { reason: 'no_topics' } };

  const model = await getAIModel('haiku');
  const useCache = await shouldUsePromptCache();

  let updated = 0;
  let aiCalls = 0;
  const errors: string[] = [];

  for (const topic of topics as Topic[]) {
    try {
      // 1) 블로그 자동 매칭
      const keywords = (topic.related_keywords || []).slice(0, 5);
      const orQuery = keywords.map(k => `title.ilike.%${k}%,excerpt.ilike.%${k}%`).join(',');
      const { data: matched } = orQuery
        ? await sb.from('blog_posts')
            .select('id, view_count')
            .or(orQuery)
            .eq('is_published', true)
            .order('view_count', { ascending: false })
            .limit(20)
        : { data: [] };
      const blogIds = (matched || []).map((b: any) => b.id);

      // 2) AI 콘텐츠 갱신 (조건 충족 시만)
      const needsRefresh = !topic.last_refreshed_at ||
        (Date.now() - new Date(topic.last_refreshed_at).getTime() > refreshThresholdMs);

      let aiResult: any = null;
      if (needsRefresh) {
        try {
          aiResult = await callAI(topic, model, useCache);
          aiCalls++;
        } catch (e: any) {
          errors.push(`${topic.topic_slug}: AI ${e.message?.slice(0, 80)}`);
        }
      }

      const updates: any = {
        blog_post_ids: blogIds,
        updated_at: new Date().toISOString(),
      };
      if (aiResult) {
        updates.intro_html = aiResult.intro_html || null;
        updates.faqs = aiResult.faqs || [];
        updates.meta_description = aiResult.meta_description || null;
        updates.last_refreshed_at = new Date().toISOString();
      }

      await (sb as any).from('calc_topic_clusters')
        .update(updates)
        .eq('topic_slug', topic.topic_slug);

      updated++;
    } catch (e: any) {
      errors.push(`${topic.topic_slug}: ${e.message?.slice(0, 80)}`);
    }
  }

  return {
    processed: updated,
    metadata: { aiCalls, errors: errors.slice(0, 10) },
  };
}

async function callAI(topic: Topic, model: string, useCache: boolean): Promise<{
  intro_html: string;
  faqs: Array<{ q: string; a: string }>;
  meta_description: string;
}> {
  const promptText = `한국 "${topic.topic_label}" 종합 가이드 페이지의 콘텐츠를 작성합니다.

## 키워드
- 대표: ${topic.topic_label}
- 관련: ${(topic.related_keywords || []).join(', ')}

## 출력 형식 (반드시 JSON only, 다른 설명 없이)
{
  "intro_html": "<p>...</p><p>...</p>",
  "faqs": [{"q":"...","a":"..."},{"q":"...","a":"..."}],
  "meta_description": "..."
}

## 작성 규칙
1. intro_html: 250~350자 HTML (<p>2개). 첫 문장은 핵심 수치나 정의로 시작 (보일러플레이트 금지). 2026년 최신 기준.
2. faqs: 5개. 각 답변 200자 이내. 실무에서 진짜 궁금한 것.
3. meta_description: 130자 이내, 키워드 자연스럽게 포함.
4. 일반론 금지. 구체 수치·법령 조항 인용.
5. 카더라 자체 언급 금지. 경쟁 서비스 언급 금지.
6. 카테고리: 부동산/세금/금융 — 따라 어조 맞춰서.`;

  const messages = useCache
    ? [{
        role: 'user',
        content: [
          { type: 'text', text: promptText, cache_control: { type: 'ephemeral' } },
        ],
      }]
    : [{ role: 'user', content: promptText }];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2500,
      messages,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`anthropic_${res.status}: ${errText.slice(0, 200)}`);
  }

  const d = await res.json();
  const text = d.content?.[0]?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('no_json_in_response');
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    intro_html: parsed.intro_html || '',
    faqs: Array.isArray(parsed.faqs) ? parsed.faqs : [],
    meta_description: parsed.meta_description || '',
  };
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('calc-topic-refresh', doWork);
  return NextResponse.json(result);
});
