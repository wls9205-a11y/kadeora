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

export const maxDuration = 300; // 5분 (전국 200개 시군구 × 올해 전체 월)

/**
 * LAWD 시군구 코드. **라벨 1개에 코드 «여러 개»** 다 (D5-3).
 *
 * ⚠️ 예전 자료구조는 `Record<string, string>` 이라 라벨 하나에 코드 하나였다.
 *    그게 «일반구를 가진 도시 11곳이 첫 구만 들어간» 구조적 원인이다 —
 *    창원은 5개 구인데 의창구 하나뿐이었고, 안산은 코드가 아예 없어 누적 0행이었다.
 *
 * ⚠️ 한 도시의 구를 «각각 다른 라벨» 로 넣지 말 것. `label.split(' ')` 이
 *    `region_nm`·`sigungu` 를 만들므로, 라벨이 갈리면 한 도시가 DB 에서 두 이름이 된다.
 *    실제로 갈려 있던 두 건을 여기서 흡수했다:
 *      '경기 수원영통'(41115) → '경기 수원시'   (41115 는 실제로 «팔달구» 다)
 *      '충북 청원구'(43112)  → '충북 청주시'   (43112 는 실제로 «서원구» 다)
 *    ⚠️ 기존 행의 `sigungu` 는 아직 옛 표기다(수원영통 3,454 · 청원구 3,906).
 *       라벨 수정과 백필은 «짝» 이라 별건으로 남아 있다(세종 표기 분열과 같은 커밋).
 *
 * ⚠️ 코드를 추가할 때 반드시 «실호출» 로 확인할 것 — `resultCode 000` + 응답의 `sggCd` 가
 *    넣으려는 코드와 일치 + 거래 실재. 모르는 코드를 넣은 것이 강원·전북을 3년간
 *    0건으로 만든 원인이다(D5-4). 이번 20개는 22/22 실호출 검증을 마쳤다.
 */
