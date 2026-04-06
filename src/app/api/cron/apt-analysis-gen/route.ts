import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('apt-analysis-gen', async () => {
    const admin = getSupabaseAdmin();

    const { data: sites } = await (admin as any).from('apt_sites')
      .select('id, slug, name, region, sigungu, dong, address, builder, developer, total_units, built_year, move_in_date, status, price_min, price_max, nearby_station, school_district, nearby_facilities, transit_score, price_comparison, extension_cost')
      .is('analysis_text', null)
      .eq('is_active', true)
      .order('page_views', { ascending: false, nullsFirst: false })
      .limit(15);

    if (!sites || sites.length === 0) return { processed: 0, metadata: { reason: 'all_done' } };

    let processed = 0;

    for (const site of sites) {
      try {
        const hmno = site.slug?.replace(/\D/g, '') || '';
        const { data: sub } = await admin.from('apt_subscriptions')
          .select('tot_supply_hshld_co, competition_rate_1st, constructor_nm, is_price_limit, mvn_prearnge_ym, rcept_bgnde, rcept_endde, region_nm')
          .eq('house_manage_no', hmno)
          .maybeSingle();

        const shortName = site.name?.replace(/[()（）]/g, '').slice(0, 10) || '';
        const { data: trades } = await admin.from('apt_transactions')
          .select('deal_amount, exclusive_area, deal_date, floor')
          .ilike('apt_name', `%${shortName}%`)
          .order('deal_date', { ascending: false })
          .limit(15);

        const prompt = buildPrompt(site, sub, trades || []);
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(25000),
        });

        if (!res.ok) continue;
        const data = await res.json();
        const text = data.content?.[0]?.text;
        if (!text || text.length < 500) continue;

        await (admin as any).from('apt_sites')
          .update({ analysis_text: text, analysis_generated_at: new Date().toISOString() })
          .eq('id', site.id);
        processed++;
      } catch { /* skip */ }
    }

    return { processed, metadata: { total: sites.length } };
  });

  return NextResponse.json(result);
}

function buildPrompt(site: any, sub: any, trades: any[]): string {
  const n = site.name || '';
  const r = site.region || '';
  const b = site.builder || sub?.constructor_nm || '';
  const u = site.total_units || sub?.tot_supply_hshld_co || 0;
  const pMin = site.price_min ? `${(site.price_min / 10000).toFixed(1)}억` : '';
  const pMax = site.price_max ? `${(site.price_max / 10000).toFixed(1)}억` : '';
  const comp = sub?.competition_rate_1st ? `${Number(sub.competition_rate_1st).toFixed(1)}:1` : '';
  const tr = trades.map((t: any) => `${t.deal_date} ${t.exclusive_area}㎡ ${t.floor}층 ${(Number(t.deal_amount)/10000).toFixed(1)}억`).join(' / ');

  return `한국 부동산 전문 분석가로서 "${n}" 현장 종합 분석 2,000자+ 작성.

데이터: 위치=${r} ${site.sigungu||''} ${site.dong||''}, 시공사=${b}, 세대수=${u||'미공개'}, 입주=${site.move_in_date||sub?.mvn_prearnge_ym||'미정'}, 분양가=${pMin||pMax||'미공개'} ${sub?.is_price_limit?'(상한제)':''}, 역=${site.nearby_station||'없음'}, 학군=${site.school_district||'없음'}, 교통점수=${site.transit_score||'-'}/100${comp?`, 경쟁률=${comp}`:''}${tr?`, 실거래=${tr}`:''}

필수 5섹션(## 소제목): 입지분석, 분양가분석, 청약전략, 입주준비가이드([계산하기→](/calc) [가점진단→](/apt/diagnose) 링크 포함), FAQ(### Q. 5개).
규칙: 마크다운, 목차금지, ##안에 볼드금지, 면책문구 마지막.`;
}
