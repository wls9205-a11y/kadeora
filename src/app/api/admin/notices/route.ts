import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  const { data } = await admin.from('site_notices')
    .select('id, content, is_active, created_at')
    .order('created_at', { ascending: false }).limit(50);

  return NextResponse.json({ notices: data || [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin, user } = auth;

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: '내용 필수' }, { status: 400 });

  // 기존 활성 공지 비활성화
  await admin.from('site_notices').update({ is_active: false }).eq('is_active', true);
  // 새 공지 등록
  const { error } = await admin.from('site_notices').insert({ content: content.trim(), is_active: true, author_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  const { id, is_active } = await req.json();
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });

  if (is_active) {
    await admin.from('site_notices').update({ is_active: false }).eq('is_active', true);
  }
  await admin.from('site_notices').update({ is_active }).eq('id', id);

  return NextResponse.json({ success: true });
}
