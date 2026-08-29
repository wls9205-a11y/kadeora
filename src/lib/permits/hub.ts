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
}

export const PERMIT_TRACKS: Record<PermitTrack, TrackSpec> = {
  house: {
    source: 'hub:house',
    service: 'HsPmsHubService',
    operation: 'getHpBasisOulnInfo',
    permitKind: '사업계획승인',
    label: '주택인허가(대단지)',
  },
  arch: {
    source: 'hub:arch',
    service: 'ArchPmsHubService',
    operation: 'getApBasisOulnInfo',
    permitKind: '건축허가',
    label: '건축인허가(소형)',
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

/** 'YYYYMMDD' → 'YYYY-MM-DD'. 형식이 아니면 null — 지어내지 않는다. */
export function toIsoDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!/^\d{8}$/.test(s)) return null;
  const y = s.slice(0, 4), mo = s.slice(4, 6), d = s.slice(6, 8);
  if (mo < '01' || mo > '12' || d < '01' || d > '31') return null;
  return `${y}-${mo}-${d}`;
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
  const iso = toIsoDate(stcnsSchedDay);
  return iso ? iso.slice(0, 7) : null;
}

/**
 * 스테이징 대상인가.
 *   ① 세대수 30 이상 — 그 아래는 「분양 현장」이 아니다(빌라·근생).
 *   ② 사용검사 «전» — 이미 준공된 건물은 분양예정이 아니다.
 * ⚠️ 세대수를 «모르면 버리지 않는다». 모르는 것과 작은 것은 다르다 —
 *    버리면 그 현장이 API 커버에 있었는지조차 알 수 없게 된다.
 */
export function isPermitCandidate(item: Record<string, string>): boolean {
  const units = toInt(item.totHhldCnt);
  if (units !== null && units < 30) return false;
  if (item.useInsptDay) return false;
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
  const pk = item.mgmHsrgstPk || item.mgmBldrgstPk;
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
    total_units: toInt(item.totHhldCnt),
    building_count: toInt(item.mainBldCnt),
    main_purpose: item.mainPurpsCdNm || null,
    permit_kind: spec.permitKind,
    permit_date: toIsoDate(item.apprvDay ?? item.pmsDay),
    construct_start_expected: toIsoDate(item.stcnsSchedDay),
    use_approval_expected: toIsoDate(item.useInsptSchedDay),
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
