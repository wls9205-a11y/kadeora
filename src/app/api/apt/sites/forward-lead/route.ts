import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { autoForwardLead, auditLog } from '@/lib/forward-lead';

/** 어드민 수동 전달 API */
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { interest_id, site_id } = await req.json();
    if (!interest_id || !site_id) {
      return NextResponse.json({ error: 'interest_id, site_id 필요' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    await auditLog(sb, 'decrypt_phone', {
      table: 'apt_site_interests',
      id: String(interest_id),
      reason: 'admin_manual_forward',
    }, undefined, ip);

    const result = await autoForwardLead(interest_id, site_id);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** 피처 플래그 상태 + 통계 확인 */
export async function GET() {
  const sb = getSupabaseAdmin();
  const { data: flagData } = await sb.from('feature_flags').select('enabled').eq('key', 'premium_consultant_forwarding').single();
  const { data: leadsData } = await sb.from('consultant_leads').select('status');
  const { data: consultants } = await sb.from('consultant_profiles')
    .select('id').eq('is_active', true);

  return NextResponse.json({
    feature_enabled: flagData?.enabled || false,
    active_consultants: consultants?.length || 0,
    total_leads: leadsData?.length || 0,
  });
}
