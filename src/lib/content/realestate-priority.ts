/**
 * LB-4 — 부동산 «미래지향» 글감 우선순위 (2026-09-08).
 *
 * 카더라의 상품은 모집공고 «전» 단계 정보다. 그래서 생성 순서도 그 축을 따른다 —
 * 이름이 태어나는 순간(P1)이 가장 앞이고, 이미 다 알려진 기축 시세(P5)가 가장 뒤다.
 *
 * ⚠️ `final_score` 를 «버리지 않는다». 지시서의 정렬 키는 (P순위, 부울경, 신선도) 였지만
 *    점수를 빼면 같은 P 안에서 저품질 글감이 앞으로 온다. 점수를 신선도 «앞» 에 둔다 —
 *    P순위와 지역 가중이라는 지시의 뼈대는 그대로다.
 * ⚠️ 지역 가중은 «하드 쿼터가 아니라 정렬» 이다. 부울경 글감이 마르면 전국 대어로
 *    자연히 흘러넘친다.
 * ⛔ H5 카피 규칙: 화면·본문 문면에 「부울경」이라는 단어를 쓰지 않는다. 그건 내부 용어이고
 *    사람이 검색하는 말이 아니다 — 문면에는 부산·해운대구 같은 구체 지명만 나간다.
 *    이 파일은 «선정» 층이라 그 단어가 있어도 화면에 닿지 않는다.
 */

/** 낮을수록 먼저 만든다. 9 는 부동산이 아닌 글감(기존 순서 유지). */
export type ContentPriority = 1 | 2 | 3 | 4 | 5 | 9;

export interface TopicRow {
  category?: string | null;
  sub_category?: string | null;
  issue_type?: string | null;
  source_type?: string | null;
  region_sigungu?: string | null;
  region_sido?: string | null;
  final_score?: number | null;
  detected_at?: string | null;
  title?: string | null;
  apt_site_id?: string | null;
}

/** 시·도 축. ⚠️ 시군구 표는 DB 의 것이고 여기 다시 적지 않는다 — 광역 판정만 한다. */
const PRIORITY_SIDO = /(부산|울산|경남|경상남도)/;
const PRIORITY_SIGUNGU =
  /(부산진|해운대|수영|금정|영도|동래|사하|사상|연제|기장|남구|북구|중구|서구|동구|강서|울주|창원|김해|양산|거제|진주|통영|사천|밀양|함안|거창|합천|남해|하동|산청|의령|창녕|고성|함양)/;

/**
 * 부산·울산·경남 권역인가. 정렬 가중에만 쓴다.
 * ⚠️ 「남구」·「북구」 같은 이름은 다른 시·도에도 있다. 그래서 시·도가 있으면 그것을 «먼저» 본다.
 */
export function isPriorityRegion(row: TopicRow): boolean {
  const sido = (row.region_sido ?? '').trim();
  if (sido) return PRIORITY_SIDO.test(sido);
  const gu = (row.region_sigungu ?? '').trim();
  if (!gu) return false;
  return PRIORITY_SIGUNGU.test(gu);
}

const REALESTATE_CATS = new Set(['apt', 'realestate', 'unsold']);

/** 「분양 전」 신호 — 모집공고 이전 단계를 가리키는 말들. */
const PRESALE_HINT = /(분양\s?예정|사전\s?홍보|모집공고|입주자\s?모집|분양가|견본주택|모델하우스)/;
/** 정비사업 «단계» 신호. */
const REDEV_STAGE_HINT =
  /(사업시행인가|관리처분|이주|철거|착공|조합\s?설립|정비구역|재개발|재건축|시공사)/;
/** 청약 «임박» 신호. */
const SUBSCRIPTION_HINT = /(청약|접수|당첨|발표|계약)/;

/**
 * 글감 하나의 우선순위.
 *
 * P1 — CV-N 이벤트(win·name_confirm). 공식 기록 전의 이름을 «가장 먼저» 글로 세운다.
 *      카더라 네이밍의 심장이고, 오가닉이 파워링크와 같은 검색어에 서는 자리다.
 * P2 — 분양예정·모집공고 전
 * P3 — 정비사업 현황·단계 변화 (rename·cancel 도 여기, 단 확정 사실만)
 * P4 — 청약 임박
 * P5 — 기축 시세·실거래
 */
export function priorityOf(row: TopicRow): ContentPriority {
  const src = (row.source_type ?? '').trim();
  const sub = (row.sub_category ?? '').trim();

  // P1 — CV-N 이 감지한 «이름 사건». 제안(bid)은 여기 오지 않는다 — T-C 가 막는다.
  if (src === 'cvn_name_event') {
    if (sub === 'win' || sub === 'name_confirm') return 1;
    // rename·cancel 은 정정·현황 글감이다. 추측 서사 없이 확정 사실만 쓴다.
    if (sub === 'rename' || sub === 'cancel') return 3;
    return 3;
  }

  const cat = (row.category ?? '').trim();
  if (!REALESTATE_CATS.has(cat)) return 9;

  const hay = `${row.title ?? ''} ${sub} ${row.issue_type ?? ''}`;

  if (src === 'apt_subscription' || SUBSCRIPTION_HINT.test(hay)) {
    // ⚠️ 「분양예정」과 「청약 임박」이 한 문장에 같이 있으면 «앞선 단계» 로 본다 —
    //    카더라가 파는 것은 공고 전 정보이고, 공고가 난 뒤는 어디서나 볼 수 있다.
    if (PRESALE_HINT.test(hay)) return 2;
    return 4;
  }
  if (PRESALE_HINT.test(hay)) return 2;
  if (REDEV_STAGE_HINT.test(hay)) return 3;
  return 5;
}

export interface SortedTopic<T> {
  row: T;
  priority: ContentPriority;
  priorityRegion: boolean;
}

/**
 * 생성 순서로 정렬한다 — (P순위 ASC, 지역 가중 DESC, 점수 DESC, 신선도 DESC).
 *
 * ⛔ 안정 정렬이어야 한다. 같은 키에서 순서가 흔들리면 「어제와 다른 이유」를 설명할 수 없다.
 */
export function sortForGeneration<T extends TopicRow>(rows: T[]): SortedTopic<T>[] {
  return rows
    .map((row, i) => ({ row, priority: priorityOf(row), priorityRegion: isPriorityRegion(row), i }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.priorityRegion !== b.priorityRegion) return a.priorityRegion ? -1 : 1;
      const sa = a.row.final_score ?? 0;
      const sb = b.row.final_score ?? 0;
      if (sa !== sb) return sb - sa;
      const da = Date.parse(a.row.detected_at ?? '') || 0;
      const db = Date.parse(b.row.detected_at ?? '') || 0;
      if (da !== db) return db - da;
      return a.i - b.i;
    })
    .map(({ row, priority, priorityRegion }) => ({ row, priority, priorityRegion }));
}
