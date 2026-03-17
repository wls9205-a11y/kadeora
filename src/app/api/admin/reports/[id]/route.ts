import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  const { id } = await params;
  const { action } = await req.json();

  if (action === 'resolve') {
    await supabase.from('reports').update({ status: 'resolved' }).eq('id', Number(id));
  } else if (action === 'dismiss') {
    await supabase.from('reports').update({ status: 'dismissed' }).eq('id', Number(id));
  } else if (action === 'hide_content') {
    // Get the report first to find what content to hide
    const { data: report } = await supabase.from('reports').select('post_id, comment_id, content_type').eq('id', Number(id)).single();
    if (report) {
      if (report.post_id) {
        await supabase.from('posts').update({ is_deleted: true }).eq('id', report.post_id);
      }
      if (report.comment_id) {
        await supabase.from('comments').update({ is_deleted: true }).eq('id', report.comment_id);
      }
    }
    await supabase.from('reports').update({ status: 'resolved' }).eq('id', Number(id));
  } else {
    return NextResponse.json({ error: '알 수 없는 액션' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
