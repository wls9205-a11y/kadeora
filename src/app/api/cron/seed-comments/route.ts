import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SEED_USERS = Array.from({ length: 89 }, (_, i) => {
  const n = String(i + 1).padStart(4, '0');
  return `aaaaaaaa-${n}-${n}-${n}-${String(i + 1).padStart(12, '0')}`;
});

const COMMENT_BY_CAT: Record<string, string[]> = {
  stock: [
    '이 종목 나도 지켜보는 중이에요', '차트 분석 잘 보셨네요', 'PER이 좀 높은 게 걸리긴 하는데...',
    '거래량이 터진 거 보면 기관이 들어온 듯', '목표가 얼마로 보시나요?', '장기적으론 괜찮아 보여요',
    '배당률이 괜찮네요', '실적 시즌에 주목해야 할 듯', '저도 비슷하게 보고 있었어요',
    'RSI 기준으로 과매도 진입하긴 했죠', '외인 수급이 관건인 거 같아요',
  ],
  apt: [
    '이 단지 실거래가 찾아봤는데 괜찮더라고요', '가점은 얼마 정도면 될까요?',
    '교통 호재가 있으면 좋겠네요', '전용 84 기준인가요?', '입주 물량이 좀 걸리긴 하네요',
    '이 지역 인프라는 어떤가요?', '분양가 대비 주변 시세가 어떻게 되나요?',
    '특별공급 조건도 한번 정리해주시면 좋겠어요', '경쟁률 높을 것 같은데...',
  ],
  local: [
    'ㅋㅋ 우리 동네도 비슷해요', '와 이런 곳이 있었구나', '저도 근처 사는데 공감',
    '여기 맛집 추천도 해주세요~', '동네 정보 감사합니다', '저도 가봐야겠다ㅎㅎ',
  ],
  free: [
    'ㄹㅇ 공감', '헐 나도 이거 봤는데', '진짜요??', '오 정보 감사합니다ㅎㅎ',
    '저도 알아보는 중이에요', '와 이거 대박이다', 'ㅋㅋㅋ 맞아요 진짜',
    '저도 해봐야겠다', '북마크 해둡니다ㅎㅎ', '좋은 정보 감사해요!',
    '오 이거 처음 알았어요', '댓글 달고 갑니다~',
  ],
};

const GENERIC = ['공감합니다', '정보 감사요~', '좋은 글이네요', '저도 같은 생각이에요'];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Get random post with category
    const { data: posts } = await admin.from('posts').select('id, category').eq('is_deleted', false).limit(50);
    if (!posts || posts.length === 0) return NextResponse.json({ skipped: true });

    const post = posts[Math.floor(Math.random() * posts.length)];
    // RPC로 시드유저 조회 (UUID LIKE 미지원 대응)
    const { data: seedUsers } = await admin.rpc('get_seed_users');
    const userId = seedUsers?.[Math.floor(Math.random() * (seedUsers?.length || 1))]?.id
      || SEED_USERS[Math.floor(Math.random() * SEED_USERS.length)];
    const pool = COMMENT_BY_CAT[post.category] ?? GENERIC;
    const content = pool[Math.floor(Math.random() * pool.length)];

    const { error } = await admin.from('comments').insert({
      post_id: post.id,
      author_id: userId,
      content,
      comment_type: 'comment',
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update comment count directly
    const { count } = await admin.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', post.id);
    await admin.from('posts').update({ comments_count: count ?? 0 }).eq('id', post.id);

    return NextResponse.json({ ok: true, post_id: post.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'error' }, { status: 500 });
  }
}
