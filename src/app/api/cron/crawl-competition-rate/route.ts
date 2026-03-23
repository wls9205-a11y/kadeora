import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 60;

/**
 * 청약 경쟁률 수집 크론
 * 소스: 공공데이터포털 청약홈 경쟁률 API
 * 접수 마감된 청약 중 경쟁률이 없는 건에 대해 수집
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const APT_API_KEY = process.env.APT_DATA_API_KEY;
  if (!APT_API_KEY) return NextResponse.json({ success: true, error: 'APT_DATA_API_KEY not set' });

  const result = await withCronLogging('crawl-competition-rate', async () => {
    const supabase = getSupabaseAdmin();

    // 접수 마감 + 경쟁률 없는 청약 조회 (최근 6개월)
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
    const { data: targets } = await supabase
      .from('apt_subscriptions')
      .select('id, house_manage_no, house_nm')
      .lt('rcept_endde', new Date().toISOString().slice(0, 10))
      .gte('rcept_endde', sixMonthsAgo)
      .is('competition_rate_1st', null)
      .limit(30);

    if (!targets || targets.length === 0) {
      return { processed: 0, created: 0, failed: 0, metadata: { message: 'No targets' } };
    }

    let updated = 0;
    for (const apt of targets) {
      try {
        // 청약홈 경쟁률 API
        const url = `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancMdl?serviceKey=${encodeURIComponent(APT_API_KEY)}&cond[HOUSE_MANAGE_NO::EQ]=${apt.house_manage_no}&perPage=50`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        const items = json?.data || [];

        if (Array.isArray(items) && items.length > 0) {
          // 경쟁률 계산: 전체 지원자 / 전체 공급
          let totalApply = 0;
          let totalSupply = 0;
          for (const item of items) {
            const apply = parseInt(item.RCEPT_CNT || item.rceptCnt || '0') || 0;
            const supply = parseInt(item.SUPLY_HSHLDCO || item.suplyHshldco || '0') || 0;
            totalApply += apply;
            totalSupply += supply;
          }

          if (totalSupply > 0) {
            const rate = Math.round((totalApply / totalSupply) * 10) / 10;
            await supabase.from('apt_subscriptions').update({
              competition_rate_1st: rate,
              total_apply_count: totalApply,
              supply_count: totalSupply,
              competition_updated_at: new Date().toISOString(),
            }).eq('id', apt.id);
            updated++;
          }
        }

        // 평형별 정보도 저장
        if (items.length > 0) {
          const typeInfo = items.map((item: any) => ({
            type: item.HOUSE_TY || item.houseTy || '',
            area: item.SUPLY_AR || item.suplyAr || '',
            supply: parseInt(item.SUPLY_HSHLDCO || item.suplyHshldco || '0') || 0,
            apply: parseInt(item.RCEPT_CNT || item.rceptCnt || '0') || 0,
            rate: (() => {
              const s = parseInt(item.SUPLY_HSHLDCO || item.suplyHshldco || '0') || 0;
              const a = parseInt(item.RCEPT_CNT || item.rceptCnt || '0') || 0;
              return s > 0 ? Math.round((a / s) * 10) / 10 : 0;
            })(),
          }));
          await supabase.from('apt_subscriptions').update({
            house_type_info: typeInfo,
          }).eq('id', apt.id);
        }
      } catch {}
    }

    return {
      processed: targets.length,
      created: updated,
      failed: targets.length - updated,
      metadata: { api_name: 'odcloud_competition' },
    };
  });

  if (!result.success) return NextResponse.json({ success: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
}
