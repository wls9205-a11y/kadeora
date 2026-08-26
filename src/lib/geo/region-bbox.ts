// T1-1 — 시도별 위경도 박스와 좌표 가드.
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────────
// 부산 현장 75건이 대전·경북·충남에 찍혀 있었다. 원인은 «동명 시군구 혼동» 이다 —
// 부산 서구가 대전 서구(36.31, 127.19)로, 부산 중구가 경북권으로, 강서구 일대가
// 충남권 한 점(36.75, 127.53)으로 갔다.
// 전국에 중구 4+ · 서구 5+ · 동구 5+ 가 있다. 지오코딩 질의에 시도가 빠지면
// 어느 지역 API 든 «가장 그럴듯한 다른 도(道)» 를 돌려준다.
//
// ── ⚠️ 이건 «경계 판정» 이 아니라 «다른 도에 찍혔나» 판정이다 ─────────────
// 행정경계 폴리곤을 쓰지 않는다. 과설계다. 목적은 대전에 찍힌 부산 현장을 잡는 것이지
// 시 경계 100m 를 가리는 것이 아니다.
//
// 그래서 박스에 «여유폭» 을 둔다. 오폭(정상 좌표를 무는 것)이 미검출보다 나쁘다 —
// null 로 만들면 지도에서 사라지고, 사람이 그걸 데이터 없음으로 오해한다.
//   · 인천  백령도(37.96N/124.61E) · 연평도
//   · 전남  가거도(34.07N/125.11E) · 홍도
//   · 경북  울릉도(130.90E) · 독도(131.87E)
//   · 제주  마라도(33.06N) · 추자도(33.94N — 행정구역은 «제주시» 다)
//   · 충남  격렬비열도(125.58E)
//   · 경남  거제 남단(34.68N) · 남해 도서
//
// ⚠️ 값을 «좁히지» 말 것. 좁히면 도서·신도시가 오폭된다. 넓혀서 다른 도만 잡는다.

export interface Bbox {
  /** 남쪽 한계 */ lat0: number;
  /** 북쪽 한계 */ lat1: number;
  /** 서쪽 한계 */ lng0: number;
  /** 동쪽 한계 */ lng1: number;
}

export const REGION_BBOX: Record<string, Bbox> = {
  서울: { lat0: 37.41, lat1: 37.72, lng0: 126.73, lng1: 127.27 },
  부산: { lat0: 34.85, lat1: 35.42, lng0: 128.72, lng1: 129.32 },
  대구: { lat0: 35.60, lat1: 36.02, lng0: 128.35, lng1: 128.78 },
  인천: { lat0: 36.95, lat1: 38.00, lng0: 124.50, lng1: 126.85 },
  광주: { lat0: 35.03, lat1: 35.26, lng0: 126.64, lng1: 127.03 },
  대전: { lat0: 36.18, lat1: 36.50, lng0: 127.25, lng1: 127.56 },
  울산: { lat0: 35.44, lat1: 35.83, lng0: 128.95, lng1: 129.47 },
  세종: { lat0: 36.42, lat1: 36.72, lng0: 127.12, lng1: 127.40 },
  경기: { lat0: 36.85, lat1: 38.30, lng0: 126.34, lng1: 127.87 },
  강원: { lat0: 37.02, lat1: 38.62, lng0: 127.05, lng1: 129.38 },
  충북: { lat0: 36.00, lat1: 37.26, lng0: 127.25, lng1: 128.65 },
  충남: { lat0: 35.98, lat1: 37.10, lng0: 125.50, lng1: 127.60 },
  전북: { lat0: 35.28, lat1: 36.30, lng0: 125.90, lng1: 127.92 },
  전남: { lat0: 33.90, lat1: 35.50, lng0: 125.00, lng1: 127.90 },
  경북: { lat0: 35.55, lat1: 37.55, lng0: 127.80, lng1: 131.95 },
  경남: { lat0: 34.50, lat1: 35.92, lng0: 127.50, lng1: 129.30 },
  제주: { lat0: 32.90, lat1: 34.05, lng0: 125.90, lng1: 127.05 },
};

/** DB 의 region 표기 흔들림을 흡수한다 (`부산광역시` · `경상남도` 등). */
export function normalizeRegion(region: string | null | undefined): string | null {
  const r = (region || '').trim();
  if (!r) return null;
  if (REGION_BBOX[r]) return r;
  const map: Record<string, string> = {
    서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천',
    광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산',
    세종특별자치시: '세종', 세종시: '세종',
    경기도: '경기', 강원도: '강원', 강원특별자치도: '강원',
    충청북도: '충북', 충청남도: '충남', 전라북도: '전북', 전북특별자치도: '전북',
    전라남도: '전남', 경상북도: '경북', 경상남도: '경남',
    제주도: '제주', 제주특별자치도: '제주',
  };
  if (map[r]) return map[r];
  // `부산 해운대구` 처럼 앞에 시도가 붙은 경우
  for (const key of Object.keys(REGION_BBOX)) if (r.startsWith(key)) return key;
  return null;
}

/**
 * 좌표가 그 시도 안에 있는가.
 *
 * ⚠️ 모르는 region 은 `true` 를 돌려준다. 판정할 수 없는 것을 «거부» 하면
 *    표기가 조금 다른 지역의 정상 좌표가 통째로 막힌다. 모르면 통과시키고,
 *    아는 것만 막는다.
 */
export function isCoordInRegion(
  region: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  if (lat == null || lng == null) return true;      // 좌표 없음은 이 함수의 관심사가 아니다
  const key = normalizeRegion(region);
  if (!key) return true;                            // 모르는 지역 — 판정하지 않는다
  const b = REGION_BBOX[key];
  return lat >= b.lat0 && lat <= b.lat1 && lng >= b.lng0 && lng <= b.lng1;
}

/**
 * 쓰기 직전 가드. 통과하면 좌표를, 아니면 null 쌍을 돌려준다.
 *
 * ⚠️ **조용히 넘기지 않는다.** 거부는 반드시 console.error 로 남긴다 —
 *    이 저장소가 `if (!error)` 46곳으로 넉 달을 잃은 것이 그 침묵 때문이다.
 *    「거부됐다」와 「대상이 없었다」가 로그에서 구분돼야 한다.
 *
 * @returns 저장해도 되는 좌표. 거부면 { lat: null, lng: null }
 */
export function assertCoordInRegion(
  region: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined,
  ctx: string,
): { lat: number | null; lng: number | null; ok: boolean } {
  if (lat == null || lng == null) return { lat: null, lng: null, ok: true };
  if (isCoordInRegion(region, lat, lng)) return { lat, lng, ok: true };
  console.error(
    `[coord-guard] 거부 ${ctx} region=${region} lat=${lat} lng=${lng} — ` +
    `${normalizeRegion(region)} bbox 밖이다. 동명 시군구 혼동일 가능성이 높다(중구·서구·동구).`,
  );
  return { lat: null, lng: null, ok: false };
}
