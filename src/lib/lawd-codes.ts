/**
 * ⛔ 이 표는 «구본» 이다. 새 코드는 `@/lib/region/lawd` 를 쓴다 (PV-1).
 *
 * 두 표를 대조한 실측(2026-08-29):
 *   틀린 코드 32개 — 강원 18곳이 42xxx, 전북 14곳이 45xxx 다.
 *     정본은 51xxx·52xxx(강원·전북 특별자치도 신 코드)이고, 그쪽만 실호출 검증을 통과했다.
 *     ⚠️ 이 표를 쓰는 `crawl-apt-rent` 는 그래서 강원·전북이 «0행» 이다
 *        (전월세 2,339,291행 중 0 / 매매는 같은 지역 20,532행). 매매 쪽에서 D5-4 로
 *        고친 바로 그 결함이 전월세에는 그대로 남아 있다.
 *   빠진 라벨 1개 — 경기 안산시(전월세 0행).
 *   정본에 없는 라벨 2개 — '경기 수원영통'(41115=팔달구) · '충북 청원구'(43112=서원구).
 *     둘 다 «한 도시가 DB 에서 두 이름» 이 된 흔적이다.
 *
 * ⚠️ 값을 여기서 고치지 «않는다». 고치는 순간 수집 대상이 달라져 데이터가 바뀐다 —
 *    지역코드 정리와 데이터 변경은 별건이다. 정본으로 갈아타는 커밋에서 함께 한다.
 * ⚠️ 남은 사용처는 두 곳뿐이다: cron/crawl-apt-rent · admin/backfill-trades.
 */
/* ⛔ 2026-08-30 — 이 파일에 있던 `LAWD_CODES`(라벨→코드 «하나») 를 지웠다.
 *
 *   ⚠️ 그 표는 «두 가지로» 틀려 있었다:
 *     ① 라벨 1개에 코드 1개 — 창원 5개 구 중 의창구(48121)만 긁혔다.
 *     ② 폐지된 코드를 들고 있었다 — 42xxx(구 강원) 18 · 45xxx(구 전북) 14.
 *        「crawl-apt-rent 이 강원·전북 0행」의 원인이 이것이다. 없는 코드로 물어보고
 *        0을 받아 왔고, 그 0 은 「거래가 없다」와 구분되지 않았다.
 *
 *   단일 원본은 `src/lib/region/lawd.ts` 의 `SIGUNGU_LAWD_CODES`(라벨→코드 «배열») 다.
 *   ⛔ 여기에 지역표를 다시 만들지 말 것. 두 벌이 되는 순간 한쪽만 늙는다 —
 *      이 파일이 그 실례였다.
 *
 *   ⚠️ `crawl-apt-resale` 은 «또 다른» 자체 표를 들고 있다(세 번째 벌).
 *      세션 A 가 「부산진구·수영구를 다른 구 코드로 긁는다」고 적어 둔 항목이라
 *      여기서 건드리지 않았다 — HANDOFF 안건.
 */

export function parseXmlItems(xml: string): Record<string, string | null>[] {
  const items: Record<string, string | null>[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const b = m[1];
    const g = (tag: string) => { const r = b.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)); return r ? r[1].trim() : null; };
    items.push({
      apt_name: g('아파트') || g('aptNm') || '미상',
      dong: g('법정동') || g('umdNm') || null,
      exclusive_area: g('전용면적') || g('excluUseAr') || '0',
      deal_amount: (g('거래금액') || g('dealAmount') || '0').replace(/,/g, '').trim(),
      deposit: (g('보증금액') || g('deposit') || '0').replace(/,/g, '').trim(),
      monthly_rent: (g('월세금액') || g('monthlyRent') || '0').replace(/,/g, '').trim(),
      deal_year: g('년') || g('dealYear'),
      deal_month: g('월') || g('dealMonth'),
      deal_day: g('일') || g('dealDay'),
      floor: g('층') || g('floor') || '0',
      built_year: g('건축년도') || g('buildYear') || '0',
      contract_term: g('계약기간') || g('contractTerm') || null,
      renewal_right: g('갱신요구권사용') || g('renewalRight') || null,
    });
  }
  return items;
}

/** region_nm 추출 (LAWD_CODES 키에서) */
export function parseRegionSigungu(label: string): { region: string; sigungu: string } {
  const parts = label.split(' ');
  if (parts.length === 1) return { region: parts[0].replace('시', ''), sigungu: parts[0] };
  return { region: parts[0], sigungu: parts.slice(1).join(' ') };
}
