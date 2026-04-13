import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
// award_points RPC 직접 사용

/**
 * POST /api/apt/interest
 * 블로그 포스트 → 관심단지 알림 등록 (단순화 버전)
 *
 * apt_name 또는 site_slug로 apt_sites.id 조회 → apt_site_interests INSERT
 * 이미 등록: 409 (중복 아님, 그냥 done 처리)
 * 포인트: 관심단지등록 50P (최초 1회)
 */
export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();

  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { apt_name, site_slug, source = 'blog_cta' } = await req.json();
    if (!apt_name && !site_slug) {
      return NextResponse.json({ error: 'apt_name 또는 site_slug 필요' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // 1. apt_sites에서 site_id 조회
    let siteId: string | null = null;
    try {
      const query = (admin as any).from('apt_sites').select('id').eq('is_active', true);
      const { data: site } = site_slug
        ? await query.eq('slug', site_slug).maybeSingle()
        : await query.ilike('name', apt_name).limit(1).maybeSingle();
      siteId = site?.id || null;
    } catch {}

    if (!siteId) {
      // apt_sites에 없으면 apt_bookmarks에 apt_name 기록 (fallback)
      // price_alerts 테이블에 apt 알림으로 등록
      const existing = await (admin as any).from('price_alerts')
        .select('id').eq('user_id', user.id).eq('alert_type', 'apt_name').eq('target_symbol', apt_name).maybeSingle();

      if (!existing.data) {
        await (admin as any).from('price_alerts').insert({
          user_id: user.id,
          alert_type: 'apt_name',
          target_symbol: apt_name,
          condition: 'any_change',
          threshold: 0,
          is_active: true,
          is_triggered: false,
        });
        // 포인트 지급
        await admin.rpc('award_points', { p_user_id: user.id, p_amount: 50, p_reason: '관심단지등록' });
      }
      return NextResponse.json({ ok: true, method: 'price_alert' });
    }

    // 2. apt_site_interests 중복 체크
    const { data: existing } = await admin.from('apt_site_interests')
      .select('id').eq('site_id', siteId).eq('user_id', user.id).maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, already: true });
    }

    // 3. 관심 등록 INSERT
    await admin.from('apt_site_interests').insert({
      site_id: siteId,
      user_id: user.id,
      is_member: true,
      notification_enabled: true,
      source,
    });

    // apt_sites interest_count 증가
    try {
      await (admin as any).rpc('increment_site_interest', { site_id: siteId });
    } catch {}

    // 포인트 지급
    await admin.rpc('award_points', { p_user_id: user.id, p_amount: 50, p_reason: '관심단지등록' });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[apt/interest POST]', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
