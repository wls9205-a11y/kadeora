/**
 * AB-2 — 현장 FAQ «조립기» (K-1 ② · 2026-09-16).
 *
 * 원칙: **데이터가 문장을 결정할 수 있으면 생성하지 않고 조립한다.**
 * AB-1 `buildSiteOverview` 와 같은 계보다 — 이 파일도 AI 를 «부르지 않는다».
 * 그래서 환각이 구조적으로 불가능하고, 수치 게이트를 따로 걸 필요가 없다.
 *
 * 왜 조립기가 필요했나: 현장 FAQ 의 유일한 생산자 `apt-content-fill` 은
 * `content_score < 40` 에서만 돈다. 승부처 4현장은 60·75·100·100 이라 «구조적으로 영구 제외»
 * 였고, 그래서 3문항 템플릿에 머물러 있었다. 점수가 높을수록 FAQ 가 나빠지는 역전이었다.
 *
 * AB-2 규격 4조건을 «코드가» 강제한다:
 *   ① 정의형 첫 문장 — 첫 문항의 답이 「…은(는) …단지입니다」로 시작한다
 *   ② 기준일 괄호 병기 — 일정·가격 답에 (출처 · YYYY-MM-DD 기준)
 *   ③ 미공개면 «금액 문항 자체를 만들지 않는다» — 「미정입니다」라고 쓰지 않고 «뺀다»
 *   ④ 일반분양이면 「구역」을 쓰지 않는다 — 정비사업 어휘를 일반분양에 섞지 않는다
 *
 * ⛔ 값이 없으면 문항이 통째로 탈락한다. 자리표시("-", "미정", "확인 중")를 만들지 않는다.
 *    「없으면 없다고 쓴다」가 문항 단위까지 내려온 것이다.
 * ⚠️ 조사는 AB-1 과 같이 「은(는)」 병기 — 이름이 영문·숫자로 끝나는 현장이 많아
 *    자동 판정이 틀리는 자리를 만들지 않는다.
 */

export interface SiteFaqInput {
  name: string;
  slug: string;
  region?: string | null;
  sigungu?: string | null;
  dong?: string | null;
  builder?: string | null;
  siteType?: string | null;
  /** 한글 단계 라벨. */
  stageLabel?: string | null;
  /** 총 세대수(단지 전체). 그랑라크 규약의 complex 축. */
  totalUnits?: number | null;
  /** 일반분양 세대수. complex 와 다르면 둘 다 말한다. */
  generalUnits?: number | null;
  /** 합성가가 비워진 뒤의 표시 문자열. 없으면 금액 문항을 만들지 않는다(③). */
  priceText?: string | null;
  /** 일정 한 줄: 라벨·본문·출처·기준일. 없으면 일정 문항이 탈락한다. */
  schedule?: { label: string; text: string; source?: string | null; asof?: string | null } | null;
  /** 준공·기축이면 「위치한」, 아니면 「들어서는」. */
  built?: boolean;
}

export interface SiteFaq { q: string; a: string }

const clean = (v: string | null | undefined) => (v ?? '').trim();
const pos = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
const ko = (n: number) => n.toLocaleString('ko-KR');

const TYPE_LABEL: Record<string, string> = {
  subscription: '분양',
  redevelopment: '정비사업',
  unsold: '미분양',
  trade: '아파트',
  landmark: '아파트',
};

/**
 * 문두 변형 선택 — slug 로 «결정론적으로» 고른다.
 *
 * 왜 무작위가 아닌가: 같은 현장이 렌더마다 다른 문장을 내면 캐시·스냅샷·회귀 테스트가
 * 전부 흔들린다. 그러면서도 현장끼리는 갈려야 한다 — 전 현장 동일 문형은
 * 「동일 description 2.2천」과 같은 중복 신호를 다시 부른다(서치어드 진단 실측).
 * 그래서 「현장별로 고정, 현장끼리는 분산」이 답이다.
 */
function variantOf(slug: string, pool: number): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h % pool;
}

/** 출처·기준일 꼬리. AB-1 phaseOf 와 «같은 모양» 으로 맞춘다(②). */
function asofTail(source?: string | null, asof?: string | null): string {
  const tail = [clean(source), clean(asof) ? `${clean(asof)} 기준` : ''].filter(Boolean).join(' · ');
  return tail ? `(${tail})` : '';
}

