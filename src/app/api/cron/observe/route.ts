import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { dbw } from '@/lib/cron-db-log';

// ⚠️ Rule #18 — vercel.json 의 `"src/app/api/**" 캐치올(maxDuration 30)이 이 줄을 «덮는다».
//    첫 배포에서 실제로 30초에 걸려 504(FUNCTION_INVOCATION_TIMEOUT)가 났다.
//    vercel.json 의 functions 에 observe 항목(120초)을 «반드시» 같이 둔다 —
//    여기만 고치면 아무 일도 일어나지 않는다.
//    실측: get_weekly_trades 가 지역당 4~11초(부산 16구군 4.2s · 울산 10.7s · 경남 5.4s).
//
// ⛔ 이 주석을 «블록 주석으로 되돌리지 말 것». vercel.json 의 glob 을 그대로 적으면
//    그 안의 `*` + `/` 가 블록 주석을 «조기 종료» 시켜 빌드가 깨진다(2026-08-27 실제 발생).
export const maxDuration = 120;

/**
 * A6 — 관측 크론.
 *
 * ── 무엇을 하나 ─────────────────────────────────────────────────────────────
 * 「우리가 본 것」을 사실 그대로 한 줄로 쌓는다. **해석도 예측도 없다.**
 * 이슈 파이프라인이 AI 로 글을 만드는 것과 다르다 — 여기는 숫자와 날짜뿐이라
 * AI 를 «한 번도 부르지 않는다».
 *
 * 이번 커밋은 3종이다: trade · schedule · stage.
 * (unsold · digest · issue 는 Phase B4)
 *
 * ── 게이트 (전부 통과해야 INSERT) ───────────────────────────────────────────
 *   ① 숫자가 최소 하나 — 숫자 없는 관측은 「무슨 일이 있었다」일 뿐이다
 *   ② link_path 가 있다 — 눌러서 갈 곳 없는 줄은 목록만 늘린다
 *   ③ observed_at 이 있다 — 언제 본 것인지 없으면 신선도를 못 판단한다
 *   ④ source_ref 가 유일 — 같은 사실을 두 번 쌓지 않는다(DB unique 로도 잠근다)
 *   ⑤ 잡담 패턴 불일치 — 시드 글 말투가 섞이면 관측이 아니라 게시물이 된다
 *   ⑥ 하루 총 12건 상한
 *
 * ⛔ 「오늘·어제」를 쓰지 않는다. 실거래는 신고 지연이 있어 「오늘」이 오늘이 아니다.
 * ⛔ 주식 관측 없음.
 */

/** ⑤ 사람이 쓴 말투. 관측에 이런 게 섞이면 사실이 아니라 감상이다. */
const CHATTER = /궁금|ㅋㅋ|같아요|저는|어떻게 생각/;

/** 하루 상한. 넘으면 그날은 더 쌓지 않는다 — 목록이 길어지면 아무도 안 읽는다. */
const DAILY_CAP = 12;

interface Draft {
  apt_site_id: string | null;
  region: string | null;
  sigungu: string | null;
  kind: 'trade' | 'schedule' | 'stage';
  title: string;
  body: string | null;
  link_path: string;
  source_ref: string;
  observed_at: string;
}

/** 게이트. 통과 못 하면 이유를 돌려준다 — 「몇 건 만들었다」만으로는 왜 안 만들어졌는지 모른다. */
function gate(d: Draft): string | null {
  if (!/\d/.test(d.title)) return 'no_number';
  if (!d.link_path) return 'no_link';
  if (!d.observed_at) return 'no_date';
  if (!d.source_ref) return 'no_ref';
  if (CHATTER.test(d.title) || (d.body && CHATTER.test(d.body))) return 'chatter';
  return null;
}

const won = (manwon: number | null | undefined): string => {
  const v = Number(manwon) || 0;
  if (v <= 0) return '';
  const eok = Math.floor(v / 10000);
  const rest = Math.round((v % 10000) / 1000) * 1000;
  if (eok <= 0) return `${v.toLocaleString('ko-KR')}만`;
  return rest > 0 ? `${eok}억 ${(rest / 1000) * 1000 === rest ? (rest / 1000) : rest}천` : `${eok}억`;
};

