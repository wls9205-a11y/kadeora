import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SEED_USERS = Array.from({ length: 89 }, (_, i) => {
  const n = String(i + 1).padStart(4, '0');
  return `aaaaaaaa-${n}-${n}-${n}-${String(i + 1).padStart(12, '0')}`;
});

const COMMENT_TEMPLATES = [
  'ㄹㅇ 공감', '헐 나도 이거 봤는데', '진짜요??', '오 정보 감사합니다ㅎㅎ',
  '저도 알아보는 중이에요', '와 이거 대박이다', 'ㅋㅋㅋ 맞아요 진짜',
  '근데 요즘 다들 이렇게 하나요?', '저도 해봐야겠다', '정보 감사요~',
  '오 몰랐던 건데 감사합니다', '이거 진짜 유용하네요', '북마크 해둡니다ㅎㅎ',
  '와 저도 같은 생각이었는데', '공감 백배... 진짜 맞는 말씀', '좋은 정보 감사해요!',
  'ㅋㅋ 이런 글 더 올려주세요', '저만 이런 줄 알았는데 아니었네ㅋㅋ',
  '오 이거 처음 알았어요', '댓글 달고 갑니다~', '구독하고 갑니다ㅎ',
];

export async function GET(req: NextRequest) {
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRETT].filter(Boolean);
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secrets.length === 0 || !secrets.includes(token || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Get random post
    const { data: posts } = await admin.from('posts').select('id').eq('is_deleted', false).limit(50);
    if (!posts || posts.length === 0) return NextResponse.json({ skipped: true });

    const post = posts[Math.floor(Math.random() * posts.length)];
    const userId = SEED_USERS[Math.floor(Math.random() * SEED_USERS.length)];
    const content = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];

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
