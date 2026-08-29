/**
 * 건축HUB 인허가 API — 엔드포인트·파싱·정규화 (PV-2).
 *
 * ── 두 트랙 ────────────────────────────────────────────────────────────────
 *   house  주택인허가 HsPmsHubService/getHpBasisOulnInfo   사업계획승인 = 대단지
 *   arch   건축인허가 ArchPmsHubService/getApBasisOulnInfo 건축허가     = 소형
 * 둘은 «서로 다른 모집단» 이다. 대단지가 건축허가로도 잡히는 일이 있으므로
 * 중복은 매칭 단계(PV-3)에서 거르고, 수집 단계에서는 «양쪽 다» 받는다 —
 * 수집기가 판단을 시작하면 무엇이 원문이었는지 사라진다.
 *
 * ⚠️ 오퍼레이션명은 «무키 실측» 으로 확정했다(2026-08-29).
 *    returnReasonCode 20(SERVICE_KEY_IS_NULL)=오퍼레이션 실재 / 12=서비스 없음.
 *    주택 쪽 접두는 `getHs` 가 아니라 «`getHp`» 다 — getHs* 13종은 전부 12였다.
 *
 * ⚠️ serviceKey 는 이 파일에서 «다시 인코딩하지 않는다». normalizeServiceKey 가
 *    이미 URL 에 실을 형태로 만들어 준다(data-go-kr-key.ts).
 */
import { buildDataGoKrUrl } from '@/lib/cron/data-go-kr-key';
import { readEnvelope } from '@/lib/cron/data-go-kr-envelope';
import { labelOfLawdCode, parseRegionSigungu } from '@/lib/region/lawd';
import type { AptPermitInsert } from '@/types/apt-permits';

export type PermitTrack = 'house' | 'arch';

export interface TrackSpec {
  /** apt_permits.source 에 그대로 들어간다. */
  source: string;
  service: string;
  operation: string;
  /** apt_permits.permit_kind 기본값. 응답에 더 정확한 값이 있으면 그쪽이 이긴다. */
  permitKind: string;
  label: string;
  /**
   * ⚠️ 두 트랙은 «필드 이름이 다르다». 실응답으로 확인했다(2026-08-29):
   *     house  mgmHsrgstPk  totHhldCnt  apprvDay     useInsptSchedDay  purpsCdNm
   *     arch   mgmPmsrgstPk hhldCnt     archPmsDay   useAprDay         mainPurpsCdNm
   *   지시서의 매핑은 house 쪽만 맞았다. 한 벌로 뭉뚱그리면 arch 가 통째로
   *   「돌았는데 0건」이 된다 — 고유키가 없어 전부 버려지기 때문이다.
   */
  fields: {
    pk: string;
    units: string;
    permitDay: string;
    /** 사용검사·사용승인이 «이미 난» 날. 값이 있으면 분양예정이 아니다. */
    useApprovedDay: string;
    /** 사용검사 예정일. 있어도 아직 준공은 아니다. */
    useApprovalSchedDay?: string;
    purpose: string;
  };
}

export const PERMIT_TRACKS: Record<PermitTrack, TrackSpec> = {
  house: {
    source: 'hub:house',
    service: 'HsPmsHubService',
    operation: 'getHpBasisOulnInfo',
    permitKind: '사업계획승인',
    label: '주택인허가(대단지)',
    fields: {
      pk: 'mgmHsrgstPk',
      units: 'totHhldCnt',
      permitDay: 'apprvDay',
      useApprovedDay: 'useInsptDay',
      useApprovalSchedDay: 'useInsptSchedDay',
      purpose: 'purpsCdNm',
    },
  },
  arch: {
    source: 'hub:arch',
    service: 'ArchPmsHubService',
    operation: 'getApBasisOulnInfo',
    permitKind: '건축허가',
    label: '건축인허가(소형)',
    fields: {
      pk: 'mgmPmsrgstPk',
      units: 'hhldCnt',
      permitDay: 'archPmsDay',
      useApprovedDay: 'useAprDay',
      purpose: 'mainPurpsCdNm',
    },
  },
};

const BASE = 'https://apis.data.go.kr/1613000';

export interface PermitQuery {
  sigunguCd: string;
  /**
   * 법정동 5자리.
   * ⚠️ «필수인지 아직 모른다». 첫 실호출에서 갈린다 — 생략해도 시군구 전량이 오면
   *    법정동 매핑을 만들 필요가 없고, 필수면 그때 lawd 모듈을 확장한다.
   *    그래서 optional 로 두고, 넣지 않으면 파라미터 자체를 «붙이지 않는다».
   */
  bjdongCd?: string;
  pageNo?: number;
  numOfRows?: number;
}

