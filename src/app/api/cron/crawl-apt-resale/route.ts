// [P5 후속] 완전 순차로 바꾸면서 120 → 300 으로 올렸다.
//   36지역 × 8개월 = 288회. 요청 간 250ms + 왕복 250ms 가정이면 약 144초라
//   120 에는 들어가지 않는다. 주간 1회(월 09:00)라 여러 회차로 나눌 수도 없다.
//   ⚠️ vercel.json 의 개별 오버라이드도 300 으로 함께 올렸다 — 캐치올이
//      라우트 export 를 덮으므로 한쪽만 고치면 효과가 없다(Rule #18).
export const maxDuration = 300;

/** 요청 간 최소 간격. data.go.kr 이 동시 호출에 429 로 답한다. */
const REQUEST_GAP_MS = 250;

/** 429 재시도 상한과 기준 대기(지수 백오프: 1s → 2s → 4s). */
const MAX_RETRY = 3;
const BACKOFF_BASE_MS = 1000;

/** maxDuration 300 에 여유를 남기고 끊는다. */
const PREEMPT_MS = 270_000;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * 429·5xx 를 지수 백오프로 재시도한다.
 * ⚠️ 4xx(429 제외)는 재시도하지 않는다 — 키·파라미터 문제라 기다려도 같다.
 */
async function fetchWithBackoff(url: string, label: string): Promise<Response> {
  let lastStatus = 0;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res;
    lastStatus = res.status;
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || attempt === MAX_RETRY) return res;
    const wait = BACKOFF_BASE_MS * Math.pow(2, attempt);
    console.warn(`[crawl-apt-resale] ${label} HTTP ${res.status} → ${wait}ms 후 재시도 (${attempt + 1}/${MAX_RETRY})`);
    await sleep(wait);
  }
  throw new Error(`unreachable (last ${lastStatus})`);
}
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';

const LAWD_CODES: Record<string, string> = {
  '서울 강남구':'11680','서울 서초구':'11650','서울 송파구':'11710','서울 강동구':'11740',
  '서울 마포구':'11440','서울 영등포구':'11560','서울 용산구':'11170',
  '서울 성동구':'11200','서울 광진구':'11215','서울 동작구':'11590',
  '경기 수원시':'41111','경기 성남시':'41131','경기 화성시':'41590','경기 평택시':'41220',
  '경기 용인시':'41461','경기 고양시':'41281','경기 김포시':'41570','경기 시흥시':'41390',
  '부산 해운대구':'26350','부산 부산진구':'26170','부산 수영구':'26410',
  '대구 수성구':'27260','대구 달서구':'27290',
  '인천 연수구':'28185','인천 서구':'28260','인천 남동구':'28200',
  '대전 유성구':'30200','대전 서구':'30170',
  '광주 광산구':'29200','광주 북구':'29170',
  '울산 남구':'31140',
  '충남 천안시':'44131','충남 아산시':'44200',
  '경남 창원시':'48121','경남 김해시':'48250',
  '세종시':'36110',
};

function parseXmlItems(xml: string): Record<string, any>[] {
  const items: Record<string, any>[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const b = m[1];
    const g = (tag: string) => { const r = b.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)); return r ? r[1].trim() : null; };
    items.push({
      apt_name: g('단지') || g('아파트') || '미상', dong: g('법정동') || null,
      exclusive_area: parseFloat(g('전용면적') || '0'),
      deal_amount: parseInt((g('거래금액') || '0').replace(/,/g, '').trim()),
      deal_year: g('년'), deal_month: g('월'), deal_day: g('일'),
      floor: parseInt(g('층') || '0'),
    });
  }
  return items;
}

/**
 * data.go.kr 은 HTTP 200 으로 에러를 돌려준다. 본문의 결과 코드를 봐야 실패를 안다.
 * 정상: <resultCode>00</resultCode> 또는 000. 그 외 값이면 실패로 본다.
 * 코드 태그가 아예 없는 응답은 판정하지 않는다(파서가 item 0건으로 흡수).
 */
