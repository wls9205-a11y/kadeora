import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 블로그 자동 리라이팅 크론
 * 
 * vercel.json에서 하루 3회 호출
 * 각 호출 시 3건씩 리라이팅 (하루 최대 9건)
 * 13,778건 ÷ 9건/일 = ~1,531일 (자동)
 * 어드민에서 수동으로 추가 실행 가능
 */

const STYLES = [
  '전문가 칼럼 스타일. 증권사 애널리스트처럼 분석적이고 객관적인 톤.',
  '친근한 해설자 스타일. 어려운 용어를 쉽게 풀어 독자에게 말을 거는 톤.',
  '데이터 저널리스트 스타일. 숫자 중심 팩트 위주, 건조하지만 신뢰감 있는 톤.',
  '경험 많은 투자자가 후배에게 조언하는 스타일. 실전 팁과 주의사항 중심.',
  '경제 유튜버 대본 스타일. 핵심을 간결하게, 비유와 예시로 이해하기 쉽게.',
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRETT;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    // 리라이팅 안 된 글 3건
    const { data: posts } = await admin.from('blog_posts')
      .select('id, title, content, category, slug')
      .eq('is_published', true)
      .is('rewritten_at', null)
      .order('created_at', { ascending: true })
      .limit(3);

    if (!posts || posts.length === 0) {
      return NextResponse.json({ ok: true, rewritten: 0, reason: 'all_done' });
    }

    let rewritten = 0;
    for (const post of posts) {
      try {
        const style = STYLES[Math.floor(Math.random() * STYLES.length)];
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{
              role: 'user',
              content: `한국 금융·부동산 전문 블로그 작가로서 아래 글을 리라이팅하세요.

스타일: ${style}

규칙:
- 반드시 3000자 이상 작성 (핵심 요구사항)
- 서론/본론/결론 구조로 깊이 있게 다루기
- 수치 데이터 유지 / 마크다운 형식 유지 / 내부 링크 유지
- 소제목(##) 3~5개 포함
- 각 섹션에 구체적 예시·수치·비교 포함
- 면책 문구 포함 / 마크다운만 출력

카테고리: ${post.category}

${post.content}`
            }],
          }),
        });

        if (!res.ok) continue;
        const data = await res.json();
        const newContent = data.content?.[0]?.text;
        if (!newContent || newContent.length < 2000) continue;

        const clean = newContent.replace(/[#|*\n\r\-\[\]\(\)/]/g, ' ').replace(/\s+/g, ' ').trim();

        await admin.from('blog_posts').update({
          content: newContent,
          meta_description: clean.slice(0, 120) + ' — 카더라',
          excerpt: clean.slice(0, 150),
          rewritten_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', post.id);

        rewritten++;
        console.info(`[blog-rewrite] Rewritten: ${post.slug}`);
      } catch (err: any) {
        console.error(`[blog-rewrite] Error: ${post.slug}`, err.message);
      }
    }

    return NextResponse.json({ ok: true, rewritten, total: posts.length });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
}
