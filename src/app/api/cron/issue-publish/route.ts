/**
 * [CI-v1 Phase 2] issue-publish — check_publish_gate 통과 시 blog_posts 공개 전환
 *
 * 대상:
 *   seo_enriched_at IS NOT NULL
 *   AND blog_post_id IS NOT NULL
 *   AND is_published = false
 *   LIMIT 20
 *
 * 동작:
 *   1) publish_attempted_at 스탬프 (미리)
 *   2) check_publish_gate(post_id) → allowed=true 이면 발행
 *   3) blog_posts UPDATE is_published=true, published_at=NOW() → trg_blog_publish_indexnow 가 indexnow 큐 enqueue
 *   4) issue_alerts.is_published=true, published_at=NOW(), publish_decision='auto_published'
 *   5) advance_issue_stage(id, 'publish')
 *
 * 게이트 실패 시:
 *   - block_reason 에 reasons 기록
 *   - publish_decision='gate_blocked'
 *   - is_published 유지 (다음 실행에서 재시도 가능)
 *
 * 환경변수 CI_PUBLISH_GATE_ENABLED=false 로 게이트 우회 (비상시).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const maxDuration = 120;
export const runtime = 'nodejs';

const MAX_PER_RUN = 20;
const PREEMPT_MS = 100_000;
const GATE_ENABLED = (process.env.CI_PUBLISH_GATE_ENABLED ?? 'true').toLowerCase() !== 'false';

interface GateResult {
  allowed: boolean;
  reasons: string[];
  checks: Record<string, any>;
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('issue-publish', async () => {
      const sb = getSupabaseAdmin();
      const start = Date.now();

      const { data: pending, error: fetchErr } = await (sb as any)
        .from('issue_alerts')
        .select('id, blog_post_id, final_score, is_published')
        .not('seo_enriched_at', 'is', null)
        .not('blog_post_id', 'is', null)
        .or('is_published.eq.false,is_published.is.null')
        .order('final_score', { ascending: false })
        .limit(MAX_PER_RUN);

      if (fetchErr) return { processed: 0, failed: 1, metadata: { error: fetchErr.message } };
      if (!pending || pending.length === 0) {
        return { processed: 0, metadata: { message: 'no pending publish candidates' } };
      }

      let published = 0;
      let gateBlocked = 0;
      let failed = 0;
      const failures: string[] = [];
      const gateReasonCounts: Record<string, number> = {};
      const samples: any[] = [];

      for (const issue of pending as any[]) {
        if (Date.now() - start > PREEMPT_MS) break;
        try {
          const postId = Number(issue.blog_post_id);

          // 1) publish_attempted_at 선 스탬프
          await (sb as any)
            .from('issue_alerts')
            .update({ publish_attempted_at: new Date().toISOString() })
            .eq('id', issue.id);

          // 2) check_publish_gate
          let gate: GateResult = { allowed: true, reasons: [], checks: {} };
          if (GATE_ENABLED) {
            const { data: gateRows, error: gateErr } = await (sb as any).rpc('check_publish_gate', {
              p_post_id: postId,
            });
            if (gateErr) {
              failures.push(`${issue.id}:gate_err:${gateErr.message}`);
              failed++;
              continue;
            }
            const row = Array.isArray(gateRows) ? gateRows[0] : gateRows;
            gate = {
              allowed: !!row?.allowed,
              reasons: Array.isArray(row?.reasons) ? row.reasons : [],
              checks: (row?.checks && typeof row.checks === 'object') ? row.checks : {},
            };
          }

          if (!gate.allowed) {
            gateBlocked++;
            for (const r of gate.reasons) {
              const key = r.split(' ')[0];
              gateReasonCounts[key] = (gateReasonCounts[key] || 0) + 1;
            }
            await (sb as any)
              .from('issue_alerts')
              .update({
                publish_decision: 'gate_blocked',
                block_reason: gate.reasons.slice(0, 6).join(' | '),
              })
              .eq('id', issue.id);
            if (samples.length < 5) {
              samples.push({ id: issue.id, post: postId, gate: 'blocked', reasons: gate.reasons.slice(0, 3) });
            }
            continue;
          }

          // s191: 발행 직전 OG variant 자동 보강 — 게이트는 통과했어도 image<5 이면
          // SERP 캐러셀/이미지 팩 미노출이라 이 시점에 5장 보장.
          // s193: 작동 안 한 부작용 디버깅 — fetch/imgCount/UPDATE 단계별 진단 로깅 추가.
          try {
            const { data: post, error: fetchErr } = await sb
              .from('blog_posts')
              .select('content, title, category')
              .eq('id', postId)
              .single();
            if (fetchErr) {
              console.warn(`[issue-publish] og-pad fetch err post=${postId}:`, fetchErr.message);
            } else if (!post) {
              console.warn(`[issue-publish] og-pad post not found post=${postId}`);
            } else if (!post.content || !post.title) {
              console.warn(`[issue-publish] og-pad missing fields post=${postId} hasContent=${!!post.content} hasTitle=${!!post.title}`);
            } else {
              const imgCount = (post.content.match(/!\[.*?\]\(.*?\)/g) || []).length;
              const need = Math.max(0, 5 - imgCount);
              console.log(`[issue-publish] og-pad post=${postId} imgCount=${imgCount} need=${need} title="${post.title.slice(0, 40)}"`);
              if (need > 0) {
                const titleHash = Array.from(post.title).reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                const variants: string[] = [];
                for (let i = 0; i < need; i++) {
                  const design = ((titleHash + i + 1) % 6) + 1;
                  const url = `${SITE_URL}/api/og?title=${encodeURIComponent(post.title + ' ' + (i + 1))}&category=${post.category || 'general'}&design=${design}`;
                  variants.push(`![${post.title} OG ${i + 1}](${url})`);
                }
                const padded = post.content + '\n\n' + variants.join('\n\n');
                const { error: updateErr } = await sb.from('blog_posts').update({ content: padded }).eq('id', postId);
                if (updateErr) {
                  console.error(`[issue-publish] og-pad UPDATE failed post=${postId}:`, updateErr.message);
                } else {
                  console.log(`[issue-publish] og-pad applied post=${postId} variants=${variants.length} new_len=${padded.length}`);
                }
              }
            }
          } catch (padErr: any) {
            console.warn(`[issue-publish] og-pad exception post=${postId}:`, padErr?.stack || padErr?.message);
          }

          // s191: hub_mapping RPC — issue-draft 가 누락했거나 image-attach 우회 발행
          // 시에도 hub-spoke link equity 가 적용되도록 멱등 호출.
          try {
            await (sb as any).rpc('inject_hub_mapping_for_post', { p_post_id: postId });
          } catch (mapErr: any) {
            console.warn(`[issue-publish] inject_hub_mapping_for_post failed post=${postId}:`, mapErr?.message);
          }

          // 3) blog_posts 공개 전환 → trigger 가 indexnow 큐 enqueue
          const nowIso = new Date().toISOString();
          const { error: pubErr } = await sb
            .from('blog_posts')
            .update({ is_published: true, published_at: nowIso })
            .eq('id', postId);
          if (pubErr) {
            failures.push(`${issue.id}:publish_err:${pubErr.message}`);
            failed++;
            continue;
          }

          // 4) issue_alerts 발행 표기
          await (sb as any)
            .from('issue_alerts')
            .update({
              is_published: true,
              published_at: nowIso,
              publish_decision: 'auto_published',
              block_reason: null,
            })
            .eq('id', issue.id);

          // 5) advance stage
          try {
            await (sb as any).rpc('advance_issue_stage', {
              p_issue_id: issue.id,
              p_stage: 'publish',
            });
          } catch (stageErr: any) {
            failures.push(`${issue.id}:advance:${stageErr?.message || ''}`);
          }

          published++;
          if (samples.length < 5) {
            samples.push({ id: issue.id, post: postId, gate: 'passed', checks: gate.checks });
          }
        } catch (err: any) {
          failed++;
          failures.push(`${issue.id}:exception:${err?.message || 'unknown'}`);
        }
      }

      return {
        processed: pending.length,
        created: published,
        updated: gateBlocked,
        failed,
        metadata: {
          published,
          gate_blocked: gateBlocked,
          gate_enabled: GATE_ENABLED,
          top_gate_reasons: Object.entries(gateReasonCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([k, v]) => ({ reason: k, count: v })),
          samples,
          sample_failures: failures.slice(0, 5),
          elapsed_ms: Date.now() - start,
        },
      };
    }, { redisLockTtlSec: 150 }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
