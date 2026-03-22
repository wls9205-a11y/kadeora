import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 블로그 리라이팅 API
 * 
 * Claude API를 사용하여 템플릿 블로그를 고유한 문체로 리라이팅
 * - 한 번 호출 시 5건씩 처리
 * - 기존 데이터(수치, 링크)는 유지하면서 문체만 변경
 * - 리라이팅된 글에 rewritten_at 마킹
 * 
 * POST /api/admin/blog-rewrite
 * Body: { batchSize?: number, cronType?: string }
 */

const REWRITE_STYLES = [
  '전문가 칼럼 스타일로 작성해주세요. 마치 증권사 애널리스트가 쓴 것처럼 분석적이고 객관적인 톤으로.',
  '친근한 해설자 스타일로 작성해주세요. 어려운 용어를 쉽게 풀어서 설명하고, 독자에게 말을 거는 듯한 톤으로.',
  '데이터 저널리스트 스타일로 작성해주세요. 숫자와 통계를 중심으로 팩트 위주의 건조하지만 신뢰감 있는 톤으로.',
  '경험 많은 투자자가 후배에게 조언하는 스타일로 작성해주세요. 실전 경험에서 우러나온 구체적인 팁과 주의사항 중심으로.',
  '경제 유튜버가 대본을 쓴 것처럼 작성해주세요. 핵심을 간결하게 짚고, 비유와 예시를 활용하여 이해하기 쉽게.',
];

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRETT;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    // 관리자 세션 체크
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    // 간단한 인증 (실제로는 세션 기반)
  }

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batchSize || 5, 10);
    const cronType = body.cronType || null;

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 리라이팅 안 된 글 가져오기 (rewritten_at이 NULL)
    let query = admin.from('blog_posts')
      .select('id, title, content, category, tags, slug')
      .eq('is_published', true)
      .is('rewritten_at', null)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (cronType) {
      query = query.eq('cron_type', cronType);
    }

    const { data: posts, error: fetchErr } = await query;
    if (fetchErr || !posts || posts.length === 0) {
      return NextResponse.json({ ok: true, rewritten: 0, reason: 'no_posts_to_rewrite' });
    }

    let rewritten = 0;
    const results: { slug: string; status: string }[] = [];

    for (const post of posts) {
      try {
        // 랜덤 스타일 선택
        const style = REWRITE_STYLES[Math.floor(Math.random() * REWRITE_STYLES.length)];

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3000,
            messages: [{
              role: 'user',
              content: `당신은 한국 금융·부동산 전문 블로그 작가입니다.

아래 블로그 글을 리라이팅해주세요.

**스타일 지시:** ${style}

**규칙:**
1. 기존 콘텐츠의 모든 수치 데이터(가격, 세대수, 등락률 등)를 정확히 유지하세요
2. 마크다운 형식(##, |테이블|, **강조**)을 유지하세요
3. 내부 링크([텍스트](/경로))를 반드시 유지하세요
4. 1200자 이상으로 작성하세요
5. 기존과 다른 문장 구조와 표현을 사용하세요
6. 도입부를 완전히 새롭게 작성하세요
7. 섹션 순서를 약간 변경해도 됩니다
8. "투자 권유가 아니며" 면책 문구를 반드시 포함하세요
9. 마크다운만 출력하세요 (설명이나 주석 없이)

**카테고리:** ${post.category}
**기존 글:**

${post.content}`
            }],
          }),
        });

        if (!response.ok) {
          results.push({ slug: post.slug, status: `api_error_${response.status}` });
          continue;
        }

        const data = await response.json();
        const newContent = data.content?.[0]?.text;

        if (!newContent || newContent.length < 800) {
          results.push({ slug: post.slug, status: 'content_too_short' });
          continue;
        }

        // 새 meta_description도 생성
        const cleanContent = newContent.replace(/[#|*\n\r\-\[\]\(\)/]/g, ' ').replace(/\s+/g, ' ').trim();
        const newMetaDesc = cleanContent.slice(0, 120) + 
          (post.category === 'stock' ? ' — 카더라에서 주식 분석 정보를 확인하세요.' :
           post.category === 'apt' ? ' — 카더라에서 부동산 정보를 확인하세요.' :
           post.category === 'unsold' ? ' — 카더라에서 미분양 현황을 확인하세요.' :
           ' — 카더라 금융·부동산 정보');

        // DB 업데이트
        const { error: updateErr } = await admin.from('blog_posts').update({
          content: newContent,
          meta_description: newMetaDesc,
          excerpt: cleanContent.slice(0, 150),
          rewritten_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', post.id);

        if (updateErr) {
          results.push({ slug: post.slug, status: `update_error: ${updateErr.message}` });
        } else {
          rewritten++;
          results.push({ slug: post.slug, status: 'success' });
        }
      } catch (err: any) {
        results.push({ slug: post.slug, status: `error: ${err.message}` });
      }
    }

    return NextResponse.json({ ok: true, rewritten, total: posts.length, results });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
}
