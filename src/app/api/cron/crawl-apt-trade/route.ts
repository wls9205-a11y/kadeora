// 국토부 아파트 매매 실거래 수집 (전국 231개 시군구 × 올해 1월~현재월).
//
// ── D5-1 (2026-08-26) — «관측만» 붙였다. 동작은 한 줄도 바꾸지 않았다 ──
//
// 왜: 경남·광주·전남·제주가 2026-05-27 부터, 충남·경북이 07-23 부터, 충북이 07-28 부터
// 아무도 모르게 죽어 있었다. 3개월 동안 크론은 매번 `success` · `failed: 0` 을 기록했다.
//
// 그게 가능했던 구조:
//   1. `res.ok` 를 안 봤다.
//   2. 공공데이터포털이 «에러 XML» 을 보내도 `<item>` 이 없으므로 파서가 `[]` 를 낸다.
//   3. `[]` → `rows.length === 0` → insert 건너뜀 → `count += 0` → **정상 반환**.
//   4. `Promise.allSettled` 는 reject 된 것만 `failed` 에 넣는데 위 경로는 «절대 reject 하지 않는다».
// → 「이 지역 이번 달 거래 없음」과 「API 가 거부함」을 구분할 수단이 없었다. 이 커밋이 그걸 가른다.
//
// ⚠️ 실측으로 확인한 것 (지시서 초안과 다른 부분이 있다):
//   · 이 API 의 정상 `resultCode` 는 **`000`** 이다. `00` 이 아니다.
//   · 한도 초과·키 오류는 `<resultCode>` 가 아니라 `OpenAPI_ServiceResponse` 봉투
//     (`<returnReasonCode>` + `<returnAuthMsg>` + `<errMsg>`)로 올 수 있다. 둘 다 읽는다.
//   · `apt_transactions` 에는 BEFORE INSERT 트리거 `trg_apt_transactions_skip_duplicates`
//     가 걸려 있어 중복은 «조용히 건너뛴다»(RETURN NULL). 그래서 `.insert()` 는
//     UNIQUE 충돌로 실패하지 «않는다». 「한 행 충돌로 배치 전체가 죽는다」는 성립하지 않는다.
//     대신 `count += rows.length` 가 «시도한» 행을 세므로 records_created 가 과대보고된다
//     (30일 299만 보고 vs 테이블 전체 72.8만). 그 수를 성공 판정에 쓰지 말 것.
//
// ⚠️ 이 커밋 후 데이터는 하나도 안 바뀌어야 한다. 월 범위 · LAWD 코드 · insert · 배치 크기
//    전부 그대로다. 바뀌었다면 동작을 건드린 것이다.
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { readEnvelope } from '@/lib/cron/data-go-kr-envelope';
import { SIGUNGU_LAWD_CODES } from '@/lib/region/lawd';

export const maxDuration = 300; // 5분 (전국 200개 시군구 × 올해 전체 월)

/* LAWD 시군구 코드 — 표는 «공유 모듈» 로 옮겼다 (PV-1).
 *   src/lib/region/lawd.ts  ← 이 파일에 있던 D5-3 실호출 검증본 그대로다.
 * ⚠️ 값·순서·라벨 하나도 안 바뀌었다. 바뀌었다면 수집 대상이 바뀐 것이다.
 * ⚠️ 코드 추가·수정은 이제 «모듈 쪽» 에서 한다. 여기에 지역표를 되살리지 말 것 —
 *    같은 표가 네 곳에 갈려 있던 것이 옮긴 이유다. */
const LAWD_CODES = SIGUNGU_LAWD_CODES;

