/**
 * [CI-v1 Phase 2] issue-fact-check — 드래프트 팩트 검증
 *
 * 대상:
 *   is_auto_publish = true
 *   AND is_processed = true
 *   AND fact_check_passed IS NULL
 *   AND detected_at > NOW() - 24h
 *   LIMIT 20
 *
 * 흐름:
 *   1) draft_title / draft_content / source_urls 기반 Claude Haiku fact-check
 *   2) confidence >= 65 → fact_check_passed=true, fact_check_confidence=N
 *   3) advance_issue_stage(id, 'fact_check')
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const runtime = 'nodejs';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const FACT_CHECK_MIN = 65;
const MAX_PER_RUN = 20;
const PREEMPT_MS = 240_000;

interface FactCheckOutcome {
  confidence: number;
  passed: boolean;
  issues: string[];
  notes?: string;
}

async function factCheckViaClaude(issue: any): Promise<FactCheckOutcome | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const draftPreview = String(issue.draft_content || '').slice(0, 6000);
  const summary = String(issue.summary || '').slice(0, 800);
  const sources = Array.isArray(issue.source_urls) ? issue.source_urls.slice(0, 5) : [];
  const keywords = Array.isArray(issue.detected_keywords) ? issue.detected_keywords.slice(0, 10) : [];
  const entities = Array.isArray(issue.related_entities) ? issue.related_entities.slice(0, 10) : [];
  const raw = JSON.stringify(issue.raw_data || {}).slice(0, 1500);

  const system = `당신은 한국 금융·부동산 콘텐츠의 팩트 검증 전문가입니다.
입력된 드래프트 기사에 대해 다음을 평가합니다:

1. 핵심 수치/날짜/지명/회사명이 요약/원본과 일치하는가
2. 과장·단정 표현 (반드시 오를/내릴, 목표가, 매수 추천 등) 여부
3. 최신성: 오래된 통계를 현재형으로 쓰고 있는지
4. 내부 링크·출처가 명시되어 있는지

0~100 점수를 매기고, JSON만 반환하세요.

응답 형식 (JSON만, 다른 텍스트 없이):
{
  "confidence": 0~100 정수,
  "issues": ["문제1", "문제2", ...],
  "notes": "한 줄 평"
}

판정 가이드:
- 80+: 매우 안전
- 65-79: 통과 기준
- 40-64: 보강 필요
- 0-39: 재작성 필요`;

  const user = `제목: ${issue.draft_title || issue.title}

요약: ${summary}

탐지 키워드: ${keywords.join(', ')}
관련 대상: ${entities.join(', ')}
원본 데이터(요약): ${raw}
출처 URL: ${sources.join(' | ')}

드래프트 본문(최초 6,000자):
${draftPreview}`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.content?.[0]?.text || '';
    if (!text) return null;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
    const issues: string[] = Array.isArray(parsed.issues) ? parsed.issues.map(String) : [];
    return {
      confidence,
      passed: confidence >= FACT_CHECK_MIN,
      issues,
      notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 300) : undefined,
    };
  } catch {
    return null;
  }
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('issue-fact-check', async () => {
      const sb = getSupabaseAdmin();
      const start = Date.now();

      const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();

      const { data: pending, error: fetchErr } = await (sb as any)
        .from('issue_alerts')
        .select('id, title, summary, draft_title, draft_content, detected_keywords, related_entities, source_urls, raw_data, category, final_score')
        .eq('is_auto_publish', true)
        .eq('is_processed', true)
        .is('fact_check_passed', null)
        .gte('detected_at', since24h)
        .order('final_score', { ascending: false })
        .limit(MAX_PER_RUN);

      if (fetchErr) {
        return { processed: 0, failed: 1, metadata: { error: fetchErr.message } };
      }
      if (!pending || pending.length === 0) {
        return { processed: 0, metadata: { message: 'no pending fact-check candidates' } };
      }

      let passed = 0;
      let blocked = 0;
      let failed = 0;
      const failures: string[] = [];
      const samples: any[] = [];

      for (const issue of pending as any[]) {
        if (Date.now() - start > PREEMPT_MS) break;

        try {
          // draft_content 최소 800자 미만 → 자동 블록 (팩트 검증 의미 없음)
          if (!issue.draft_content || String(issue.draft_content).length < 800) {
            await (sb as any)
              .from('issue_alerts')
              .update({
                fact_check_passed: false,
                fact_check_confidence: 0,
                fact_check_details: { issues: ['draft_too_short'], confidence: 0 },
                fact_check_at: new Date().toISOString(),
              })
              .eq('id', issue.id);
            blocked++;
            failures.push(`${issue.id}:draft_too_short`);
            continue;
          }

          const outcome = await factCheckViaClaude(issue);
          if (!outcome) {
            failures.push(`${issue.id}:claude_failed`);
            failed++;
            continue;
          }

          await (sb as any)
            .from('issue_alerts')
            .update({
              fact_check_passed: outcome.passed,
              fact_check_confidence: outcome.confidence,
              fact_check_details: {
                confidence: outcome.confidence,
                issues: outcome.issues,
                notes: outcome.notes,
                model: MODEL,
              },
              fact_check_at: new Date().toISOString(),
            })
            .eq('id', issue.id);

          if (outcome.passed) {
            passed++;
            try {
              await (sb as any).rpc('advance_issue_stage', {
                p_issue_id: issue.id,
                p_stage: 'fact_check',
              });
            } catch (stageErr: any) {
              failures.push(`${issue.id}:advance_failed:${stageErr?.message || ''}`);
            }
          } else {
            blocked++;
          }

          if (samples.length < 5) {
            samples.push({
              id: issue.id,
              title: String(issue.title || '').slice(0, 40),
              confidence: outcome.confidence,
              passed: outcome.passed,
            });
          }
        } catch (err: any) {
          failed++;
          failures.push(`${issue.id}:${err?.message || 'unknown'}`);
        }
      }

      return {
        processed: pending.length,
        created: passed,
        updated: blocked,
        failed,
        metadata: {
          passed,
          blocked,
          samples,
          sample_failures: failures.slice(0, 5),
          elapsed_ms: Date.now() - start,
        },
      };
    }, { redisLockTtlSec: 300 }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
