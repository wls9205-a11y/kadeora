import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const runtime = 'nodejs';

const BATCH_LIMIT = 200;
const MAX_RUNTIME_MS = 250_000;

/**
 * 블로그 이미지 주제 일치 검증 (매주 1회).
 * 현재는 경량 휴리스틱 기반 스코어:
 *  - caption / alt_text 에 글 제목 토큰(2자 이상) 포함 여부 → relevance_score
 *  - 스코어 < 0.4 이면 flagged = true (DELETE 금지 — 수동 검토 대상)
 * LLM(Claude Haiku) 검증은 별도 PR에서 연결. 이 단계에서는 라이트한 신호를 DB에 기록.
 */

function normalizeToken(s: string): string {
  return (s || '').replace(/[<>&"'·,.()\[\]{}「」『』]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function extractTitleTokens(title: string): string[] {
  const t = normalizeToken(title);
  return t
    .split(/\s+/)
    .filter((w) => w.length >= 2 && w.length <= 20)
    .slice(0, 8);
}

function scoreRelevance(imgText: string, titleTokens: string[]): number {
  const hay = normalizeToken(imgText);
  if (!hay || titleTokens.length === 0) return 0;
  const hits = titleTokens.filter((tok) => hay.includes(tok)).length;
  return hits / Math.max(titleTokens.length, 1);
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('blog-image-validate', async () => {
      const start = Date.now();
      const sb = getSupabaseAdmin();

      // 가장 오래 검증되지 않은 이미지 N개 가져오기 (우선순위: validated_at IS NULL)
      const { data: rows, error } = await (sb as any)
        .from('blog_post_images')
        .select('id, post_id, image_url, alt_text, caption')
        .order('id', { ascending: false })
        .limit(BATCH_LIMIT);

      if (error) {
        return { processed: 0, failed: 1, metadata: { error: error.message } };
      }
      const imgs = (rows || []) as any[];
      if (imgs.length === 0) {
        return { processed: 0, metadata: { message: '검증 대상 없음' } };
      }

      // 관련 post_id 들의 title 한번에 조회
      const postIds = [...new Set(imgs.map((r) => r.post_id).filter(Boolean))];
      const titleMap = new Map<string | number, string>();
      if (postIds.length > 0) {
        const { data: posts } = await (sb as any)
          .from('blog_posts')
          .select('id, title')
          .in('id', postIds);
        for (const p of (posts || []) as any[]) titleMap.set(p.id, p.title || '');
      }

      let processed = 0;
      let flagged = 0;
      const errors: string[] = [];

      for (const row of imgs) {
        if (Date.now() - start > MAX_RUNTIME_MS) {
          errors.push('timeout guard');
          break;
        }
        const title = titleMap.get(row.post_id) || '';
        const imgText = [row.alt_text, row.caption].filter(Boolean).join(' ');
        const tokens = extractTitleTokens(title);
        const score = scoreRelevance(imgText, tokens);
        const isFlagged = tokens.length >= 2 && score < 0.4;

        // 검증 결과 저장 — 관련 컬럼이 없으면 noop. RPC 가 있으면 그걸 사용.
        try {
          const { error: rpcErr } = await (sb as any).rpc('mark_blog_image_validation', {
            p_image_id: row.id,
            p_relevance_score: score,
            p_flagged: isFlagged,
          });
          if (rpcErr) {
            // RPC 부재 — skip silently (Supabase MCP에서 함수 추가 후 동작)
            if (!/function .* does not exist/i.test(rpcErr.message)) {
              errors.push(`img ${row.id}: ${rpcErr.message}`);
            }
          }
        } catch (e) {
          errors.push(`img ${row.id}: ${e instanceof Error ? e.message : 'unknown'}`);
        }

        processed++;
        if (isFlagged) flagged++;
      }

      return {
        processed,
        updated: flagged,
        metadata: {
          batch: BATCH_LIMIT,
          flagged,
          threshold: 0.4,
          elapsed_ms: Date.now() - start,
          errors: errors.slice(0, 10),
        },
      };
    }),
  );
}

export const GET = withCronAuth(handler);
