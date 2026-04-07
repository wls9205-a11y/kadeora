export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

const PADDING_MARKERS = [
  '### 청약 준비 체크리스트',
  '### 미분양 아파트 투자 시 주의사항',
  '### 주식 투자 시 참고사항',
  '### 재테크 기본 원칙',
];

export const GET = withCronAuth(async (_req: NextRequest) => {
  const admin = getSupabaseAdmin();
  let totalCleaned = 0;

  for (const marker of PADDING_MARKERS) {
    const { data: posts } = await admin
      .from('blog_posts')
      .select('id, content')
      .like('content', `%${marker}%`)
      .limit(500);

    if (!posts?.length) continue;

    for (const post of posts) {
      const idx = post.content.indexOf(marker);
      if (idx < 0) continue;

      const cleaned = post.content.slice(0, idx).trimEnd();
      if (cleaned.length < 200) continue;

      const { error } = await admin
        .from('blog_posts')
        .update({ content: cleaned })
        .eq('id', post.id);

      if (!error) totalCleaned++;
    }
  }

  return NextResponse.json({ ok: true, cleaned: totalCleaned });
});