const md = (d: string | null): string => {
  if (!d) return '';
  const [, m, day] = d.split('-');
  return m && day ? `${Number(m)}월 ${Number(day)}일` : '';
};

/** 커버 지역. ⚠️ 화면 카피가 아니라 «수집 범위» 다 — 여기 지역명은 남는다(§0-2). */
const REGIONS = ['부산', '울산', '경남'];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('observe', async () => {
    const sb = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const skipped: Record<string, number> = {};
    const bump = (k: string) => { skipped[k] = (skipped[k] ?? 0) + 1; };

    // 하루 상한은 «만들기 전에» 본다. 만들고 나서 세면 이미 늦다.
    const { count: todayCount } = await (sb as any)
      .from('apt_observations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00Z`);
    let budget = DAILY_CAP - (todayCount ?? 0);
    if (budget <= 0) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'daily_cap', today_count: todayCount } };
    }

    const drafts: Draft[] = [];

    /* ── ① trade — 구군당 «주 1건» ────────────────────────────────────────── */
    for (const region of REGIONS) {
      const { data: rows, error } = await (sb as any).rpc('get_weekly_trades', {
        p_region: region, p_days: 7, p_settle_days: 4,
      });
      if (error) { console.error(`[observe] weekly_trades ${region}: ${error.message?.slice(0, 160)}`); continue; }
      for (const r of (rows ?? []) as any[]) {
        // ⚠️ 지역이 «정지» 했으면 만들지 않는다. 「이번 주 0건」이 시장이 조용한 것인지
        //    수집이 멈춘 것인지 구분되지 않는다. 섞으면 거짓말이 된다.
        if (r.is_stale) { bump('stale_region'); continue; }
        const area = r.top_area ? `${Math.round(Number(r.top_area))}㎡` : '';
        const price = won(r.top_amount);
        if (!price) { bump('no_price'); continue; }
        drafts.push({
          apt_site_id: null,
          region, sigungu: r.sigungu,
          kind: 'trade',
          title: `${r.sigungu} 이번 주 실거래 ${r.deals}건 — ${r.top_apt} ${area} 최고 ${price} (${md(r.top_deal_date)})`,
          body: null,
          link_path: `/apt/region/${encodeURIComponent(region)}/${encodeURIComponent(r.sigungu)}`,
          // ⚠️ 구군당 주 1건 — source_ref 에 «주» 를 넣어 같은 주에 두 번 안 쌓이게 한다.
          source_ref: `apt_transactions:${r.top_tx_id}`,
          observed_at: r.top_deal_date,
        });
      }
    }

    /* ── ② schedule — 「내일」 일어나는 일 ────────────────────────────────── */
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const EVENTS: Array<[string, string]> = [
      ['rcept_bgnde', '청약 접수 시작'],
      ['przwner_presnatn_de', '당첨자 발표'],
      ['cntrct_cncls_bgnde', '계약 시작'],
    ];
    for (const [field, label] of EVENTS) {
      const { data: subs, error } = await (sb as any)
        .from('apt_subscriptions')
        .select(`id, house_nm, region_nm, tot_supply_hshld_co, ${field}`)
        .eq(field, tomorrow)
        .in('region_nm', REGIONS)
        .limit(20);
      if (error) { console.error(`[observe] schedule ${field}: ${error.message?.slice(0, 160)}`); continue; }
      for (const s of (subs ?? []) as any[]) {
        const units = Number(s.tot_supply_hshld_co) || 0;
        drafts.push({
          apt_site_id: null,
          region: s.region_nm, sigungu: null,
          kind: 'schedule',
          // ⛔ 「내일」은 쓴다 — 예정된 «일정» 이라 신고 지연 문제가 없다.
          //    금지된 것은 실거래에 「오늘·어제」를 붙이는 것이다.
          title: `${s.house_nm} 내일 ${label}${units > 0 ? ` · ${units.toLocaleString('ko-KR')}세대` : ''}`,
          body: null,
          link_path: `/apt?region=${encodeURIComponent(s.region_nm || '')}`,
          source_ref: `apt_subscriptions:${s.id}:${field}`,
          observed_at: tomorrow,
        });
      }
    }

    /* ── ③ stage — 24시간 안에 «인가 계열» 단계가 바뀐 현장 ───────────────── */
    const STAGE_LABEL: Record<string, string> = {
      union_established: '조합 설립',
      plan_approved: '사업시행인가',
      mgmt_approved: '관리처분인가',
      construction: '착공',
    };
    const since = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data: moved, error: movedErr } = await (sb as any)
      .from('apt_sites')
      .select('id, slug, name, region, sigungu, total_units, lifecycle_stage, previous_stage, stage_source, stage_updated_at')
      .gte('stage_updated_at', since)
      .in('lifecycle_stage', Object.keys(STAGE_LABEL))
      .in('region', REGIONS)
      .limit(30);
    if (movedErr) console.error(`[observe] stage: ${movedErr.message?.slice(0, 160)}`);
    for (const s of (moved ?? []) as any[]) {
      const to = STAGE_LABEL[s.lifecycle_stage] || s.lifecycle_stage;
      const from = STAGE_LABEL[s.previous_stage] || s.previous_stage || '';
      const units = Number(s.total_units) || 0;
      // ⚠️ 숫자가 하나는 있어야 게이트를 통과한다. 세대수가 없으면 이 관측은 버린다 —
      //    「단계가 바뀌었다」만으로는 독자가 크기를 가늠할 수 없다.
      if (units <= 0) { bump('stage_no_units'); continue; }
      drafts.push({
        apt_site_id: s.id,
        region: s.region, sigungu: s.sigungu,
        kind: 'stage',
        title: `${s.name} ${from ? `${from}→` : ''}${to} · ${units.toLocaleString('ko-KR')}세대${s.stage_source ? ` (${s.stage_source})` : ''}`,
        body: null,
        link_path: `/apt/${encodeURIComponent(s.slug || s.id)}`,
        source_ref: `apt_sites:${s.id}:${s.lifecycle_stage}`,
        observed_at: String(s.stage_updated_at).slice(0, 10),
      });
    }

    /* ── 게이트 → INSERT ─────────────────────────────────────────────────── */
    /* ⚠️ 상한을 «시급한 순서» 로 나눈다.
     *
     * 첫 실행 실측: draft 21건이 전부 trade 였고(부산 16구군 + 울산 5) 하루 12건을
     * 그대로 다 먹었다. 그대로 두면 「내일 청약 접수 시작」 같은 «시한이 있는» 관측이
     * 매일 밀린다 — 실거래 요약은 내일 봐도 같지만 내일 시작하는 접수는 내일이면 늦다.
     *
     * 그래서 kind 우선순위로 정렬한 «뒤» 상한을 적용한다. 상한값(12)은 그대로다.
     *   schedule(시한 있음) > stage(하루 안에 일어난 변화) > trade(주 단위 요약)
     */
    const KIND_PRIORITY: Record<Draft['kind'], number> = { schedule: 0, stage: 1, trade: 2 };
    const ordered = [...drafts].sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]);

    const passed: Draft[] = [];
    for (const d of ordered) {
      const why = gate(d);
      if (why) { bump(why); continue; }
      if (passed.length >= budget) { bump(`daily_cap_${d.kind}`); continue; }
      passed.push(d);
    }

    let created = 0;
    if (passed.length > 0) {
      // ⚠️ source_ref 가 unique 라 중복은 DB 가 막는다. onConflict 로 «조용히» 넘긴다 —
      //    같은 사실을 다시 본 것은 오류가 아니다.
      const res = await (sb as any)
        .from('apt_observations')
        .upsert(passed, { onConflict: 'source_ref', ignoreDuplicates: true })
        .select('id');
      dbw('observe', 'apt_observations.upsert', res);
      created = res.data?.length ?? 0;
    }

    return {
      processed: drafts.length,
      created,
      failed: 0,
      // ⛔ 「대상 0건」만 찍고 끝내지 않는다. 왜 안 만들어졌는지가 로그에 남아야 한다
      //    (P1 에서 -1 이 2,483건을 조용히 막고 있던 것과 같은 침묵을 만들지 않는다).
      metadata: { drafts: drafts.length, passed: passed.length, created, skipped, budget },
    };
  });

  if (!result.success) return NextResponse.json({ success: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
}
