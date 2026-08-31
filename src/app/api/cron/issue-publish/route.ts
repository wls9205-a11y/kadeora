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
import { dbw } from '@/lib/cron-db-log';

export const maxDuration = 120;
export const runtime = 'nodejs';

const MAX_PER_RUN = 20;
/** 이슈 초안 유통기한(일). 이보다 낡은 초안은 발행하지 않고 보류 표기한다(증분6 판정 2). */
const STALE_DRAFT_DAYS = 3;
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

      /* ── 유통기한 (증분6 판정 2 · 2026-08-31) ────────────────────────────
       *
       * 이슈 글은 «시의성이 곧 값» 이다. 4월 이슈를 오늘 발행하면 「누구보다 빠른 소식」
       * 포지셔닝에 정면으로 역행한다.
       *
       * 실측이 그 위험을 확증했다 — 발행 대기 1,750건 중
       *   3일 이내  54건
       *   3일 초과  1,696건 (97%) · 가장 오래된 것 2026-04-13
       * image-attach 를 고치기만 하고 이 게이트가 없었으면 «4월 뉴스 1,700편» 이 쏟아졌다.
       *
       * ⛔ 데이터는 «지우지 않는다». 보류 표기만 한다(publish_decision='stale_hold').
       *    정책이 바뀌면 그대로 되살릴 수 있어야 한다 — blog_post_id 도 초안도 그대로 둔다.
       * ⚠️ 표기만으로는 부족하고 «후보 쿼리에서도» 빼야 한다. final_score DESC 로 20건을
       *    집는데 낡은 1,696건이 그 자리를 다 먹으면 신선한 54건이 영영 차례를 못 받는다.
       * ⚠️ draft_ready_at 이 NULL 인 279건은 그 컬럼이 생기기 «전» 에 쌓인 것이라
       *    전부 오래된 글이다 — 모르는 시각은 «오래된 것» 으로 본다(안전한 쪽).
       * ⚠️ 3일은 세션 A 제안값이다. 카테고리별 유통기한 실측이 나오면 조정 대상. */
      const cutoffIso = new Date(Date.now() - STALE_DRAFT_DAYS * 86_400_000).toISOString();

      const staleMarked = await (sb as any)
        .from('issue_alerts')
        .update({ publish_decision: 'stale_hold', block_reason: `stale_draft_gt_${STALE_DRAFT_DAYS}d` })
        .not('blog_post_id', 'is', null)
        .or('is_published.eq.false,is_published.is.null')
        .neq('publish_decision', 'stale_hold')
        .or(`draft_ready_at.lt.${cutoffIso},draft_ready_at.is.null`)
        .select('id');
      dbw('issue-publish', 'issue_alerts.update@stale', staleMarked);
      const staleMarkedN = staleMarked?.data?.length ?? 0;

      // s258 patch #4: seo_enriched_at NOT NULL 이미 강제 (latency 음수 불가)
      // draft_ready_at + seo_enriched_at IS NULL row 는 issue-seo-enrich cron 이 처리 (분리 책임)
      const { data: pending, error: fetchErr } = await (sb as any)
        .from('issue_alerts')
        .select('id, blog_post_id, final_score, is_published, seo_enriched_at, draft_ready_at')
        .not('seo_enriched_at', 'is', null)
        .not('blog_post_id', 'is', null)
        .or('is_published.eq.false,is_published.is.null')
        .gte('draft_ready_at', cutoffIso)
        .order('final_score', { ascending: false })
        .limit(MAX_PER_RUN);

      if (fetchErr) return { processed: 0, failed: 1, metadata: { error: fetchErr.message } };
      if (!pending || pending.length === 0) {
        return {
          processed: 0,
          metadata: {
            message: 'no pending publish candidates',
            eligible: 0,
            reasons: staleMarkedN > 0 ? { stale_hold: staleMarkedN } : {},
          },
        };
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
          dbw('issue-publish', 'issue_alerts.update@79', await (sb as any)
            .from('issue_alerts')
            .update({ publish_attempted_at: new Date().toISOString() })
            .eq('id', issue.id));

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
            dbw('issue-publish', 'issue_alerts.update@109', await (sb as any)
              .from('issue_alerts')
              .update({
                publish_decision: 'gate_blocked',
                block_reason: gate.reasons.slice(0, 6).join(' | '),
              })
              .eq('id', issue.id));
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
          dbw('issue-publish', 'issue_alerts.update@183', await (sb as any)
            .from('issue_alerts')
            .update({
              is_published: true,
              published_at: nowIso,
              publish_decision: 'auto_published',
              block_reason: null,
            })
            .eq('id', issue.id));

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
          /* BG-0 관측 계약 — scanned/eligible/created/reasons.
             stale_hold 는 «이번 실행에서 새로 보류 표기한 수» 다(누적이 아니다). */
          eligible: pending.length,
          created: published,
          stale_hold_marked: staleMarkedN,
          stale_draft_days: STALE_DRAFT_DAYS,
          reasons: { ...gateReasonCounts, ...(staleMarkedN > 0 ? { stale_hold: staleMarkedN } : {}) },
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