function assertApiOk(xml: string, label: string, ym: string): void {
  const code = xml.match(/<(?:resultCode|returnReasonCode)>\s*([^<]*?)\s*<\//)?.[1];
  if (code == null) return;
  if (code === '00' || code === '000') return;
  const msg = xml.match(/<(?:resultMsg|returnAuthMsg|errMsg)>\s*([^<]*?)\s*<\//)?.[1] ?? '';
  throw new Error(`data.go.kr ${label} ${ym} resultCode=${code}${msg ? ` (${msg})` : ''}`);
}

export async function GET(req: NextRequest) {
  try {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const result = await withCronLogging('crawl-apt-resale', async () => {
    // 키 부재는 래퍼 안에서 throw 해야 cron_logs 에 failed 로 남는다.
    // 래퍼 밖 early-return 이던 시절엔 실행 흔적조차 남지 않았다.
    const apiKey = process.env.BUSAN_DATA_API_KEY;
    if (!apiKey) throw new Error('BUSAN_DATA_API_KEY not set');

    const now = new Date();
    const months: string[] = [];
    for (let m = 1; m <= now.getMonth() + 1; m++) {
      months.push(`${now.getFullYear()}${String(m).padStart(2, '0')}`);
    }

    const entries = Object.entries(LAWD_CODES);
    let totalInserted = 0;
    const startedAt = Date.now();

    async function fetchOne(label: string, lawdCd: string): Promise<number> {
      const [regionPart, sigunguPart] = label.split(' ');
      let count = 0;
      for (const [i, ym] of months.entries()) {
        // 첫 요청은 바로, 이후에는 간격을 둔다.
        if (i > 0 || count > 0 || results.length > 0) await sleep(REQUEST_GAP_MS);
        const url = `https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade?serviceKey=${encodeURIComponent(apiKey!)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&pageNo=1&numOfRows=1000`;
        const res = await fetchWithBackoff(url, `${label} ${ym}`);
        if (!res.ok) throw new Error(`data.go.kr ${label} ${ym} HTTP ${res.status}`);
        const xml = await res.text();
        assertApiOk(xml, label, ym);
        const items = parseXmlItems(xml);
        const rows = items.map(it => ({
          apt_name: it.apt_name, region_nm: regionPart, sigungu: sigunguPart, dong: it.dong,
          exclusive_area: it.exclusive_area, deal_amount: it.deal_amount,
          deal_date: it.deal_year && it.deal_month && it.deal_day
            ? `${it.deal_year}-${String(it.deal_month).padStart(2,'0')}-${String(it.deal_day).padStart(2,'0')}` : null,
          floor: it.floor, source: 'molit_resale',
        })).filter(r => r.deal_amount > 0 && r.deal_date);
        if (rows.length > 0) {
          // 같은 달을 다시 긁어도 중복이 쌓이지 않게 upsert (DB 유니크 인덱스 존재)
          const { error } = await supabase
            .from('apt_resale_rights')
            .upsert(rows, { onConflict: 'apt_name,deal_date,floor,exclusive_area' });
          // s9-3 의 런타임 로그 줄은 남기고, 여기서는 throw 까지 한다 —
          // 그래야 withCronLogging 이 status='failed' 로 기록한다 (R4 P2-1).
          if (error) {
            console.error('[crawl-apt-resale] upsert fail', error.message?.slice(0, 200));
            throw error;
          }
          count += rows.length;
        }
      }
      return count;
    }

    // ⚠️ Promise.allSettled 로 36지역을 «동시에» 때리던 것을 순차로 바꿨다.
    //    지역마다 월 루프가 도니 어느 순간에도 36개 요청이 떠 있었고,
    //    data.go.kr 이 429 로 답해 apt_resale_rights 가 0건이었다.
    //    Rule #49 는 동시 호출을 늘리지 말라는 것이고, 줄이는 방향은 그 취지에 맞는다.
    const results: PromiseSettledResult<number>[] = [];
    let preempted = false;
    for (const [name, code] of entries) {
      if (Date.now() - startedAt > PREEMPT_MS) { preempted = true; break; }
      try {
        results.push({ status: 'fulfilled', value: await fetchOne(name, code) });
      } catch (e) {
        results.push({ status: 'rejected', reason: e });
      }
    }
    let failed = 0;
    const errors: string[] = [];
    if (preempted) {
      errors.push(`시간 초과로 ${entries.length - results.length}개 지역을 건너뜀`);
    }
    for (const r of results) {
      if (r.status === 'fulfilled') {
        totalInserted += r.value;
      } else {
        failed += 1;
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        if (errors.length < 3) errors.push(msg);
        console.error('[cron/crawl-apt-resale] entry failed:', msg);
      }
    }

    // 전건 실패는 부분 실패가 아니라 크론 실패다. 무효 키를 success 로 덮지 않는다.
    if (failed === entries.length) {
      throw new Error(`all ${failed} entries failed — ${errors[0] ?? 'unknown'}`);
    }

    return {
      processed: entries.length,
      created: totalInserted,
      failed,
      metadata: {
        api_name: 'data_go_kr',
        api_calls: results.length * months.length,
        regions_done: results.length,
        regions_total: entries.length,
        preempted,
        elapsed_ms: Date.now() - startedAt,
        months,
        ...(errors.length ? { sample_errors: errors } : {}),
      },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result });
} catch (e: unknown) {
    console.error('[cron/crawl-apt-resale]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 200 });
  }
}