export function buildPermitUrl(track: PermitTrack, key: string, q: PermitQuery): string {
  const spec = PERMIT_TRACKS[track];
  return buildDataGoKrUrl(`${BASE}/${spec.service}/${spec.operation}`, key, {
    sigunguCd: q.sigunguCd,
    bjdongCd: q.bjdongCd,
    pageNo: q.pageNo ?? 1,
    numOfRows: q.numOfRows ?? 100,
  });
}

/**
 * `<item>` 을 «태그 이름 그대로» 뽑는다. 필드를 골라 담지 않는 것이 핵심이다 —
 * 원문을 그대로 raw 에 넣어야 정규화가 틀렸을 때 되돌릴 수 있다(D1).
 *
 * ⚠️ 정규식을 `new RegExp(...)` 로 만들지 않는다. 템플릿 문자열 안에서 백슬래시가
 *    한 겹 벗겨져 `[\s\S]` 가 `[sS]` 로 굳는 사고가 이 레포에서 실제로 났다.
 */
const RE_ITEM = /<item>([\s\S]*?)<\/item>/g;
const RE_FIELD = /<([A-Za-z][A-Za-z0-9_]*)>([\s\S]*?)<\/\1>/g;
const RE_TOTAL = /<totalCount>(\d+)<\/totalCount>/;

export function parsePermitItems(xml: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  RE_ITEM.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_ITEM.exec(xml)) !== null) {
    const row: Record<string, string> = {};
    RE_FIELD.lastIndex = 0;
    let f: RegExpExecArray | null;
    while ((f = RE_FIELD.exec(m[1])) !== null) {
      const v = f[2].trim();
      // ⚠️ 빈 문자열을 넣지 않는다. 「없음」과 「빈 값」을 섞으면 커버율이 거짓말이 된다.
      if (v !== '') row[f[1]] = v;
    }
    out.push(row);
  }
  return out;
}

export function parseTotalCount(xml: string): number | null {
  const m = xml.match(RE_TOTAL);
  return m ? Number(m[1]) : null;
}

/**
 * 'YYYYMMDD' → 'YYYY-MM-DD'. 형식이 아니면 null — 지어내지 않는다.
 * ⚠️ 6자리(YYYYMM)도 «실재한다» — arch 의 stcnsSchedDay 가 `199910` 로 온다.
 *    여기서 1일을 붙여 날짜인 척하지 «않는다». 월밖에 모르면 null 이고,
 *    월 정밀도가 필요한 곳은 toYearMonth 를 쓴다.
 */
export function toIsoDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!/^\d{8}$/.test(s)) return null;
  const y = s.slice(0, 4), mo = s.slice(4, 6), d = s.slice(6, 8);
  if (mo < '01' || mo > '12' || d < '01' || d > '31') return null;
  return `${y}-${mo}-${d}`;
}

/** 'YYYYMM' 또는 'YYYYMMDD' → 'YYYY-MM'. 그 외는 null. */
export function toYearMonth(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!/^\d{6}(\d{2})?$/.test(s)) return null;
  const mo = s.slice(4, 6);
  if (mo < '01' || mo > '12') return null;
  return `${s.slice(0, 4)}-${mo}`;
}