function parseXmlItems(xml: string): Record<string, any>[] {
  const items: Record<string, any>[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const b = m[1];
    const g = (tag: string) => { const r = b.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)); return r ? r[1].trim() : null; };
    items.push({
      apt_name: g('아파트') || g('aptNm') || '미상',
      dong: g('법정동') || g('umdNm') || null,
      exclusive_area: parseFloat(g('전용면적') || g('excluUseAr') || '0'),
      deal_amount: parseInt((g('거래금액') || g('dealAmount') || '0').replace(/,/g, '').trim()),
      deal_year: g('년') || g('dealYear'), deal_month: g('월') || g('dealMonth'), deal_day: g('일') || g('dealDay'),
      floor: parseInt(g('층') || g('floor') || '0'),
      built_year: parseInt(g('건축년도') || g('buildYear') || '0'),
    });
  }
  return items;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const apiKey = process.env.BUSAN_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'BUSAN_DATA_API_KEY not set' }, { status: 200 });

  const supabase = getSupabaseAdmin();

  const result = await withCronLogging('crawl-apt-trade', async () => {
    const now = new Date();

    /* ── D5-3 호출 예산 — 최근 3개월만 ────────────────────────────
     * 예전엔 「올해 1월 → 현재월」을 매일 전량 재수집했다. 8월이면 231 × 8 = 1,848 호출이다.
     *
     * 실측(2026-08-26 08:00 UTC): 일일 한도는 **1,355건** 이다.
     *   api_calls 1,848 = expected 1,848  → 루프는 «완주» 한다. 절단이 아니다.
     *   error_codes { "HTTP_429": 493 }   → 뒤쪽 493건이 거절당한다.
     *   실패가 흩어지지 않고 «연속 블록» 이다 — 전북(순번 152~165)까지 성공하고
     *   전남(166~) · 경북 · 경남 · 제주가 통째로 실패했다. 1,848 − 493 = 1,355 가 천장이다.
     *
     * ⚠️ **HTTP 429 다.** 봉투(`resultCode`)에는 안 나온다 — `res.ok` 검사가 없었으면
     *    이번에도 「success · failed 0」으로 기록됐을 것이다(D5-1 이 그걸 넣었다).
     *
     *   251코드 × 8월 = 2,008  → 149%  터진다
     *   251코드 × 5월 = 1,255  →  93%  월이 넘어가면 바로 터진다
     *   251코드 × 3월 =   753  →  56%  ← 여기로 간다
     *
     * ⚠️ **1개월로 줄이지 말 것.** 신고 지연 꼬리가 길다 — 누적 4일 58% · 7일 72% · 14일 86%.
     *    3개월이면 정정 신고까지 흡수한다.
     * ⚠️ 전량 재수집이 필요하면 «별도 수동 엔드포인트» 로 분리한다. 일일 크론에 두지 않는다. */
    const MONTH_WINDOW = 3;
    const months: string[] = [];
    for (let back = MONTH_WINDOW - 1; back >= 0; back--) {
      // ⚠️ 연말을 넘어갈 때 `getMonth()-back` 이 음수가 되면 안 된다 — Date 로 계산한다.
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
      months.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }

    /* 라벨 1개에 코드 여러 개다. 호출은 «코드» 단위로 편다 —
     * 라벨 단위로 세면 창원 5개 구가 1건으로 잡혀 예산이 틀린다. */
    const entries: Array<[string, string]> = Object.entries(LAWD_CODES)
      .flatMap(([label, codes]) => codes.map((code) => [label, code] as [string, string]));
    let totalInserted = 0;
    const failed: string[] = [];
    const BATCH = 15;

    /* ── D5-1 관측 카운터 ──────────────────────────────────────────
     * ⚠️ 전부 «세기만» 한다. 어떤 카운터도 흐름을 바꾸지 않는다.
     *    (실패했다고 건너뛰거나 재시도하지 않는다 — 그건 D5-3 이다.) */

    /** 실제 fetch 횟수. 기존 metadata 의 `entries.length * 2` 는 측정값이 아니라 하드코딩 공식이었다. */
    let apiCalls = 0;
    /** 코드별 실패 횟수. 여기에 `22`(한도) 가 쌓이는지 보는 게 D5-2 의 전부다. */
    const errorCodes: Record<string, number> = {};
    /** resultCode 는 정상인데 item 이 0개 — «거래 없는 달» 이다. 실패가 아니다. 그래도 센다. */
    let zeroItemOk = 0;
    /** 실패한 label (월별 중복 제거). failed 배열은 여기서 만든다. */
    const failedLabels = new Set<string>();

    /* 콘솔은 상한을 둔다. 1,848 호출이 전부 실패하면 로그가 잘려서 오히려 안 보인다.
     * 전체 그림은 metadata 의 집계로 보고, 콘솔은 «표본» 으로 쓴다. */
    const LOG_CAP = 20;
    let logged = 0;
    function note(line: string) {
      if (logged < LOG_CAP) { logged++; console.error(line); }
      else if (logged === LOG_CAP) { logged++; console.error('[crawl-apt-trade] (이하 생략 — metadata.error_codes 를 볼 것)'); }
    }

    async function fetchOne(label: string, lawdCd: string): Promise<number> {
      const [regionPart, sigunguPart] = label.split(' ');
      let count = 0;
      for (const ym of months) {
        const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${encodeURIComponent(apiKey!)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&pageNo=1&numOfRows=1000`;
        apiCalls++;
        const res = await fetch(url);
        const xml = await res.text();

        /* ── D5-1 — «거절» 과 «거래 없음» 을 여기서 가른다. 이 커밋의 전부다. ──
         * ⚠️ 판정만 하고 «흐름은 안 바꾼다». 실패해도 아래 파싱·insert 를 그대로 탄다
         *    (거절 응답이면 item 이 없어 어차피 0행이다). 건너뛰거나 재시도하면
         *    데이터가 바뀌어 「관측만」이 깨진다. */
        const env = res.ok ? readEnvelope(xml) : null;
        if (!res.ok) {
          const key = `HTTP_${res.status}`;
          errorCodes[key] = (errorCodes[key] ?? 0) + 1;
          failedLabels.add(label);
          note(`[crawl-apt-trade] HTTP ${res.status} ${label} ${ym}`);
        } else if (env && !env.ok) {
          errorCodes[env.code] = (errorCodes[env.code] ?? 0) + 1;
          failedLabels.add(label);
          note(`[crawl-apt-trade] API ${env.code} ${env.msg} ${label} ${ym}`);
        }

        const items = parseXmlItems(xml);
        /* 응답은 정상인데 item 0개 = 그 달에 거래가 없었다. **실패가 아니다.**
         * 이 둘을 못 가르는 것이 경남이 3개월간 조용히 죽어 있던 직접 원인이었다. */
        if (env?.ok && items.length === 0) zeroItemOk++;
        const rows = items.map(it => ({
          apt_name: it.apt_name, region_nm: regionPart, sigungu: sigunguPart, dong: it.dong,
          exclusive_area: it.exclusive_area, deal_amount: it.deal_amount,
          deal_date: it.deal_year && it.deal_month && it.deal_day
            ? `${it.deal_year}-${String(it.deal_month).padStart(2,'0')}-${String(it.deal_day).padStart(2,'0')}` : null,
          floor: it.floor, built_year: it.built_year || null, trade_type: '매매', source: 'molit_trade',
        })).filter(r => r.deal_amount > 0 && r.deal_date);
        if (rows.length > 0) {
          const { error } = await supabase.from('apt_transactions').insert(rows);
          if (error) console.error('[crawl-apt-trade] insert fail', error.message?.slice(0, 200));
          else count += rows.length;
        }
      }
      return count;
    }

    // 5 그룹 × 15개 병렬
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(([name, code]) => fetchOne(name, code)));
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') totalInserted += r.value;
        else failed.push(batch[j][0]);
      }
    }

    // 관심단지 알림 생성
    let notifCount = 0;
    try {
      const { data: watchItems } = await supabase.from('apt_watchlist').select('user_id, item_id').eq('item_type', 'transaction').eq('notify_enabled', true);
      if (watchItems?.length) {
        const aptNames = new Set(watchItems.map(w => w.item_id));
        const { data: newTrades } = await supabase.from('apt_transactions')
          .select('apt_name, deal_amount, deal_date')
          .in('apt_name', Array.from(aptNames))
          .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
          .limit(50);
        if (newTrades?.length) {
          const notifs = watchItems.filter(w => newTrades.some((t: Record<string, any>) => t.apt_name === w.item_id))
            .map(w => {
              const trade = newTrades.find((t: Record<string, any>) => t.apt_name === w.item_id);
              return { user_id: w.user_id, type: 'system', content: `관심단지 ${w.item_id}의 새 거래가 등록되었습니다. ${trade?.deal_date} ${trade?.deal_amount ? (trade.deal_amount / 10000).toFixed(1) + '억' : ''}` };
            });
          if (notifs.length > 0) {
            await supabase.from('notifications').insert(notifs);
            notifCount = notifs.length;
          }
        }
      }
    } catch {}

    /* reject 로 잡힌 것(failed)과 응답으로 거절당한 것(failedLabels)을 합친다.
     * 지금까지 failed 는 «영원히 비어 있었다» — 거절 경로가 reject 를 하지 않기 때문이다. */
    for (const l of failed) failedLabels.add(l);
    const failedList = [...failedLabels].sort();

    return {
      // 코드 단위로 편 뒤의 수다(라벨 230 · 코드 251).
      processed: entries.length,
      created: totalInserted,
      failed: failedList.length,
      metadata: {
        api_name: 'data_go_kr',
        // D5-1: 실제 호출 수. 정상이면 entries.length * months.length 와 «같아야» 한다.
        //   D5-3 이후 기대값 = 251코드 × 3월 = 753 (한도 1,355 의 56%).
        api_calls: apiCalls,
        api_calls_expected: entries.length * months.length,
        // D5-3: 라벨 수와 코드 수를 갈라 남긴다 — 창원 5개 구가 1건으로 잡히면 예산이 틀린다.
        lawd_labels: Object.keys(LAWD_CODES).length,
        month_window: months.length,
        months,
        notifications: notifCount,
        // D5-1 관측. error_codes 가 비어 있으면 API 거절은 원인이 아니다.
        error_codes: errorCodes,
        zero_item_ok: zeroItemOk,
        // ⚠️ created 는 «시도한» 행 수다. 트리거가 중복을 조용히 건너뛰므로 실제 적재량이 아니다.
        created_is_attempted: true,
        ...(failedList.length > 0 ? { failed: failedList.slice(0, 60), failed_total: failedList.length } : {}),
      },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result });
}
