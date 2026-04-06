export const maxDuration = 30;
import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * 인기 게시글 AI 댓글 요약 크론
 * - 댓글 10개 이상 + 아직 요약 없는 게시글 대상
 * - 하루 1회 실행, 최대 5건
 * - Haiku 4.5로 비용 최소화 (~$0.02/일)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('post-ai-summary', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_api_key' } };
    }

    const sb = getSupabaseAdmin();

    // 댓글 10개 이상인 게시글 조회 후 JS에서 ai_summary null 필터
    const { data: allPosts } = await sb.from('posts')
      .select('id, title, content, comments_count')
      .gte('comments_count', 10)
      .order('comments_count', { ascending: false })
      .limit(20);

    // ai_summary가 없는 것만 필터 (타입 우회)
    const posts = (allPosts || []).filter((p: any) => !(p as any).ai_summary).slice(0, 5);

    if (!posts.length) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_targets' } };
    }

    let created = 0;
    for (const post of posts) {
      try {
        const { data: comments } = await sb.from('comments')
          .select('content')
          .eq('post_id', post.id)
          .order('likes_count', { ascending: false })
          .limit(20);

        if (!comments?.length) continue;

        const commentsText = comments.map((c: any, i: number) => `${i + 1}. ${c.content}`).join('\n');

        const prompt = `커뮤니티 게시글과 댓글을 읽고 핵심 논점을 3줄로 요약해주세요.

게시글 제목: ${post.title}
게시글 내용: ${(post.content || '').slice(0, 300)}

댓글 ${comments.length}개:
${commentsText}

JSON만: {"summary":"3줄 요약 (줄바꿈 \\n으로 구분)","consensus":"agree|disagree|mixed","hot_topic":"가장 많이 논의된 주제 1개"}`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: AI_MODEL_HAIKU,
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          if (res.status === 402 || res.status === 529) {
            return { processed: posts.length, created, failed: posts.length - created, metadata: { reason: 'credit_exhausted' } };
          }
          continue;
        }

        const data = await res.json();
        const match = (data.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          // 타입 없는 컬럼 업데이트
          await (sb as any).from('posts').update({ ai_summary: parsed.summary || '' }).eq('id', post.id);
          created++;
        }
      } catch { continue; }
    }

    return { processed: posts.length, created, failed: posts.length - created };
  });

  if (!result.success) return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}
