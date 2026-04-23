import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const VALID_METRICS = new Set(['LCP', 'CLS', 'INP', 'TTFB', 'FCP']);
const VALID_RATINGS = new Set(['good', 'needs-improvement', 'poor']);

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    let body: any;
    try { body = JSON.parse(text); } catch { return NextResponse.json({ ok: true }); }

    const { page_path, metric_name, value, rating, device } = body || {};
    if (!VALID_METRICS.has(metric_name) || typeof value !== 'number' || !VALID_RATINGS.has(rating)) {
      return NextResponse.json({ ok: true });
    }

    const ua = req.headers.get('user-agent') || '';
    const uaHash = createHash('sha256').update(ua).digest('hex').slice(0, 16);

    // fire-and-forget insert
    try {
      const sb = getSupabaseAdmin();
      (sb as any)
        .from('web_vitals')
        .insert({
          page_path: String(page_path || '/').slice(0, 300),
          metric_name,
          value: Math.round(Number(value) * 1000) / 1000,
          rating,
          device: device === 'mobile' ? 'mobile' : 'desktop',
          user_agent_hash: uaHash,
        })
        .then(() => {})
        .catch(() => {});
    } catch {}

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
