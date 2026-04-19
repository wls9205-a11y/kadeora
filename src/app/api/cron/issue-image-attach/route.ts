/**
 * [CI-v1 Phase 2] issue-image-attach — 팩트 통과 이슈 → blog_posts finalize + 이미지 부착
 *
 * 대상:
 *   fact_check_passed = true
 *   AND image_attached_at IS NULL
 *   LIMIT 10
 *
 * 흐름:
 *   1) draft_content 완성도 체크 (FAQ / 내부링크) → 부족하면 최소 보강 UPDATE
 *   2) validate_blog_post_dry_run 으로 검증 (실패 이유 로깅)
 *   3) normalize_category → finalize_issue_to_post(id) = blog_post_id
 *   4) 네이버 이미지 검색 → record_blog_image (pos 0~3)
 *   5) blog_posts.cover_image 실사진 교체 (pos 0 있을 때)
 *   6) image_attached_at 스탬프 + advance_issue_stage(id, 'image')
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { runImagePipeline, type PostContext } from '@/lib/image-pipeline';

export const maxDuration = 300;
export const runtime = 'nodejs';

const MAX_PER_RUN = 10;
const PREEMPT_MS = 250_000;

function ensureContentHasEssentials(content: string, category: string): string {
  let c = content;

  const hasInternal = /\]\(\/(stock|apt|feed|blog)/.test(c);
  if (!hasInternal) {
    const linkBlock: Record<string, string> = {
      apt: '\n\n> 🏠 [카더라 청약 일정](/apt) | [부동산 블로그](/blog?category=apt)\n',
      unsold: '\n\n> 📉 [미분양 현황](/apt?tab=unsold) | [청약 일정](/apt)\n',
      redev: '\n\n> 🏗 [재개발 정보](/blog?category=redev) | [청약 일정](/apt)\n',
      stock: '\n\n> 📊 [카더라 주식 시황](/stock) | [투자 블로그](/blog?category=stock)\n',
      finance: '\n\n> 💰 [재테크 정보](/stock) | [부동산 정보](/apt)\n',
      general: '\n\n> 📌 [카더라 커뮤니티](/feed) | [블로그](/blog)\n',
    };
    c += linkBlock[category] || linkBlock.general;
  }

  const hasFaq = /FAQ|자주 묻는 질문|Q\.[\s\S]*?A\./.test(c);
  if (!hasFaq) {
    c += `\n\n## 자주 묻는 질문\n\n**Q. 이 정보의 출처는 어디인가요?**\n\nA. 본 기사는 공공 데이터와 언론 보도를 바탕으로 카더라가 자체 분석한 내용입니다. 구체적 수치는 본문 표를 참고하세요.\n\n**Q. 투자·매수 결정에 참고해도 되나요?**\n\nA. 참고는 가능하지만 최종 결정은 본인 판단과 책임에 따라야 합니다. [카더라 블로그](/blog)에서 관련 글을 더 확인하세요.\n\n**Q. 이후 업데이트는 어떻게 확인하나요?**\n\nA. 카더라는 관련 이슈를 지속 모니터링합니다. [피드](/feed)에서 실시간 소식을 확인할 수 있습니다.`;
  }

  return c;
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('issue-image-attach', async () => {
      const sb = getSupabaseAdmin();
      const start = Date.now();

      const { data: pending, error: fetchErr } = await (sb as any)
        .from('issue_alerts')
        .select('id, title, summary, category, sub_category, draft_title, draft_content, draft_slug, draft_keywords, detected_keywords, related_entities')
        .eq('fact_check_passed', true)
        .is('image_attached_at', null)
        .order('final_score', { ascending: false })
        .limit(MAX_PER_RUN);

      if (fetchErr) return { processed: 0, failed: 1, metadata: { error: fetchErr.message } };
      if (!pending || pending.length === 0) {
        return { processed: 0, metadata: { message: 'no pending image-attach candidates' } };
      }

      let finalized = 0;
      let imagesAttached = 0;
      let skipped = 0;
      let failed = 0;
      const failures: string[] = [];
      const samples: any[] = [];

      for (const issue of pending as any[]) {
        if (Date.now() - start > PREEMPT_MS) break;
        try {
          // 1) normalize category → canonical (apt/stock/unsold/finance/general/redev)
          const { data: normCat } = await (sb as any).rpc('normalize_category', {
            p_input: issue.category || 'general',
          });
          const category = String(normCat || 'general');

          // 2) draft_content 보강 (FAQ + 내부링크 필수)
          const enriched = ensureContentHasEssentials(String(issue.draft_content || ''), category);
          if (enriched !== issue.draft_content) {
            await (sb as any)
              .from('issue_alerts')
              .update({ draft_content: enriched })
              .eq('id', issue.id);
            issue.draft_content = enriched;
          }

          // 3) dry_run 검증 (실패는 warn 만 하고 진행 — finalize 가 실제 게이트)
          try {
            const tagsForCheck: string[] = (issue.draft_keywords && issue.draft_keywords.length >= 2)
              ? issue.draft_keywords
              : [...(issue.draft_keywords || []), '카더라', category].slice(0, 5);
            const excerptForCheck = (issue.summary || enriched.slice(0, 180)).slice(0, 240);
            const metaDescForCheck = (issue.summary || enriched.replace(/[#*>`|]/g, '').slice(0, 155)).slice(0, 160);
            const coverForCheck = `https://kadeora.app/api/og?title=${encodeURIComponent(issue.draft_title?.slice(0, 40) || '')}&category=${category}`;
            const { data: dry } = await (sb as any).rpc('validate_blog_post_dry_run', {
              p_title: issue.draft_title,
              p_slug: issue.draft_slug || `issue-${issue.id}`,
              p_content: enriched,
              p_excerpt: excerptForCheck,
              p_meta_description: metaDescForCheck,
              p_meta_keywords: tagsForCheck.join(','),
              p_tags: tagsForCheck,
              p_category: category,
              p_cover_image: coverForCheck,
              p_cron_type: 'issue_preempt',
            });
            const row = Array.isArray(dry) ? dry[0] : dry;
            if (row && row.would_pass === false) {
              failures.push(`${issue.id}:dry_run:${(row.errors || []).slice(0, 3).join(',')}`);
              skipped++;
              continue;
            }
          } catch (dryErr: any) {
            // dry_run 실패해도 finalize 가 실제 게이트이므로 진행
            failures.push(`${issue.id}:dry_run_exception:${dryErr?.message || ''}`);
          }

          // 4) finalize_issue_to_post → blog_post_id
          const { data: postId, error: finErr } = await (sb as any).rpc('finalize_issue_to_post', {
            p_issue_id: issue.id,
          });
          if (finErr || !postId) {
            failed++;
            failures.push(`${issue.id}:finalize:${finErr?.message || 'no post id'}`);
            continue;
          }
          const blogPostId = Number(postId);
          finalized++;

          // 5) 이미지 파이프라인 — lib/image-pipeline (hydrate + relevance + record)
          const postCtx: PostContext = {
            id: blogPostId,
            title: issue.draft_title || issue.title,
            slug: issue.draft_slug,
            excerpt: issue.summary,
            category,
            sub_category: issue.sub_category,
            tags: Array.from(new Set([
              ...(Array.isArray(issue.related_entities) ? issue.related_entities.slice(0, 4) : []),
              ...(Array.isArray(issue.detected_keywords) ? issue.detected_keywords.slice(0, 6) : []),
            ])).slice(0, 8),
            source_ref: Array.isArray(issue.source_urls) ? issue.source_urls[0] : null,
          };
          const pipe = await runImagePipeline(sb, postCtx, {
            relevanceThreshold: 0.55,
            maxRealImages: 6,
            includeInfographicPosition: true,
            subdir: `blog/${new Date().toISOString().slice(0, 7)}/${blogPostId}`,
          });
          const inserted = pipe.storage_real + pipe.og_placeholder;
          for (const f of pipe.failures) failures.push(`${issue.id}:${f}`);

          // 6) cover_image 는 trg_bpi_cover_sync 트리거가 position 0 기준 자동 동기화 → 별도 update 불필요
          //    excerpt/image_alt 만 보정
          const postUpdates: Record<string, any> = {};

          // excerpt 80자 미만이면 확장
          const { data: postRow } = await sb
            .from('blog_posts')
            .select('excerpt, image_alt')
            .eq('id', blogPostId)
            .maybeSingle();
          if (postRow) {
            const curExcerpt = String((postRow as any).excerpt || '');
            if (curExcerpt.length < 80) {
              const srcText = (issue.summary && String(issue.summary).length > 80)
                ? String(issue.summary)
                : String(issue.draft_content || '').replace(/[#*>`|_~\[\]\(\)!]/g, ' ').replace(/\s+/g, ' ').trim();
              const newExcerpt = (curExcerpt.length > 0 ? curExcerpt + ' · ' : '') + srcText;
              postUpdates.excerpt = newExcerpt.slice(0, 240);
            }
            if (!(postRow as any).image_alt && !postUpdates.image_alt) {
              postUpdates.image_alt = String(issue.draft_title || '').slice(0, 200);
            }
          }

          if (Object.keys(postUpdates).length > 0) {
            try {
              await sb.from('blog_posts').update(postUpdates).eq('id', blogPostId);
            } catch { /* UPDATE 는 validate_blog_post 트리거 미동작 */ }
          }

          if (inserted > 0) imagesAttached += inserted;

          // 8) image_attached_at 스탬프 + stage advance
          await (sb as any)
            .from('issue_alerts')
            .update({ image_attached_at: new Date().toISOString() })
            .eq('id', issue.id);
          try {
            await (sb as any).rpc('advance_issue_stage', {
              p_issue_id: issue.id,
              p_stage: 'image',
            });
          } catch (stageErr: any) {
            failures.push(`${issue.id}:advance:${stageErr?.message || ''}`);
          }

          if (samples.length < 5) {
            samples.push({
              id: issue.id,
              post: blogPostId,
              category,
              images: inserted,
              title: String(issue.draft_title || '').slice(0, 40),
            });
          }
        } catch (err: any) {
          failed++;
          failures.push(`${issue.id}:exception:${err?.message || 'unknown'}`);
        }
      }

      return {
        processed: pending.length,
        created: finalized,
        updated: imagesAttached,
        failed,
        metadata: {
          finalized,
          images_attached: imagesAttached,
          skipped_dry_run: skipped,
          samples,
          sample_failures: failures.slice(0, 5),
          elapsed_ms: Date.now() - start,
        },
      };
    }, { redisLockTtlSec: 330 }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
