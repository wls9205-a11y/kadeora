import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse()
  try {
    const { id } = await params
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    // 중복 신고 체크
    const { count } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', user.id)
      .eq('post_id', Number(id))
    if (count && count > 0) {
      return NextResponse.json({ error: '이미 신고한 게시글입니다.' }, { status: 409 })
    }

    const body = await req.json().catch(() => ({}))
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      post_id: Number(id),
      reason: body.reason || '사용자 신고',
      details: body.details ?? null,
      status: 'pending',
      content_type: 'post',
      auto_hidden: false,
    })
    if (error) return NextResponse.json({ error: '신고 접수에 실패했습니다.' }, { status: 500 })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