export function buildSiteFaqs(i: SiteFaqInput): SiteFaq[] {
  const name = clean(i.name);
  if (!name) return [];

  const v = (pool: number) => variantOf(clean(i.slug) || name, pool);
  const loc = [clean(i.region), clean(i.sigungu), clean(i.dong)].filter(Boolean).join(' ');
  const builder = clean(i.builder).replace(/\s*\(주\)|주식회사\s*|㈜/g, '').trim();
  const siteType = clean(i.siteType);
  const typeLabel = TYPE_LABEL[siteType] ?? '아파트';
  const stage = clean(i.stageLabel);
  const total = pos(i.totalUnits);
  const general = pos(i.generalUnits);
  const price = clean(i.priceText);
  const sch = i.schedule && clean(i.schedule.text) ? i.schedule : null;

  // ④ 일반분양(정비사업이 아닌 현장)에는 「구역」 어휘를 쓰지 않는다.
  const isRedev = siteType === 'redevelopment';
  const siteWord = isRedev ? '구역' : '단지';

  const faqs: SiteFaq[] = [];

  // ── ① 정의형 첫 문장. 이 문항은 이름만 있으면 반드시 선다.
  const verb = i.built ? '위치한' : '들어서는';
  const defSentence =
    `${name}은(는) ${loc ? `${loc}에 ${verb} ` : ''}${builder ? `${builder}의 ` : ''}${typeLabel} ${siteWord}입니다.`;
  const scaleBits = [
    total ? `총 ${ko(total)}세대` : null,
    general && general !== total ? `일반분양 ${ko(general)}세대` : null,
  ].filter(Boolean).join(' · ');
  const defTail = [scaleBits ? `${scaleBits} 규모입니다.` : '', stage ? `현재 ${stage} 단계입니다.` : '']
    .filter(Boolean).join(' ');
  faqs.push({
    q: [`${name}은(는) 어떤 ${siteWord}인가요?`,
        `${name}, 어떤 곳인가요?`,
        `${name} 기본 정보가 궁금합니다.`][v(3)],
    a: defTail ? `${defSentence} ${defTail}` : defSentence,
  });

  // ── 위치
  if (loc) {
    faqs.push({
      q: [`${name} 위치는 어디인가요?`,
          `${name}은(는) 어디에 있나요?`][v(2)],
      a: `${loc}에 ${i.built ? '위치합니다' : '들어섭니다'}.`,
    });
  }

  // ── 규모. 그랑라크 규약: 총과 일반분양이 다르면 «둘 다» 말한다.
  if (total || general) {
    const body = total && general && general !== total
      ? `총 ${ko(total)}세대이며, 이 가운데 일반분양은 ${ko(general)}세대입니다.`
      : total
        ? `총 ${ko(total)}세대입니다.`
        : `일반분양 ${ko(general!)}세대입니다.`;
    faqs.push({
      q: [`${name} 세대수는 몇 세대인가요?`,
          `${name}은(는) 몇 세대 규모인가요?`][v(2)],
      a: body,
    });
  }

  // ── 시공사
  if (builder) {
    faqs.push({
      q: [`${name} 시공사는 어디인가요?`,
          `${name}은(는) 누가 시공하나요?`][v(2)],
      a: `${builder}가 시공합니다.`,
    });
  }

  // ── ③ 금액. priceText 가 없으면 «문항을 만들지 않는다». 「미정」이라 쓰지 않는다.
  if (price) {
    faqs.push({
      q: [`${name} 분양가는 얼마인가요?`,
          `${name} 분양가 범위가 궁금합니다.`][v(2)],
      a: `${price}입니다. 실제 금액은 모집공고를 확인해야 합니다.`,
    });
  }

  // ── ② 일정. 출처·기준일을 괄호로 병기한다.
  if (sch) {
    const tail = asofTail(sch.source, sch.asof);
    faqs.push({
      q: [`${name} ${clean(sch.label)}은(는) 언제인가요?`,
          `${name} 일정이 어떻게 되나요?`][v(2)],
      a: `${clean(sch.label)}은(는) ${clean(sch.text)}입니다${tail ? ` ${tail}` : ''}.`,
    });
  }

  // ── 진행 단계 (일정 문항이 없을 때만 — 둘 다 넣으면 같은 말을 두 번 한다)
  if (stage && !sch) {
    faqs.push({
      q: [`${name}은(는) 현재 어느 단계인가요?`,
          `${name} 진행 상황이 궁금합니다.`][v(2)],
      a: `현재 ${stage} 단계입니다.`,
    });
  }

  return faqs;
}
