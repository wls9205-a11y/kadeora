export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

/**
 * feed-buzz-publish 크론 — 예약된 뻘글 발행
 * 주기: 매 5분
 * scheduled_feed_posts에서 발행 시각 도래한 건 처리
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const PERSONA_PROFILES: Record<string, { tone: string; style: string }> = {
  curious: {
    tone: '20~30대, 궁금증 폭발, 놀라는 반응',
    style: '반말+존댓말 섞어, "??" 많이, ㄷㄷ ㅋㅋ 사용, 150자 이내',
  },
  self_deprecating: {
    tone: '30대, 자조적 유머, 주식/부동산 실패 경험',
    style: '반말, ㅋㅋㅋ 많이, "어차피 내 인생에~" 패턴, 120자 이내',
  },
  question: {
    tone: '20~30대, 진짜 모르는 사람, 정보 요청',
    style: '"~인가요?" "아시는분?" 존댓말, ㅠㅠ 사용, 150자 이내',
  },
  calculator: {
    tone: '30대, 계산적, 수치 좋아함',
    style: '"~하면 ~인건가" 패턴, 숫자 1~2개 언급, "누가 좀 계산해줘요", 180자 이내',
  },
  sharer: {
    tone: '30대, 정보 공유형, 약간 흥분',
    style: '"와 이거 보셨어요?" "ㄷㄷ" 사용, 120자 이내',
  },
  realist: {
    tone: '30~40대, 현실적, 냉정한 시각',
    style: '"근데 실제로는~" "경쟁률 몇 나올지" 패턴, 150자 이내',
  },
};

async function generateBuzzContent(issue: any, personaType: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const persona = PERSONA_PROFILES[personaType] || PERSONA_PROFILES.curious;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: `당신은 한국 부동산/주식 커뮤니티의 일반 유저입니다.
톤: ${persona.tone}
스타일: ${persona.style}

규칙:
- 진짜 일반인이 커뮤니티에 쓴 것처럼 자연스럽게
- 블로그 링크나 URL 절대 포함하지 마세요
- 정확한 수치는 최대 1~2개만 (너무 정확하면 부자연스러움)
- "~라던데", "~인가?", "~것 같은데" 식으로 불확실하게 표현
- 이모지 최대 1~2개
- 줄바꿈 자연스럽게`,
        messages: [{
          role: 'user',
          content: `다음 이슈에 대해 커뮤니티 글을 1개 작성하세요.

이슈: ${issue.title}
요약: ${issue.summary || ''}
카테고리: ${issue.category === 'apt' ? '부동산' : '주식'}
핵심 수치: ${JSON.stringify(issue.raw_data || {}).slice(0, 200)}

글만 작성하세요. 다른 설명 없이.`,
        }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  // 발행 시각 도래 + 미발행 건 조회 (최대 3건)
  const { data: scheduled } = await (sb as any).from('scheduled_feed_posts')
    .select('*, issue_alerts(*)')
    .eq('is_published', false)
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(3);

  if (!scheduled || scheduled.length === 0) {
    return NextResponse.json({ published: 0 });
  }

  // 시드 유저 풀 조회
  const { data: seedUsers } = await sb.from('profiles')
    .select('id, nickname, age_group')
    .eq('is_seed', true)
    .limit(20);

  if (!seedUsers || seedUsers.length === 0) {
    return NextResponse.json({ published: 0, error: 'no seed users' });
  }

  const results: any[] = [];

  // ── 24h 도배 방지: realestate/stock 카테고리 일일 상한 체크 ──
  const oneDayAgo = new Date(Date.now() - 24 * 3600000).toISOString();
  const { data: recentBuzz } = await sb.from('posts')
    .select('title, category')
    .in('category', ['realestate', 'stock'])
    .gte('created_at', oneDayAgo)
    .eq('is_deleted', false);
  const buzzCount = (recentBuzz || []).filter(p => p.category === 'realestate').length;
  const stockBuzzCount = (recentBuzz || []).filter(p => p.category === 'stock').length;
  // 카테고리별 일일 상한: realestate 3개, stock 3개 (v4: 도배 방지 강화)
  const DAILY_CAP = 3;
  const recentTitles = (recentBuzz || []).map(p => p.title);

  for (const item of scheduled) {
    const issue = item.issue_alerts;
    if (!issue) continue;

    // 이슈 나이 체크: 24시간 이상 지난 이슈는 스킵
    const issueAge = Date.now() - new Date(issue.detected_at).getTime();
    if (issueAge > 24 * 60 * 60 * 1000) {
      await (sb as any).from('scheduled_feed_posts')
        .update({ is_published: true })
        .eq('id', item.id);
      continue;
    }

    // 일일 상한 체크 — 초과 시 발행하지 않고 만료 처리
    const category = issue.category === 'apt' ? 'realestate' : 'stock';
    const currentCount = category === 'realestate' ? buzzCount : stockBuzzCount;
    if (currentCount >= DAILY_CAP) {
      await (sb as any).from('scheduled_feed_posts')
        .update({ is_published: true }) // 상한 도달 → 만료
        .eq('id', item.id);
      continue;
    }

    // 동일 이슈 키워드 중복 체크 (제목 앞 15자 유사)
    const issueKeywords = (issue.title || '').replace(/\[선점\]\s*/, '').slice(0, 15);
    const duplicateCount = recentTitles.filter(t => t.includes(issueKeywords.slice(0, 8))).length;
    if (duplicateCount >= 3) {
      await (sb as any).from('scheduled_feed_posts')
        .update({ is_published: true })
        .eq('id', item.id);
      continue;
    }

    // 랜덤 시드 유저 선택
    const user = seedUsers[Math.floor(Math.random() * seedUsers.length)];

    // AI 뻘글 생성
    const content = await generateBuzzContent(issue, item.persona_type);
    if (!content) continue;
    const { data: postData } = await sb.from('posts').insert({
      author_id: user.id,
      title: content.slice(0, 50).replace(/\n/g, ' '),
      content,
      category,
      is_anonymous: false,
      region_id: 'all',
      created_at: new Date().toISOString(),
    }).select('id').single();

    // scheduled 업데이트
    await (sb as any).from('scheduled_feed_posts')
      .update({
        is_published: true,
        published_post_id: postData?.id || null,
        persona_user_id: user.id,
      })
      .eq('id', item.id);

    results.push({ persona: item.persona_type, user: user.nickname, postId: postData?.id });
  }

  return NextResponse.json({ published: results.length, details: results });
}

export const GET = withCronAuth(handler);