/** 숫자 필드. 콤마·공백을 걷어내고, 숫자가 아니면 null. */
export function toInt(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * 착공예정일 → expected_sale_period.
 * ⚠️ «월 절사» 다. 일까지 아는 것처럼 쓰지 않는다 — 착공예정은 그만큼 정확하지 않고,
 *    상향 추정은 §7-1 위반이다. 날짜가 없으면 null(미정)이다.
 */
export function permitToExpectedSalePeriod(stcnsSchedDay: string | undefined): string | null {
  return toYearMonth(stcnsSchedDay);
}

/**
 * 스테이징 대상인가.
 *   ① 세대수 30 이상 — 그 아래는 「분양 현장」이 아니다(빌라·근생).
 *   ② 사용검사 «전» — 이미 준공된 건물은 분양예정이 아니다.
 * ⚠️ 세대수를 «모르면 버리지 않는다». 모르는 것과 작은 것은 다르다 —
 *    버리면 그 현장이 API 커버에 있었는지조차 알 수 없게 된다.
 */
export function isPermitCandidate(track: PermitTrack, item: Record<string, string>): boolean {
  const f = PERMIT_TRACKS[track].fields;
  const units = toInt(item[f.units]);
  if (units !== null && units < 30) return false;
  if (item[f.useApprovedDay]) return false;
  return true;
}

/**
 * 응답 1행 → apt_permits 삽입 형태.
 *
 * ⚠️ `bldNm` 은 «건물명» 인데 실제로는 단지명이 온다. 그래도 project_name 에 넣는다 —
 *    브랜드 확정은 PV-3·후검증의 일이고, 수집기는 원문을 옮기기만 한다.
 * ⚠️ lawd_cd 는 «응답에 실린» sigunguCd 를 넣는다. 요청한 코드가 아니다.
 *    둘이 다르면 그건 매칭이 아니라 수집이 틀린 것이다(D5-4).
 */
export function toPermitInsert(
  track: PermitTrack,
  item: Record<string, string>,
  requested: PermitQuery,
): AptPermitInsert | null {
  const spec = PERMIT_TRACKS[track];
  const f = spec.fields;
  const pk = item[f.pk];
  // 고유키가 없으면 «넣지 않는다». 재수집이 중복을 만들 길을 열어 두지 않는다.
  if (!pk) return null;

  const sigunguCd = item.sigunguCd || requested.sigunguCd;
  const bjdongCd = item.bjdongCd || requested.bjdongCd;

  // 시도·시군구는 «코드에서» 유도한다. 응답의 주소 문자열을 파싱하지 않는다 —
  // 표기가 흔들리면 같은 구가 두 이름이 된다(PV-1 이 모은 그 표가 단일 원본이다).
  const label = sigunguCd ? labelOfLawdCode(sigunguCd) : null;
  const region = label ? parseRegionSigungu(label) : null;

  return {
    source: spec.source,
    source_key: pk,
    raw: item,
    sido: region?.region ?? null,
    sigungu: region?.sigungu ?? null,
    lawd_cd: sigunguCd || null,
    bjd_cd: sigunguCd && bjdongCd ? `${sigunguCd}${bjdongCd}` : null,
    address: item.platPlc || null,
    road_address: item.newPlatPlc || null,
    project_name: item.bldNm || null,
    total_units: toInt(item[f.units]),
    building_count: toInt(item.mainBldCnt),
    main_purpose: item[f.purpose] || null,
    permit_kind: spec.permitKind,
    permit_date: toIsoDate(item[f.permitDay]),
    // ⚠️ arch 는 «월까지만» 온다(199910). 날짜 컬럼이라 일이 없으면 넣을 수 없다 —
    //    없는 일을 1일로 지어내지 않는다. 월 정밀도는 expected_sale_period 가 담는다.
    construct_start_expected: toIsoDate(item.stcnsSchedDay),
    use_approval_expected: f.useApprovalSchedDay ? toIsoDate(item[f.useApprovalSchedDay]) : null,
    // ⛔ «예정» 과 «실제» 는 다른 사실이다. 2026-08-30 실측: 예정일이 지난 것 532건인데
    //    실제 사용승인은 0건이다. 예정을 실제로 읽으면 532개 현장이 잘못 기축으로 넘어간다.
    //    useApprovedDay 는 필드 스펙에 «있었는데» 어느 컬럼에도 쓰이지 않고 있었다.
    use_approval_actual: f.useApprovedDay ? toIsoDate(item[f.useApprovedDay]) : null,
    // 수명 규칙의 기산점을 예정 대신 «실제 착공» 으로 쓸 수 있게 한다.
    construct_start_actual: toIsoDate(item.stcnsDay ?? item.realStcnsDay),
  };
}

/**
 * 표본 대조용 건초더미. 이름·지번·도로명을 한 문자열로 합친다.
 * ⚠️ 스크립트 안에 두지 «않는다». scripts/ 는 tsconfig 밖이라 tsc 가 검사하지 않는다 —
 *    실제로 이 파일을 고치다 스크립트의 문자열이 깨졌는데 tsc 가 통과했다.
 *    판정에 관여하는 것은 테스트가 있는 쪽에 둔다.
 */
export function permitHaystack(item: Record<string, string>): string {
  return [item.bldNm, item.platPlc, item.newPlatPlc].filter(Boolean).join(' ');
}

export type SampleVerdict = 'match' | 'both' | 'other';

/**
 * 이원 소스 가설(대단지=house · 소형=arch)의 판정.
 *   match  가설 트랙에서만 잡혔다
 *   both   «양쪽» 에서 잡혔다 — 중복 제거가 PV-3 의 일이 된다
 *   other  가설과 «다른» 트랙에서만 잡혔다 — 한 트랙만 도는 수집은 샌다
 * ⚠️ both·other 는 실패가 아니라 «발견» 이다. 가설을 필터로 쓰지 않았기에 볼 수 있다.
 */
export function sampleVerdict(expect: PermitTrack, tracks: readonly PermitTrack[]): SampleVerdict {
  const uniq = new Set(tracks);
  if (uniq.size > 1) return 'both';
  return uniq.has(expect) ? 'match' : 'other';
}

/**
 * 봉투 판독 — 이 API 는 «XML 과 JSON 을 섞어서» 준다 (실측 2026-08-29).
 *   데이터 있음 → XML  `<response><header><resultCode>00`
 *   데이터 없음 → JSON `{"body":{},"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE"}}`
 *   게이트웨이 오류 → XML `<OpenAPI_ServiceResponse><cmmMsgHeader>`
 *
 * ⚠️ XML 전용 readEnvelope 만 쓰면 «정상인 빈 응답» 이 NO_CODE(실패)로 집계된다.
 *    첫 게이트에서 42건이 그렇게 잡혔다 — 「키가 안 통한다」로 오독할 뻔했다.
 */
export function readPermitEnvelope(text: string): { ok: boolean; code: string; msg: string } {
  const t = text.trimStart();
  // ⚠️⚠️ HTTP 200 인데 «본문이 비어 있는» 응답이 실재한다(표본 패스 112건 중 9건).
  //    이걸 「0건」으로 세면 그 법정동은 조용히 사라진다 — 우리가 계속 경계해 온 그 실패다.
  //    빈 본문은 «실패» 이고, 재시도 대상이다.
  if (t === '') return { ok: false, code: 'EMPTY_BODY', msg: '본문 없음(HTTP 200)' };
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t) as { header?: { resultCode?: string; resultMsg?: string } };
      const code = j.header?.resultCode?.trim() ?? '';
      if (code === '') return { ok: false, code: 'NO_CODE', msg: t.slice(0, 80) };
      return { ok: code === '00' || code === '000' || code === '0', code, msg: j.header?.resultMsg ?? '' };
    } catch {
      return { ok: false, code: 'BAD_JSON', msg: t.slice(0, 80) };
    }
  }
  return readEnvelope(text);
}

