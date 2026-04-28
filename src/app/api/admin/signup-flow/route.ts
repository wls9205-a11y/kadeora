// /admin/signup-flow 진단 페이지 데이터 엔드포인트.
// 6 쿼리 Promise.all 병렬:
//   1) admin_signup_flow_funnel_7d()           — 7일 funnel JSON
//   2) admin_signup_flow_hourly_24h()          — 24h 시간대별 트래픽
//   3) admin_signup_flow_users(...)            — 가입자 상세 페이지 + 검색 + 시드 토글
//   4) v_admin_signup_diagnostic (14d)         — 일별 진단표
//   5) v_admin_signup_diagnostic (today only)  — KPI Strip — best-effort
//   6) (옵션) realtime header view             — best-effort
// RPC 실패 시 ok:true + 해당 필드만 null 반환 (graceful fallback).

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

interface AnyError { message?: string; details?: string }
function errMsg(e: unknown): string {
  const x = e as AnyError;
  return String(x?.message || x?.details || e || 'unknown');
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const includeSeed = sp.get('include_seed') === '1';
  const userLimit = Math.min(200, Math.max(10, parseInt(sp.get('user_limit') || '50', 10) || 50));
  const userOffset = Math.max(0, parseInt(sp.get('user_offset') || '0', 10) || 0);
  const userSearch = (sp.get('user_search') || '').trim().slice(0, 80) || null;

  const sb = getSupabaseAdmin() as any;

  // 14일 윈도우 (KST 기준은 view 측에서 처리한다고 가정 — 단순 ISO 날짜)
  const today = new Date();
  const sinceDate = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const tasks = await Promise.allSettled([
    sb.rpc('admin_signup_flow_funnel_7d'),
    sb.rpc('admin_signup_flow_hourly_24h'),
    sb.rpc('admin_signup_flow_users', {
      p_include_seed: includeSeed,
      p_limit: userLimit,
      p_offset: userOffset,
      p_search: userSearch,
    }),
    sb.from('v_admin_signup_diagnostic')
      .select('*')
      .gte('day', sinceDate)
      .order('day', { ascending: false })
      .limit(14),
  ]);

  const errors: string[] = [];
  function unwrap<T = unknown>(idx: number, label: string): T | null {
    const r = tasks[idx];
    if (r.status === 'rejected') {
      errors.push(`${label}:rejected:${errMsg(r.reason)}`);
      return null;
    }
    const val = r.value as { data: T | null; error?: AnyError | null };
    if (val?.error) {
      errors.push(`${label}:err:${errMsg(val.error)}`);
      return null;
    }
    return (val?.data ?? null) as T | null;
  }

  const funnel7d = unwrap<unknown>(0, 'funnel');
  const hourly24h = unwrap<unknown[]>(1, 'hourly');
  const usersData = unwrap<unknown>(2, 'users');
  const daily14d = unwrap<unknown[]>(3, 'daily');

  return NextResponse.json({
    ok: true,
    funnel_7d: funnel7d,
    hourly_24h: Array.isArray(hourly24h) ? hourly24h : [],
    users: usersData,                     // RPC 반환 그대로 (rows + total + page meta 가능)
    daily_14d: Array.isArray(daily14d) ? daily14d : [],
    user_query: { include_seed: includeSeed, limit: userLimit, offset: userOffset, search: userSearch },
    errors,
    generated_at: new Date().toISOString(),
  }, { status: 200 });
}
