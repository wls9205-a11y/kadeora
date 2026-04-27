import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

interface UpdatePayload {
  no_house_period_months?: number | null;
  dependents_count?: number | null;
  savings_period_months?: number | null;
  cheongak_target_regions?: string[];
  cheongak_target_unit_min?: number | null;
  cheongak_target_unit_max?: number | null;
}

function clampInt(v: any, min: number, max: number): number | null {
  if (v == null || v === '') return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

export async function GET() {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await (sb as any).from('profiles')
    .select('cheongak_score, no_house_period_months, dependents_count, savings_period_months, cheongak_target_regions, cheongak_target_unit_min, cheongak_target_unit_max, cheongak_score_updated_at')
    .eq('id', user.id).maybeSingle();
  return NextResponse.json({ ok: true, profile: data ?? null });
}

export async function PUT(req: NextRequest) {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: UpdatePayload;
  try { body = await req.json() as UpdatePayload; } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update: Record<string, any> = {};
  if ('no_house_period_months' in body) {
    update.no_house_period_months = clampInt(body.no_house_period_months, 0, 240);
  }
  if ('dependents_count' in body) {
    update.dependents_count = clampInt(body.dependents_count, 0, 10);
  }
  if ('savings_period_months' in body) {
    update.savings_period_months = clampInt(body.savings_period_months, 0, 240);
  }
  if ('cheongak_target_regions' in body) {
    update.cheongak_target_regions = Array.isArray(body.cheongak_target_regions)
      ? body.cheongak_target_regions.filter(r => typeof r === 'string' && r.length > 0).slice(0, 10)
      : [];
  }
  if ('cheongak_target_unit_min' in body) {
    update.cheongak_target_unit_min = clampInt(body.cheongak_target_unit_min, 0, 1_000_000);
  }
  if ('cheongak_target_unit_max' in body) {
    update.cheongak_target_unit_max = clampInt(body.cheongak_target_unit_max, 0, 1_000_000);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await (sb as any).from('profiles')
    .update(update)
    .eq('id', user.id)
    .select('cheongak_score, no_house_period_months, dependents_count, savings_period_months, cheongak_target_regions, cheongak_target_unit_min, cheongak_target_unit_max, cheongak_score_updated_at')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, profile: data });
}