/**
 * 다시 걸어 볼 만한 실패인가.
 *   23 초당 요청제한 초과 · 05 서비스 연결실패 · EMPTY_BODY 빈 본문(HTTP 200)
 *   — 전부 «우리 잘못이 아니고 곧 풀린다».
 * ⛔ 30(키 미등록)·22(일 한도)는 재시도하지 않는다. 다시 걸어도 같은 답이고
 *    한도를 더 태울 뿐이다.
 */
const RETRYABLE = new Set(['23', '05', 'HTTP_429', 'HTTP_503', 'FETCH_FAIL', 'EMPTY_BODY']);
export function isRetryableEnvelope(code: string): boolean {
  return RETRYABLE.has(code);
}

/**
 * 호출 간격(ms). 초당 제한(코드 23)에 걸려 첫 게이트가 86발 중 42발을 거절당했다.
 * ⚠️ 「일 10,000」과 «초당 제한» 은 다른 한도다. 예산이 남아도 초당에서 막힌다.
 */
export const PERMIT_THROTTLE_MS = 350;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface PermitFetch {
  ok: boolean;
  /** 실패 사유 코드. 집계 키로 쓴다. */
  code: string;
  body: string;
  /** 실제 fetch 횟수(재시도 포함). 예산 집계용 — 「호출 수」는 시도 수다. */
  calls: number;
}

/**
 * 한 페이지를 가져온다. 간격·재시도를 «여기 한 곳에» 둔다 —
 * 게이트와 크론이 다른 규칙으로 부르면 게이트 결과가 크론을 대변하지 못한다.
 *
 * ⚠️ res.ok 를 봉투보다 «먼저» 본다. 429 는 봉투에 안 나온다(D5-1).
 * ⚠️ 재시도는 «되는 것만» 한다 — 30(키 미등록)·22(일 한도)는 다시 걸어도 같은 답이고
 *    한도만 더 탄다.
 */
export async function fetchPermitPage(
  url: string,
  opts: { retries?: number; throttleMs?: number; timeoutMs?: number } = {},
): Promise<PermitFetch> {
  const retries = opts.retries ?? 2;
  const throttle = opts.throttleMs ?? PERMIT_THROTTLE_MS;
  const timeout = opts.timeoutMs ?? 20000;
  let calls = 0;
  let last: { code: string; body: string } = { code: 'NEVER_RAN', body: '' };

  for (let attempt = 0; attempt <= retries; attempt++) {
    // 첫 호출에도 간격을 둔다 — 직전 호출과의 사이를 벌리는 것이 목적이다.
    await sleep(attempt === 0 ? throttle : throttle * (attempt + 2));
    calls++;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      if (!res.ok) {
        last = { code: `HTTP_${res.status}`, body: '' };
      } else {
        const body = await res.text();
        const env = readPermitEnvelope(body);
        if (env.ok) return { ok: true, code: env.code, body, calls };
        last = { code: env.code, body };
      }
    } catch {
      last = { code: 'FETCH_FAIL', body: '' };
    }
    if (!isRetryableEnvelope(last.code)) break;
  }
  return { ok: false, code: last.code, body: last.body, calls };
}
