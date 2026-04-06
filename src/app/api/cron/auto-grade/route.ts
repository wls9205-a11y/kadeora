export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { GRADE_TITLES } from '@/lib/constants';

/**
 * 등급 자동 갱신 크론
 * 포인트 + 활동량(게시글/댓글) 기반으로 등급 자동 승급/유지
 * 
 * 등급 기준:
 *   1 새싹:       0P (기본)
 *   2 정보통:     100P + 게시글 3개
 *   3 동네어른:   500P + 게시글 10개
 *   4 소문난집:   1500P + 게시글 30개
 *   5 인플루언서: 3000P + 게시글 50개 + 댓글 30개
 *   6 빅마우스:   5000P + 게시글 100개 + 댓글 50개
 *   7 찐고수:     10000P + 게시글 200개
 *   8 전설:       20000P + 게시글 500개
 *   9 신의경지:   50000P + 게시글 1000개
 *  10 카더라신:   100000P (관리자 수동 또는 극한 활동)
 */

interface GradeRule {
  grade: number;
  minPoints: number;
  minPosts: number;
  minComments: number;
}

const GRADE_RULES: GradeRule[] = [
  { grade: 10, minPoints: 100000, minPosts: 2000, minComments: 500 },
  { grade: 9,  minPoints: 50000,  minPosts: 1000, minComments: 300 },
  { grade: 8,  minPoints: 20000,  minPosts: 500,  minComments: 200 },
  { grade: 7,  minPoints: 10000,  minPosts: 200,  minComments: 100 },
  { grade: 6,  minPoints: 5000,   minPosts: 100,  minComments: 50 },
  { grade: 5,  minPoints: 3000,   minPosts: 50,   minComments: 30 },
  { grade: 4,  minPoints: 1500,   minPosts: 30,   minComments: 10 },
  { grade: 3,  minPoints: 500,    minPosts: 10,   minComments: 5 },
  { grade: 2,  minPoints: 100,    minPosts: 3,    minComments: 0 },
  { grade: 1,  minPoints: 0,      minPosts: 0,    minComments: 0 },
];

function calculateGrade(points: number, postCount: number, commentCount: number): number {
  for (const rule of GRADE_RULES) {
    if (points >= rule.minPoints && postCount >= rule.minPosts && commentCount >= rule.minComments) {
      return rule.grade;
    }
  }
  return 1;
}



export async function GET(req: NextRequest) {
  try {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('auto-grade', async () => {
    const supabase = getSupabaseAdmin();

    // 모든 활성 유저의 포인트 조회
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, points, grade, grade_title')
      .or('is_deleted.is.null,is_deleted.eq.false');

    if (profileErr || !profiles) {
      return { processed: 0, created: 0, failed: 1, metadata: { error: profileErr?.message } };
    }

    // 유저별 게시글/댓글 수 조회 (배치 처리 — Supabase .in() 제한 대응)
    const userIds = profiles.map(p => p.id);
    const batchSize = 200;
    const postCountMap: Record<string, number> = {};
    const commentCountMap: Record<string, number> = {};

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      const { data: postCounts } = await supabase
        .from('posts')
        .select('author_id')
        .eq('is_deleted', false)
        .in('author_id', batch);

      for (const p of (postCounts || [])) {
        postCountMap[p.author_id!] = (postCountMap[p.author_id!] || 0) + 1;
      }

      const { data: commentCounts } = await supabase
        .from('comments')
        .select('author_id')
        .in('author_id', batch);

      for (const c of (commentCounts || [])) {
        commentCountMap[c.author_id!] = (commentCountMap[c.author_id!] || 0) + 1;
      }
    }

    let upgraded = 0;
    let unchanged = 0;

    for (const profile of profiles) {
      const points = profile.points || 0;
      const posts = postCountMap[profile.id] || 0;
      const comments = commentCountMap[profile.id] || 0;
      const newGrade = calculateGrade(points, posts, comments);
      const currentGrade = profile.grade || 1;

      // 등급은 올라가기만 함 (강등 없음)
      if (newGrade > currentGrade) {
        const { error: gradeErr } = await supabase
          .from('profiles')
          .update({
            grade: newGrade,
            grade_title: GRADE_TITLES[newGrade] || '새싹',
          })
          .eq('id', profile.id);

        if (!gradeErr) {
          upgraded++;
          // 등급 승급 알림
          await supabase.from('notifications').insert({
            user_id: profile.id,
            type: 'badge',
            content: `🎉 ${GRADE_TITLES[newGrade]} 등급으로 승급! 축하합니다!`,
            link: '/profile',
          }).then(() => {});
        }
      } else {
        unchanged++;
      }
    }

    return {
      processed: profiles.length,
      created: upgraded,
      failed: 0,
      metadata: { upgraded, unchanged, total: profiles.length },
    };
  });

  if (!result.success) {
    return NextResponse.json({ success: true, error: result.error });
  }
  return NextResponse.json({ ok: true, ...result });
} catch (e: unknown) {
    console.error('[cron/auto-grade]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 200 });
  }
}
