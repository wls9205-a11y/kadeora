import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { withCronAuth } from '@/lib/cron-auth';
import { dbw } from '@/lib/cron-db-log';
import { anthropicFetch } from '@/lib/llm/gateway';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * FINAL_HC_20260913 A-2 — 25s → 60s.
 * 원장 실측: 9/8 관문 배포 이후 이 크론 에러 전건이 `network:TimeoutError`(=이 abort)였다.
 * 프롬프트가 「2,000자+ 5섹션」을 요구하고 max_tokens 4000 이라 25s 로는 생성이 끝나지 않는다.
 * ⚠️ 루프 가드는 이 값에서 파생한다. 60s 콜이 250s 에 시작하면 maxDuration(300) 을 넘겨
 *    함수가 킬되고 withCronLogging 이 한 줄도 못 남긴다 — 관측이 통째로 사라진다.
 */
const ANALYSIS_TIMEOUT_MS = 60_000;
const LOOP_BUDGET_MS = maxDuration * 1000 - ANALYSIS_TIMEOUT_MS - 20_000;

async function handler(_req: NextRequest) {
  const result = await withCronLogging('apt-analysis-gen', async () => {
    const admin = getSupabaseAdmin();

    const { data: sites } = await (admin as any).from('apt_sites')
      .select('id, slug, name, region, sigungu, dong, address, builder, developer, total_units, built_year, move_in_date, status, price_min, price_max, nearby_station, school_district, nearby_facilities, transit_score, price_comparison, extension_cost')
      .is('analysis_text', null)
      .eq('is_active', true)
      .order('page_views', { ascending: false, nullsFirst: false })
      .limit(5);

    if (!sites || sites.length === 0) return { processed: 0, metadata: { reason: 'all_done' } };

    let processed = 0;
    // ⚠️ 스킵을 «세고 적는다». 전에는 `continue`·`catch {}` 가 아무것도 안 남겨서
    //    「전패」가 원장에만 보이고 cron_logs 는 processed 0 한 줄뿐이었다.
    const skips = { not_ok: 0, timeout: 0, short_text: 0, error: 0, budget: 0 };
    const calls: Array<{ slug: string; ms: number; prompt_chars: number; status?: number; stop_reason?: string; text_chars?: number; err?: string }> = [];

    const start = Date.now();
    for (const site of sites) {
      if (Date.now() - start > LOOP_BUDGET_MS) { skips.budget++; break; }
      let call: (typeof calls)[number] | null = null;
      let t0 = 0;
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
        t0 = Date.now();
        call = { slug: site.slug, ms: 0, prompt_chars: prompt.length };
        calls.push(call);
        const res = await anthropicFetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': ANTHROPIC_VERSION },
          body: JSON.stringify({ model: AI_MODEL_HAIKU, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
        }, { caller: 'apt-analysis-gen', category: 'realestate', siteId: site.id, metadata: { prompt_chars: prompt.length } });

        call.status = res.status;
        if (!res.ok) { call.ms = Date.now() - t0; skips.not_ok++; continue; }
        const data = await res.json();
        call.ms = Date.now() - t0;
        call.stop_reason = String(data?.stop_reason ?? '?');
        const text = data.content?.[0]?.text;
        call.text_chars = text?.length ?? 0;
        if (!text || text.length < 500) { skips.short_text++; continue; }

        dbw('apt-analysis-gen', 'apt_sites.update@55', await (admin as any).from('apt_sites')
          .update({ analysis_text: text, analysis_generated_at: new Date().toISOString() })
          .eq('id', site.id));
        processed++;
      } catch (e: any) {
        const name = String(e?.name ?? '');
        if (call) { call.ms = call.ms || Date.now() - t0; call.err = `${name}:${String(e?.message ?? e).slice(0, 80)}`; }
        if (name === 'TimeoutError' || name === 'AbortError') skips.timeout++;
        else skips.error++;
      }
    }

    return { processed, metadata: { total: sites.length, timeout_ms: ANALYSIS_TIMEOUT_MS, skips, calls } };
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

export const GET = withCronAuth(handler);