const LAWD_CODES: Record<string, string[]> = {
  '서울 종로구': ['11110'],
  '서울 중구': ['11140'],
  '서울 용산구': ['11170'],
  '서울 성동구': ['11200'],
  '서울 광진구': ['11215'],
  '서울 동대문구': ['11230'],
  '서울 중랑구': ['11260'],
  '서울 성북구': ['11290'],
  '서울 강북구': ['11305'],
  '서울 도봉구': ['11320'],
  '서울 노원구': ['11350'],
  '서울 은평구': ['11380'],
  '서울 서대문구': ['11410'],
  '서울 마포구': ['11440'],
  '서울 양천구': ['11470'],
  '서울 강서구': ['11500'],
  '서울 구로구': ['11530'],
  '서울 금천구': ['11545'],
  '서울 영등포구': ['11560'],
  '서울 동작구': ['11590'],
  '서울 관악구': ['11620'],
  '서울 서초구': ['11650'],
  '서울 강남구': ['11680'],
  '서울 송파구': ['11710'],
  '서울 강동구': ['11740'],
  '경기 수원시': ['41111', '41115', '41113', '41117'],
  '경기 성남시': ['41131', '41133', '41135'],
  '경기 고양시': ['41281', '41285', '41287'],
  '경기 용인시': ['41461', '41463', '41465'],
  '경기 부천시': ['41190'],
  '경기 안양시': ['41171', '41173'],
  '경기 안산시': ['41271', '41273'],
  '경기 화성시': ['41590'],
  '경기 평택시': ['41220'],
  '경기 시흥시': ['41390'],
  '경기 김포시': ['41570'],
  '경기 광명시': ['41210'],
  '경기 군포시': ['41410'],
  '경기 하남시': ['41450'],
  '경기 오산시': ['41370'],
  '경기 이천시': ['41500'],
  '경기 안성시': ['41550'],
  '경기 의왕시': ['41430'],
  '경기 양주시': ['41630'],
  '경기 여주시': ['41670'],
  '경기 구리시': ['41310'],
  '경기 남양주시': ['41360'],
  '경기 파주시': ['41480'],
  '경기 의정부시': ['41150'],
  '경기 동두천시': ['41250'],
  '경기 광주시': ['41610'],
  '경기 포천시': ['41650'],
  '경기 양평군': ['41830'],
  '경기 가평군': ['41820'],
  '경기 연천군': ['41800'],
  '경기 과천시': ['41290'],
  '부산 중구': ['26110'],
  '부산 서구': ['26140'],
  '부산 동구': ['26170'],
  '부산 영도구': ['26200'],
  '부산 부산진구': ['26230'],
  '부산 동래구': ['26260'],
  '부산 남구': ['26290'],
  '부산 북구': ['26320'],
  '부산 해운대구': ['26350'],
  '부산 사하구': ['26380'],
  '부산 금정구': ['26410'],
  '부산 강서구': ['26440'],
  '부산 연제구': ['26470'],
  '부산 수영구': ['26500'],
  '부산 사상구': ['26530'],
  '부산 기장군': ['26710'],
  '대구 중구': ['27110'],
  '대구 동구': ['27140'],
  '대구 서구': ['27170'],
  '대구 남구': ['27200'],
  '대구 북구': ['27230'],
  '대구 수성구': ['27260'],
  '대구 달서구': ['27290'],
  '대구 달성군': ['27710'],
  '인천 중구': ['28110'],
  '인천 동구': ['28140'],
  '인천 미추홀구': ['28177'],
  '인천 연수구': ['28185'],
  '인천 남동구': ['28200'],
  '인천 부평구': ['28237'],
  '인천 계양구': ['28245'],
  '인천 서구': ['28260'],
  '인천 강화군': ['28710'],
  '인천 옹진군': ['28720'],
  '광주 동구': ['29110'],
  '광주 서구': ['29140'],
  '광주 남구': ['29155'],
  '광주 북구': ['29170'],
  '광주 광산구': ['29200'],
  '대전 동구': ['30110'],
  '대전 중구': ['30140'],
  '대전 서구': ['30170'],
  '대전 유성구': ['30200'],
  '대전 대덕구': ['30230'],
  '울산 중구': ['31110'],
  '울산 남구': ['31140'],
  '울산 동구': ['31170'],
  '울산 북구': ['31200'],
  '울산 울주군': ['31710'],
  '세종시': ['36110'],
  '강원 춘천시': ['51110'],
  '강원 원주시': ['51130'],
  '강원 강릉시': ['51150'],
  '강원 동해시': ['51170'],
  '강원 태백시': ['51190'],
  '강원 속초시': ['51210'],
  '강원 삼척시': ['51230'],
  '강원 홍천군': ['51720'],
  '강원 횡성군': ['51730'],
  '강원 영월군': ['51750'],
  '강원 평창군': ['51760'],
  '강원 정선군': ['51770'],
  '강원 철원군': ['51780'],
  '강원 화천군': ['51790'],
  '강원 양구군': ['51800'],
  '강원 인제군': ['51810'],
  '강원 고성군': ['51820'],
  '강원 양양군': ['51830'],
  '충북 청주시': ['43111', '43112', '43113', '43114'],
  '충북 충주시': ['43130'],
  '충북 제천시': ['43150'],
  '충북 보은군': ['43720'],
  '충북 옥천군': ['43730'],
  '충북 영동군': ['43740'],
  '충북 증평군': ['43745'],
  '충북 진천군': ['43750'],
  '충북 괴산군': ['43760'],
  '충북 음성군': ['43770'],
  '충북 단양군': ['43800'],
  '충남 천안시': ['44131', '44133'],
  '충남 공주시': ['44150'],
  '충남 보령시': ['44180'],
  '충남 아산시': ['44200'],
  '충남 서산시': ['44210'],
  '충남 논산시': ['44230'],
  '충남 계룡시': ['44250'],
  '충남 당진시': ['44270'],
  '충남 금산군': ['44710'],
  '충남 부여군': ['44760'],
  '충남 서천군': ['44770'],
  '충남 청양군': ['44790'],
  '충남 홍성군': ['44800'],
  '충남 예산군': ['44810'],
  '충남 태안군': ['44825'],
  '충남 연기군': ['44830'],
  '전북 전주시': ['52111', '52113'],
  '전북 군산시': ['52130'],
  '전북 익산시': ['52140'],
  '전북 정읍시': ['52180'],
  '전북 남원시': ['52190'],
  '전북 김제시': ['52210'],
  '전북 완주군': ['52710'],
  '전북 진안군': ['52720'],
  '전북 무주군': ['52730'],
  '전북 장수군': ['52740'],
  '전북 임실군': ['52750'],
  '전북 순창군': ['52770'],
  '전북 고창군': ['52790'],
  '전북 부안군': ['52800'],
  '전남 목포시': ['46110'],
  '전남 여수시': ['46130'],
  '전남 순천시': ['46150'],
  '전남 나주시': ['46170'],
  '전남 광양시': ['46230'],
  '전남 담양군': ['46710'],
  '전남 곡성군': ['46720'],
  '전남 구례군': ['46730'],
  '전남 고흥군': ['46770'],
  '전남 보성군': ['46780'],
  '전남 화순군': ['46790'],
  '전남 장흥군': ['46800'],
  '전남 강진군': ['46810'],
  '전남 해남군': ['46820'],
  '전남 영암군': ['46830'],
  '전남 무안군': ['46840'],
  '전남 함평군': ['46860'],
  '전남 영광군': ['46870'],
  '전남 장성군': ['46880'],
  '전남 완도군': ['46890'],
  '전남 진도군': ['46900'],
  '전남 신안군': ['46910'],
  '경북 포항시': ['47111', '47113'],
  '경북 경주시': ['47130'],
  '경북 김천시': ['47150'],
  '경북 안동시': ['47170'],
  '경북 구미시': ['47190'],
  '경북 영주시': ['47210'],
  '경북 영천시': ['47230'],
  '경북 상주시': ['47250'],
  '경북 문경시': ['47280'],
  '경북 경산시': ['47290'],
  '경북 군위군': ['47720'],
  '경북 의성군': ['47730'],
  '경북 청송군': ['47750'],
  '경북 영양군': ['47760'],
  '경북 영덕군': ['47770'],
  '경북 청도군': ['47820'],
  '경북 고령군': ['47830'],
  '경북 성주군': ['47840'],
  '경북 칠곡군': ['47850'],
  '경북 예천군': ['47900'],
  '경북 봉화군': ['47920'],
  '경북 울진군': ['47930'],
  '경북 울릉군': ['47940'],
  '경남 창원시': ['48121', '48123', '48125', '48127', '48129'],
  '경남 진주시': ['48170'],
  '경남 통영시': ['48220'],
  '경남 사천시': ['48240'],
  '경남 김해시': ['48250'],
  '경남 밀양시': ['48270'],
  '경남 거제시': ['48310'],
  '경남 양산시': ['48330'],
  '경남 의령군': ['48720'],
  '경남 함안군': ['48730'],
  '경남 창녕군': ['48740'],
  '경남 고성군': ['48820'],
  '경남 남해군': ['48840'],
  '경남 하동군': ['48850'],
  '경남 산청군': ['48860'],
  '경남 함양군': ['48870'],
  '경남 거창군': ['48880'],
  '경남 합천군': ['48890'],
  '제주 제주시': ['50110'],
  '제주 서귀포시': ['50130'],
};

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
