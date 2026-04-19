/**
 * [AUTO-PILLAR-DRAFT] big_event → Pillar draft 자동 생성
 *
 * 조건:
 *  - is_active=true AND pillar_blog_post_id IS NULL
 *  - fact_confidence_score >= 70 (publish gate 대비 여유 확보)
 *
 * 동작:
 *  - Anthropic API로 Pillar draft 생성 (삼익비치 구조 템플릿)
 *  - system prompt 최상단에 [절대 팩트 고정] 블록 주입 (P0-FACT 패턴 계승)
 *  - safeBlogInsert로 is_published=false 저장
 *  - big_event_registry.pillar_blog_post_id 연결
 *  - Node 알림톡: "Pillar draft 생성 — {name} 검수 필요"
 *
 * 주 2회 pg_cron, 실행당 최대 2건 (품질 유지).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { sendKakaoAlimtalk } from '@/lib/kakao-alimtalk';
import { NotificationBellService } from '@/lib/notification-bell';
import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';

export const maxDuration = 300;
export const runtime = 'nodejs';

const MAX_DRAFTS_PER_RUN = 2;
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const NOTIFY_TEMPLATE_ID = process.env.SOLAPI_TEMPLATE_DRAFT_READY || '';
const NOTIFY_PHONE = process.env.NODE_NOTIFY_PHONE || '';

function buildFactBlock(ev: any): string {
  const constructors = Array.isArray(ev.key_constructors) ? ev.key_constructors.join(', ') : (ev.key_constructors || '미정');
  const scale = ev.scale_after ? `${ev.scale_before ?? '?'} → ${ev.scale_after}+세대` : `${ev.scale_before ?? '?'}세대`;
  const brand = ev.new_brand_name ? `${ev.new_brand_name} (${ev.constructor_status || 'unconfirmed'})` : '미정 (수주 전)';
  const sources = Array.isArray(ev.fact_sources) ? ev.fact_sources.join(' · ') : '카더라 내부 노트';
  return [
    '[절대 팩트 고정 - 바꾸지 말 것]',
    `- 이름: ${ev.name}${ev.full_name ? ` (${ev.full_name})` : ''}`,
    `- 지역: ${ev.region_sido || ''} ${ev.region_sigungu || ''} ${ev.region_dong || ''}`.trim(),
    `- 준공: ${ev.build_year_before ?? '미상'}년`,
    `- 세대: ${scale}`,
    `- 재건축 후 브랜드: ${brand}`,
    `- 시공사: ${constructors}`,
    `- 현 Stage: ${ev.stage ?? '미정'} / 예상 완공: ${ev.build_year_after_est ?? '미정'}`,
    `- 비고: ${ev.notes || ''}`,
    `- 출처: ${sources}`,
    '⚠️ 위 정보를 그대로 인용. 다른 브랜드명/시공사/세대수로 바꾸지 말 것.',
    '⚠️ 확정되지 않은 정보(분양가·완공일 등)는 "추정"·"예상"·"시나리오"임을 명시할 것.',
  ].join('\n');
}

async function generatePillar(ev: any): Promise<{ title: string; content: string; slug: string; meta: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const factBlock = buildFactBlock(ev);
  const systemPrompt = `${factBlock}

당신은 카더라(kadeora.app)의 수석 데이터 에디터입니다. 대형 재건축/재개발 이벤트 Pillar 글을 작성합니다.

규칙:
- 분량: 6,000~8,000자 (Pillar 심층 분석)
- H2 섹션: 7~10개 (## 형식)
- 마크다운 표 최소 3개
- FAQ 섹션 필수 (10개)
- 내부 링크 5+ 개 (/apt, /apt/complex, /apt/big-events, /apt/diagnose 등)
- 팩트는 위 [절대 팩트 고정] 블록 인용. 추정·예상은 반드시 명시.
- 본문에 이미지 마크다운 삽입 금지 (자동 주입)`;

  const userPrompt = `대상 이벤트: ${ev.name} (${ev.region_sido || ''} ${ev.region_sigungu || ''}) ${ev.event_type || '재건축'}

요구사항:
1. 도입부: 핵심 팩트 3줄 + 투자자 관점 1줄
2. Stage 상세 설명 + 남은 단계 일정
3. 세대수·브랜드·시공사 표 1개
4. 예상 분양가 시나리오 3종 (보수/중립/낙관) 표 1개
5. 조합원 관점 혜택/의무 요약
6. 일반 투자자 관점 리스크 + 기회
7. FAQ 10개
8. 관련 링크 (Spoke 자리표시자 포함)

출력 (JSON만, 다른 텍스트 금지):
{
  "title": "45~55자 제목, 감정후크 + 숫자 포함",
  "slug": "영문/한글 URL-safe slug",
  "meta": "meta_description 80~160자",
  "content": "마크다운 본문 전체"
}`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
      body: JSON.stringify({ model: AI_MODEL_HAIKU, max_tokens: 12000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      console.error(`[auto-pillar-draft] AI API ${res.status}`);
      return null;
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    if (!text) return null;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!parsed?.title || !parsed?.content || parsed.content.length < 3000) return null;
    return {
      title: String(parsed.title).slice(0, 80),
      content: String(parsed.content),
      slug: String(parsed.slug || `${ev.slug}-pillar-${Date.now()}`).slice(0, 90),
      meta: String(parsed.meta || '').slice(0, 170),
    };
  } catch (err: any) {
    console.error('[auto-pillar-draft] gen error:', err?.message);
    return null;
  }
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('big-event-auto-pillar-draft', async () => {
      const sb = getSupabaseAdmin();

      const { data: events } = await (sb as any)
        .from('big_event_registry')
        .select('id, slug, name, full_name, region_sido, region_sigungu, region_dong, event_type, stage, scale_before, scale_after, build_year_before, build_year_after_est, key_constructors, new_brand_name, constructor_status, fact_sources, notes, fact_confidence_score, priority_score')
        .eq('is_active', true)
        .is('pillar_blog_post_id', null)
        .gte('fact_confidence_score', 70)
        .order('priority_score', { ascending: false, nullsFirst: false })
        .limit(MAX_DRAFTS_PER_RUN * 2);

      if (!events || events.length === 0) {
        return { processed: 0, created: 0, metadata: { message: 'no eligible events (fact_confidence >= 70 + pillar null)' } };
      }

      let created = 0;
      let failed = 0;
      const notes: string[] = [];

      for (const ev of events as any[]) {
        if (created >= MAX_DRAFTS_PER_RUN) break;
        try {
          const gen = await generatePillar(ev);
          if (!gen) {
            failed++;
            notes.push(`${ev.id}:gen-failed`);
            continue;
          }

          const result = await safeBlogInsert(sb as any, {
            slug: gen.slug,
            title: gen.title,
            content: gen.content,
            category: 'apt',
            sub_category: ev.event_type || '재건축',
            tags: [ev.name, ev.region_sigungu, ev.event_type, ev.new_brand_name].filter(Boolean) as string[],
            source_type: 'auto_big_event_pillar',
            cron_type: 'big-event-auto-pillar-draft',
            source_ref: (Array.isArray(ev.fact_sources) ? ev.fact_sources[0] : '') || '',
            meta_description: gen.meta,
            meta_keywords: [ev.name, ev.region_sigungu, ev.event_type, '재건축', '분석'].filter(Boolean).join(','),
            cover_image: null,
            image_alt: `${ev.name} ${ev.event_type || '재건축'}`,
            is_published: false,
          } as any);

          if (!result.success) {
            failed++;
            notes.push(`${ev.id}:insert-${result.reason || 'failed'}`);
            continue;
          }

          const newId = result.id ? Number(result.id) : null;
          if (newId) {
            await (sb as any)
              .from('big_event_registry')
              .update({ pillar_blog_post_id: newId, updated_at: new Date().toISOString() })
              .eq('id', ev.id);
          }

          created++;
          notes.push(`${ev.id}:ok:${gen.slug}`);

          // [NOTIFY-BELL] 앱 내 벨 먼저 (무료·실시간)
          try {
            await NotificationBellService.pushDraftReady({
              name: ev.name,
              phase: 'Pillar',
              region: `${ev.region_sido || ''} ${ev.region_sigungu || ''}`.trim(),
              slug: gen.slug,
            });
          } catch { /* ignore */ }

          if (NOTIFY_TEMPLATE_ID && NOTIFY_PHONE) {
            try {
              await sendKakaoAlimtalk({
                phone: NOTIFY_PHONE.replace(/[^0-9]/g, ''),
                templateId: NOTIFY_TEMPLATE_ID,
                variables: {
                  '#{name}': ev.name,
                  '#{phase}': 'Pillar',
                  '#{region}': `${ev.region_sido || ''} ${ev.region_sigungu || ''}`.trim(),
                  '#{slug}': gen.slug,
                },
              });
            } catch { /* notify 실패해도 draft는 유지 */ }
          }
        } catch (err: any) {
          failed++;
          notes.push(`${ev.id}:exception:${err?.message || 'unknown'}`);
        }
      }

      return {
        processed: events.length,
        created,
        failed,
        metadata: { notes: notes.slice(0, 10), max_per_run: MAX_DRAFTS_PER_RUN },
      };
    }, { redisLockTtlSec: 600 }),
  );
}

export const GET = withCronAuth(handler);
