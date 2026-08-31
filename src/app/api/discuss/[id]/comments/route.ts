import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sb = await createSupabaseServer();
    const { data, error } = await sb.from('discussion_comments')
      .select('*, profiles!discussion_comments_author_id_fkey(nickname, grade)')
      .eq('topic_id', parseInt(id, 10))
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ comments: data || [] }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=150' },
    });
  } catch { return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}

/* ⛔ 의견 작성 차단 — /discuss 는 «읽기 전용 아카이브» 다 (Node 판정 2026-08-31).
 * UI 만 닫으면 반쪽이다 — 라우트가 열려 있으면 같은 사실을 UI 와 API 가 «다르게» 안다.
 * ⚠️ 데이터는 그대로다(토픽 35 · 채팅 216 · 투표 2). 폐쇄는 경로의 일이다.
 * 되살리려면 UI 와 이 라우트를 «같은 커밋에서» 함께 열 것. */
export async function POST() {
  return NextResponse.json(
    { error: 'gone', message: '보관된 토론입니다. 새 글·투표·의견은 받지 않습니다.' },
    { status: 410 },
  );
}
