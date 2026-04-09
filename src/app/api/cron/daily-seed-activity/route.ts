export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

/**
 * daily-seed-activity 크론 — 시드 계정 일상 활동
 *
 * 시드 계정이 평소에도 자연스럽게 활동하여 진짜 유저처럼 보이게 함
 * - 기존 블로그/피드에 짧은 댓글
 * - 기존 포스트에 좋아요
 * - 가끔 일상 뻘글
 * 주기: 매일 1회 (랜덤 시각 효과는 created_at 조정으로)
 */

const CASUAL_COMMENTS: Record<string, string[]> = {
  '20대': [
    '오 이거 몰랐네요', 'ㅋㅋ 공감', '유용한 정보 감사합니다!', '저도 궁금했는데',
    '대박 ㄷㄷ', '이거 저장해놔야겠다', 'ㅎㅎ 좋은 정보네요', '와 진짜요?',
  ],
  '30대': [
    '좋은 정보 감사합니다', '참고하겠습니다!', '저도 비슷한 경험이요', '궁금했던 내용이에요',
    '도움이 많이 됩니다', '정리 잘 해주셨네요', '공유 감사합니다', '알아두면 좋겠네요',
  ],
  '40대': [
    '유익한 글이네요', '좋은 정보 공유 감사드립니다', '잘 읽었습니다', '참고가 되었습니다',
    '좋은 분석이네요', '도움이 됩니다 감사합니다', '잘 정리하셨네요', '관심 있게 보고 있습니다',
  ],
  '50대': [
    '좋은 정보입니다', '감사합니다', '참고하겠습니다', '유익합니다',
    '잘 읽었습니다', '좋은 글이네요', '도움이 됩니다', '감사드립니다',
  ],
};

const CASUAL_POSTS = [
  { title: '오늘도 출근', content: '월요병 아닌데 월요병 온 느낌...\n커피 한잔 하고 시작해야겠다' },
  { title: '점심 뭐먹지', content: '매일 점심 메뉴 고르는게 제일 힘들다\n추천 좀 해주세요 ㅋㅋ' },
  { title: '퇴근하고 뉴스 보는 중', content: '요즘 부동산이랑 주식 뉴스가 너무 많아서\n뭘 봐야할지 모르겠다' },
  { title: '주말에 뭐하시나요', content: '날씨 좋은데 집에만 있기 아까움\n산책이라도 나가야하나' },
  { title: '오늘 장 어땠어요?', content: '장 마감하고 보니 또 빠졌네...\n내 계좌도 빠졌다 ㅠ' },
  { title: '부동산 공부 시작합니다', content: '이제라도 공부해야할 것 같아서\n카더라 블로그 글 하나씩 읽는 중' },
  { title: '적금 만기 됐는데', content: '적금 만기 됐는데 어디에 넣을지 고민\n그냥 또 적금? 아님 주식??' },
  { title: '전세 만기 다가오는데', content: '전세 만기 6개월 남았는데 벌써 걱정\n이사 가야하나 연장해야하나' },
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function handler(_req: NextRequest) {
  const sb = getSupabaseAdmin();
  const results: string[] = [];

  // 시드 유저 조회
  const { data: seedUsers } = await sb.from('profiles')
    .select('id, nickname, age_group, region_text')
    .eq('is_seed', true)
    .limit(30);

  if (!seedUsers || seedUsers.length === 0) {
    return NextResponse.json({ error: 'no seed users' });
  }

  // 랜덤으로 5~8명만 오늘 활동
  const activeCount = randInt(5, Math.min(8, seedUsers.length));
  const activeUsers = seedUsers.sort(() => Math.random() - 0.5).slice(0, activeCount);

  for (const user of activeUsers) {
    const ageGroup = user.age_group || '30대';
    const comments = CASUAL_COMMENTS[ageGroup] || CASUAL_COMMENTS['30대'];

    // 1. 기존 인기 포스트에 댓글 1개 (70% 확률)
    if (Math.random() < 0.7) {
      const { data: hotPost } = await sb.from('posts')
        .select('id')
        .eq('is_deleted', false)
        .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
        .order('likes_count', { ascending: false })
        .limit(10);

      if (hotPost && hotPost.length > 0) {
        const post = pick(hotPost);
        const commentTime = new Date(Date.now() - randInt(0, 300) * 60000).toISOString();

        await sb.from('comments').insert({
          post_id: post.id,
          author_id: user.id,
          content: pick(comments),
          comment_type: 'comment',
          created_at: commentTime,
        }).then(() => {});

        // comments_count 증가
        const { count } = await sb.from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', post.id);
        await sb.from('posts').update({ comments_count: count || 0 }).eq('id', post.id);

        results.push(`${user.nickname}: 댓글`);
      }
    }

    // 2. 기존 포스트에 좋아요 2~3개 (80% 확률)
    if (Math.random() < 0.8) {
      const likeCount = randInt(2, 3);
      const { data: recentPosts } = await sb.from('posts')
        .select('id')
        .eq('is_deleted', false)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (recentPosts && recentPosts.length > 0) {
        const targets = recentPosts.sort(() => Math.random() - 0.5).slice(0, likeCount);
        for (const post of targets) {
          await sb.from('post_likes')
            .insert({ post_id: post.id, user_id: user.id })
            .then(() => {});
        }
        results.push(`${user.nickname}: 좋아요 ${likeCount}개`);
      }
    }

    // 3. 일상 뻘글 1개 (15% 확률 — 주 1~2회 꼴)
    if (Math.random() < 0.15) {
      const casual = pick(CASUAL_POSTS);
      const postTime = new Date(Date.now() - randInt(0, 120) * 60000).toISOString();

      await sb.from('posts').insert({
        author_id: user.id,
        title: casual.title,
        content: casual.content,
        category: 'general',
        region_id: user.region_text || 'all',
        is_anonymous: false,
        created_at: postTime,
      }).then(() => {});

      results.push(`${user.nickname}: 뻘글 "${casual.title}"`);
    }

    // 4. 블로그 댓글 1개 (30% 확률)
    if (Math.random() < 0.3) {
      const { data: recentBlog } = await sb.from('blog_posts')
        .select('id')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(10);

      if (recentBlog && recentBlog.length > 0) {
        const blog = pick(recentBlog);
        await sb.from('blog_comments').insert({
          blog_id: blog.id,
          user_id: user.id,
          content: pick(comments),
          created_at: new Date(Date.now() - randInt(0, 180) * 60000).toISOString(),
        }).then(() => {});

        results.push(`${user.nickname}: 블로그댓글`);
      }
    }
  }

  return NextResponse.json({
    active_users: activeUsers.length,
    activities: results.length,
    details: results,
  });
}

export const GET = withCronAuth(handler);
