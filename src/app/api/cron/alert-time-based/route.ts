import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Phase 4 A4: 시간 기반 알림 cron
// - D-3 청약 임박 (apt_subscriptions.rcept_bgnde = today + 3)
// - D-day 발표일 (apt_subscriptions.przwner_presnatn_de = today)
// notifications 직접 INSERT — 단 시간 트리거 + 강한 idempotency(같은 단지 같은 type 같은 날 1회)로 트리거 룰 정신 보존.
// CLAUDE.md: 외부 cron(GitHub Actions/cron-job.org) 또는 vercel cron 등록 필요. 이 라우트 자체는 Bearer 인증.

interface SiteInterestRow {
  user_id: string;
  site_id: string;
}

async function notifyInterested(
  admin: ReturnType<typeof getSupabaseAdmin>,
  siteId: string | null,
  type: string,
  content: string,
  link: string,
): Promise<number> {
  if (!siteId) return 0;
  // 같은 type + 같은 link 가 24h 내에 이미 발송된 user 제외 (idempotency)
  const { data: interests } = await (admin as any).from('apt_site_interests')
    .select('user_id, site_id')
    .eq('site_id', siteId)
    .not('user_id', 'is', null);
  const rows = (interests ?? []) as SiteInterestRow[];
  if (rows.length === 0) return 0;
  // 모든 후보 user 한 번에 INSERT, ON CONFLICT 없으니 dedup query 별도
  const userIds = Array.from(new Set(rows.map(r => r.user_id)));
  const since = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await admin.from('notifications')
    .select('user_id')
    .eq('type', type)
    .eq('link', link)
    .in('user_id', userIds)
    .gte('created_at', since);
  const sentSet = new Set(((existing ?? []) as Array<{ user_id: string }>).map(r => r.user_id));
  const targets = userIds.filter(u => !sentSet.has(u));
  if (targets.length === 0) return 0;
  const inserts = targets.map(u => ({
    user_id: u,
    type,
    content,
    link,
    is_read: false,
    created_at: new Date().toISOString(),
  }));
  const { error } = await (admin as any).from('notifications').insert(inserts);
  if (error) {
    console.error('[alert-time-based] insert error', error);
    return 0;
  }
  return targets.length;
}

async function findSiteIdByName(
  admin: ReturnType<typeof getSupabaseAdmin>,
  name: string,
): Promise<{ siteId: string | null; siteSlug: string | null }> {
  if (!name) return { siteId: null, siteSlug: null };
  const trimmed = name.trim();
  const { data } = await (admin as any).from('apt_sites')
    .select('id, slug')
    .eq('name', trimmed)
    .eq('is_active', true)
    .order('popularity_score', { ascending: false, nullsFirst: false })
    .limit(1).maybeSingle();
  if (data) return { siteId: (data as any).id, siteSlug: (data as any).slug };
  return { siteId: null, siteSlug: null };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today_plus_3 = new Date(Date.now() + (9 + 24 * 3) * 60 * 60 * 1000).toISOString().slice(0, 10);

  let total_d3 = 0;
  let total_dday = 0;
  let total_score_match = 0;
  const errors: string[] = [];

  try {
    // 1) D-3 청약 임박
    const { data: d3Subs } = await admin.from('apt_subscriptions')
      .select('id, house_nm, region_nm, rcept_bgnde')
      .eq('rcept_bgnde', today_plus_3)
      .limit(50);
    for (const sub of (d3Subs ?? [])) {
      const { siteId, siteSlug } = await findSiteIdByName(admin, (sub as any).house_nm);
      if (!siteId) continue;
      const link = `/apt/${siteSlug}`;
      const content = `${(sub as any).house_nm} 청약 D-3 — 3일 후 접수 시작 (${(sub as any).region_nm || ''})`;
      total_d3 += await notifyInterested(admin, siteId, 'apt_d3_alert', content, link);
    }

    // 2) D-day 발표일
    const { data: ddaySubs } = await admin.from('apt_subscriptions')
      .select('id, house_nm, region_nm, przwner_presnatn_de')
      .eq('przwner_presnatn_de', today)
      .limit(50);
    for (const sub of (ddaySubs ?? [])) {
      const { siteId, siteSlug } = await findSiteIdByName(admin, (sub as any).house_nm);
      if (!siteId) continue;
      const link = `/apt/${siteSlug}`;
      const content = `${(sub as any).house_nm} 당첨자 발표일 — 오늘 결과 확인하세요`;
      total_dday += await notifyInterested(admin, siteId, 'apt_award_dday', content, link);
    }

    // 3) 가점 매칭 — 2주 내 청약 단지 × cheongak_score>=추정-5 × target_regions 매칭
    // 추정 당첨 가점은 apt_competition_rates에 기록 안 됨 → baseline 60 사용 (수도권 평균)
    const ESTIMATED_MIN_SCORE = 60;
    const fortnight = new Date(Date.now() + (9 + 24 * 14) * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: upcomingSubs } = await admin.from('apt_subscriptions')
      .select('id, house_nm, region_nm, rcept_bgnde')
      .gte('rcept_bgnde', today)
      .lte('rcept_bgnde', fortnight)
      .limit(80);

    const since = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    for (const sub of (upcomingSubs ?? [])) {
      const subAny = sub as any;
      const { siteId, siteSlug } = await findSiteIdByName(admin, subAny.house_nm);
      if (!siteId || !subAny.region_nm) continue;
      const regionToken = String(subAny.region_nm).split(/\s+/)[0];

      // 가점 ≥ ESTIMATED-5 + 관심 지역에 단지 region 포함 (배열 contains)
      const { data: matchedProfiles } = await (admin as any).from('profiles')
        .select('id')
        .gte('cheongak_score', ESTIMATED_MIN_SCORE - 5)
        .contains('cheongak_target_regions', [regionToken])
        .limit(200);
      const userIds = ((matchedProfiles ?? []) as Array<{ id: string }>).map(r => r.id).filter(Boolean);
      if (userIds.length === 0) continue;

      const link = `/apt/${siteSlug}`;
      // 24h dedup: 같은 type+link 발송한 user 제외
      const { data: existing } = await admin.from('notifications')
        .select('user_id')
        .eq('type', 'cheongak_match')
        .eq('link', link)
        .in('user_id', userIds)
        .gte('created_at', since);
      const sentSet = new Set(((existing ?? []) as Array<{ user_id: string }>).map(r => r.user_id));
      const targets = userIds.filter(u => !sentSet.has(u));
      if (targets.length === 0) continue;

      const inserts = targets.map(u => ({
        user_id: u,
        type: 'cheongak_match',
        content: `${subAny.house_nm} — 내 가점으로 당첨 가능 (예상 최저 ${ESTIMATED_MIN_SCORE}점, ${subAny.region_nm}, ${subAny.rcept_bgnde} 접수)`,
        link,
        is_read: false,
        created_at: new Date().toISOString(),
      }));
      const { error: insertErr } = await (admin as any).from('notifications').insert(inserts);
      if (insertErr) {
        errors.push(`cheongak_match ${siteSlug}: ${insertErr.message}`);
      } else {
        total_score_match += targets.length;
      }
    }
  } catch (err: any) {
    console.error('[alert-time-based] error', err);
    errors.push(err?.message ?? String(err));
  }

  return NextResponse.json({
    ok: true,
    today,
    today_plus_3,
    notifications_sent: {
      d3: total_d3,
      dday: total_dday,
      cheongak_match: total_score_match,
      total: total_d3 + total_dday + total_score_match,
    },
    errors: errors.length > 0 ? errors : undefined,
  });
}
