// BN-2 §4 — 판독 게이트 보강 5종(스캔2). 수치 출처 게이트(number-verify)가 못 잡은 결함형을 잡는다.
//
// 112514·112515(2026-09-18) 실측 결함형:
//   ① 기간 수식어 — 데이터 창은 6개월인데 「최근 5년간 중위 실거래가」
//   ② 블록 밖 금액 — 「관리비 평당 월 8,000~12,000원 대」(추정 표현 사전의 「~대」가 게이트를 통과시켰다)
//   ③ 괄호 귀속 창작 — 「최고가 15억 7,000만원(강남동 고급 단지)」 — 동래구에 강남동은 없다
//   ④ 지시문 누출 — 「본 기사는 분양가를 추정하거나 임의로 계산하지 않습니다」
//   ⑤ 제목 규격 불일치 — title_spec 을 따르지 않은 제목
// 모두 순수 함수다. 판정·기록은 호출부(issue-draft)가 한다.

import { APT_NON_SITE_SEGMENTS } from '@/lib/blog-safe-insert';

/** 프롬프트의 현장 블록 머리에 박는 마커. 본문에 나오면 지시문을 옮긴 것이다. */
export const PROMPT_LEAK_MARKER = '⟦KDR⟧';

export interface Scan2Defect { rule: 'period' | 'amount' | 'bracket' | 'leak' | 'year' | 'image' | 'link' | 'place' | 'percent' | 'section' | 'fact'; text: string }

/** 축약 규격 목차에 있는 H2(순서는 판독 몫). 면책·데이터 출처는 기존 규격 허용. */
const COMPACT_ALLOWED_H2 = /3줄\s*요약|현장\s*개요|사업\s*단계|주변\s*거래|자주\s*묻는\s*질문|관심\s*고객|일정\s*알림|면책|데이터\s*출처|참고\s*자료/;

/** BN-B2 §4 — 축약 규격(site_compact)에서 금지된 제도 일반론 섹션 제목. */
const COMPACT_FORBIDDEN_H2 = /^##\s+[^\n]*(청약\s*자격|가점|취득세|양도세|세액\s*공제|LTV|DSR|대출|전매|재당첨|시나리오|전망)/gm;

/** 정비사업 단계 순서(stage-phrase.ts 표시명의 머리). 현장 블록 「사업 단계(확정)」 줄과 대조. */
const STAGE_ORDER = ['정비구역', '조합설립인가', '시공자', '사업시행계획인가', '관리처분계획인가', '이주', '착공', '일반분양', '준공'];

/** 서울에만 있는 지명(다른 시·도 글에 나오면 혼입). 부산 등에도 있는 이름은 넣지 않는다. */
const SEOUL_ONLY_PLACES = ['강남역', '광화문', '여의도', '잠실', '압구정', '강남구', '서초구', '송파구', '용산구', '마포구', '성수동'];

/** 권역 이름 — 행정구역이 아니라 오귀속 위험만 크다(「부산진구는 동부산」). */
const REGION_BELT_WORDS = ['동부산', '서부산', '중부산', '원도심권', '서면권', '동부권', '서부권'];

/** BN-B2 §3 ② — 편집 회차로 고칠 수 있는 «문장 단위 국소 결함». 그 밖(지명·누출·이미지·링크)은 재생성. */
export const LOCAL_EDIT_RULES: ReadonlySet<Scan2Defect['rule']> = new Set(['period', 'percent', 'year', 'bracket', 'amount']);

/** BN-B §3 A·C — 기계 판정이라 오탐이 낮다. BN 밖 부동산 글감에도 즉시 강제(hold). */
export const HARD_HOLD_RULES: ReadonlySet<Scan2Defect['rule']> = new Set(['image', 'link']);

/** 우리 도메인(사이트·Storage)만 허용. 그 밖 이미지는 핫링크·저작권 결함. */
const OWN_IMAGE_HOST = /(^|\.)kadeora\.app$|\.supabase\.co$/i;

/** ⑥ 본문 이미지 src 중 우리 도메인 밖. */
export function externalImages(content: string): string[] {
  const out: string[] = [];
  const re = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)[^)]*\)|<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content ?? '')) !== null) {
    const url = m[1] ?? m[2];
    try { if (!OWN_IMAGE_HOST.test(new URL(url).hostname)) out.push(url); } catch { out.push(url); }
  }
  return out;
}

/** ⑦ 대조 대상 내부 링크 — `/apt/<slug>` · `/blog/<slug>`(한 단계, 쿼리·앵커 제외). 디코드된 slug. */
export function extractInternalLinks(content: string): { apt: string[]; blog: string[] } {
  const apt = new Set<string>();
  const blog = new Set<string>();
  const re = /(?:\]\(|href=["'])\/(apt|blog)\/([^)"'\s#?]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content ?? '')) !== null) {
    let slug = m[2];
    try { slug = decodeURIComponent(slug); } catch { /* 원문 그대로 */ }
    slug = slug.replace(/\/+$/, '');
    if (!slug || slug.includes('/')) continue;
    // ⚠️ /apt/diagnose·/apt/map 같은 실제 라우트는 현장 slug 가 아니다 — 3회차 10편 전부가 이 오탐으로 hold 됐다.
    if (m[1] === 'apt' && APT_NON_SITE_SEGMENTS.has(slug)) continue;
    (m[1] === 'apt' ? apt : blog).add(slug);
  }
  return { apt: [...apt], blog: [...blog] };
}

const UNIT_WON: Record<string, number> = { 조: 1e12, 억: 1e8, 만: 1e4, 천: 1e3 };
const num = (s: string) => Number(String(s).replace(/,/g, ''));

/**
 * 금액 표기 → 원 단위 정수 목록. 「3억 6,900만원」 「14억원」 「4,300만원」 「8,000원」 「1조 3,086억원」,
 * 범위 「8,000~12,000원」의 앞쪽(단위는 뒤쪽을 따른다)까지.
 */
export function extractWonAmounts(text: string): Array<{ won: number; text: string }> {
  const out: Array<{ won: number; text: string }> = [];
  // 복합(조·억 + 하위 단위) → 단일 단위 순으로 한 번에. 소비한 구간은 다시 세지 않는다.
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(조|억)(?:\s*(\d[\d,]*(?:\.\d+)?)\s*(억|만|천)(?=\s*원|\s|$|[^\d~%]))?\s*원?|(\d[\d,]*(?:\.\d+)?)\s*(만|천)?\s*원/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let won: number;
    if (m[2]) {
      won = num(m[1]) * UNIT_WON[m[2]];
      // ⚠️ 하위 수는 단위가 붙어야 복합이다 — 「9억 1~3%」의 1 은 세율(112529 오탐)
      if (m[3] && m[4]) won += num(m[3]) * UNIT_WON[m[4]];
      // 「6억 초과」처럼 원이 없는 억 단독도 금액이다(취득세 구간) — 그대로 센다
    } else {
      won = num(m[5]) * (m[6] ? UNIT_WON[m[6]] : 1);
    }
    if (Number.isFinite(won) && won > 0) out.push({ won: Math.round(won), text: m[0].trim() });
  }
  // 범위 앞쪽: 「8,000~12,000원」 「2~3억원」
  const rr = /(\d[\d,]*(?:\.\d+)?)\s*[~∼～–-]\s*(\d[\d,]*(?:\.\d+)?)\s*(조|억|만|천)?\s*원/g;
  while ((m = rr.exec(text)) !== null) {
    const won = num(m[1]) * (m[3] ? UNIT_WON[m[3]] : 1);
    if (Number.isFinite(won) && won > 0) out.push({ won: Math.round(won), text: `${m[1]}~(${m[0].trim()})` });
  }
  return out;
}

/** 링크·이미지 대상과 맨 URL 을 걷어낸다(수치 스캔용). */
export function stripUrls(text: string): string {
  return String(text ?? '').replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, ' ').replace(/(src|href)=["'][^"']*["']/g, '');
}

/** 퍼센트 수치 목록(범위 양끝 포함). */
export function extractPercents(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(?:%|퍼센트)|(\d+(?:\.\d+)?)\s*[~∼～–-]\s*(?=\d+(?:\.\d+)?\s*%)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text ?? '')) !== null) out.push(Number(m[1] ?? m[2]));
  return out;
}

/** 현장 블록의 실거래 창 — 「실거래(2026-03~2026-09, …」 → 개월 수(양끝 포함). 없으면 null. */
export function dataWindowMonths(siteContext: string): number | null {
  const m = /실거래\((\d{4})-(\d{2})~(\d{4})-(\d{2})/.exec(siteContext);
  if (!m) return null;
  return (Number(m[3]) - Number(m[1])) * 12 + (Number(m[4]) - Number(m[2])) + 1;
}

const BRACKET_STOP = new Set(['기준', '기준일', '실거래', '거래', '시군구', '전체', '집계', '아파트', '계약', '전용', '신고', '국토교통부', '국토부', '매매']);

export interface Scan2Input { title: string; content: string; siteContext: string; constantsBlock: string; compact?: boolean }

export function scanDraft2({ content, siteContext, constantsBlock, compact }: Scan2Input): Scan2Defect[] {
  const defects: Scan2Defect[] = [];
  const body = content ?? '';

  // BN 4차 판독 ⑥' — 단계·조합 서술 사실 결함(비국소, 재생성). 112539·112540 실측.
  //   문장 단위로 본다 — 실제 문장은 「세입자로 구성된 조합」「조합이 공식으로 구성되지」처럼 낱말 사이가 벌어진다.
  const builderKnown = /^- 시공사: (?!미정)\S/m.test(siteContext);
  const stageLine = /^- 사업 단계\(확정\): (\S+)/m.exec(siteContext)?.[1] ?? '';
  const stageIdx = STAGE_ORDER.findIndex((s) => stageLine.startsWith(s));
  const NEG = /아니|않|없|제외|불가|해당되지/;
  for (const sentence of stripUrls(body).split(/(?<=[.!?。])\s+|\n+/)) {
    const s = sentence.trim();
    if (!s) continue;
    const hit = (why: string) => defects.push({ rule: 'fact', text: `${why}: ${s.slice(0, 60)}` });
    // 조합원 자격 — 세입자·거주자가 조합(원)에 든다는 서술(부정문 제외)
    if (/세입자|거주자/.test(s) && /조합/.test(s) && !NEG.test(s)) { hit('세입자 조합원'); continue; }
    // 시공사가 확정인데 «선정 전»
    if (builderKnown && /시공(?:사|자)[^.\n]{0,8}(?:선정\s*전|선정\s*예정|미정|선정되지|정해지지|향후\s*선정)/.test(s)) { hit('시공사 선정 전'); continue; }
    // 조합설립인가 이후인데 «조합 미구성·조합 설립 예정·조합원 모집»
    if (stageIdx >= 1 && (/조합[^.\n]{0,10}(?:구성|설립)[^.\n]{0,6}(?:되지|되기\s*전|\s전|예정|→)|조합\s*(?:구성|설립)\s*(?:후|이후|→)|조합원\s*모집/.test(s))) { hit('조합 미구성'); continue; }
    // 사업시행계획인가 이후인데 «초기·예비 단계»
    if (stageIdx >= 3 && /(?:초기|예비)\s*(?:개발\s*)?단계/.test(s)) { hit('초기 단계'); continue; }
  }

  // 축약 규격 — 금지 섹션(구조 결함 → 편집 대상 아님, 재생성)
  if (compact) {
    let h: RegExpExecArray | null;
    COMPACT_FORBIDDEN_H2.lastIndex = 0;
    while ((h = COMPACT_FORBIDDEN_H2.exec(body)) !== null) defects.push({ rule: 'section', text: h[0].slice(0, 60) });
    // 목차 규격 밖 H2(「분양가 및 계약 조건」「현장 입지와 교통」「정비사업 특성과 리스크」 — 3회차 5편). 「## 관련 정보」 이후 보강 블록은 제외.
    const cut = body.indexOf('\n## 관련 정보');
    const main = cut > 0 ? body.slice(0, cut) : body;
    const h2 = /^##\s+([^\n]+)/gm;
    while ((h = h2.exec(main)) !== null) {
      if (COMPACT_ALLOWED_H2.test(h[1]) || defects.some((d) => d.rule === 'section' && d.text.includes(h![1].slice(0, 20)))) continue;
      defects.push({ rule: 'section', text: `## ${h[1]}`.slice(0, 60) });
    }
  }

  // ① 기간 수식어 — 데이터 창과 어긋나면. 창이 없으면(실거래 줄 없음) 기간 주장 자체가 근거 없음.
  //    ⚠️ 시세·거래 문맥(앞뒤 30자)에서만 본다 — 「과거 5년 이내 당첨자 세대 아님」은 재당첨 제한 «규정» 이다
  //       (112519·112521 오탐 실측). 제도 상수 블록에 있는 표현도 허용.
  const win = dataWindowMonths(siteContext);
  const pr = /(최근|지난|과거)\s*(\d+)\s*(년|개월|달)(간|동안)?/g;
  const PRICE_CTX = /실거래|시세|가격|거래|중위|매매|상승|하락|호가|전세/;
  let m: RegExpExecArray | null;
  while ((m = pr.exec(body)) !== null) {
    const around = body.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30);
    if (!PRICE_CTX.test(around) || constantsBlock.includes(m[0])) continue;
    const months = Number(m[2]) * (m[3] === '년' ? 12 : 1);
    if (win === null || Math.abs(months - win) > 1) defects.push({ rule: 'period', text: m[0] });
  }

  // ② 블록 밖 금액 — 현장 블록·제도 상수 블록에 없는 원화 금액
  const allowed = new Set(extractWonAmounts(`${siteContext}\n${constantsBlock}`).map((a) => a.won));
  const seen = new Set<string>();
  for (const a of extractWonAmounts(body)) {
    if (allowed.has(a.won) || seen.has(a.text)) continue;
    seen.add(a.text);
    defects.push({ rule: 'amount', text: a.text });
  }

  // 블록 밖 퍼센트 — 「계약금: 분양가의 5~10%」(ABG 계약금 규율) · 「조합원 분양 50~70%」(112527·112529·112531~3 실측).
  //   범위는 양끝을 각각 본다. 현장 블록·제도 상수 블록에 없는 퍼센트 수치는 창작이다.
  const pctAllowed = new Set(extractPercents(`${siteContext}\n${constantsBlock}`));
  const pctSeen = new Set<string>();
  //   ⚠️ URL 을 걷어낸 본문에서만 — OG 이미지 URL 의 퍼센트 인코딩(%EC%82…)을 수치로 읽었다(첫 적용 실측).
  const prose = stripUrls(body);
  const pr2 = /(\d+(?:\.\d+)?)\s*(?:%(?![0-9A-Fa-f]{2})|퍼센트)|(\d+(?:\.\d+)?)\s*[~∼～–-]\s*(?=\d+(?:\.\d+)?\s*%(?![0-9A-Fa-f]{2}))/g;
  while ((m = pr2.exec(prose)) !== null) {
    const v = m[1] ?? m[2];
    if (pctAllowed.has(Number(v)) || pctSeen.has(v)) continue;
    pctSeen.add(v);
    defects.push({ rule: 'percent', text: prose.slice(Math.max(0, m.index - 20), m.index + m[0].length + 5).replace(/\n/g, ' ') });
  }

  //   ABG 증분 4 §4 — 계약금·중도금·잔금 비율은 숫자 자체가 금지(현장별 모집공고 확정). 상수 블록의 다른 항목에
  //   같은 숫자(10% 등)가 있어 위 허용 목록으로는 통과한다(112527·112529·112532·112533) → 명시 규칙.
  const cr = /(계약금|중도금|잔금)[^\n.]{0,25}?\d+(?:\.\d+)?\s*(?:[~∼～–-]\s*\d+(?:\.\d+)?\s*)?%(?![0-9A-Fa-f]{2})/g;
  while ((m = cr.exec(prose)) !== null) defects.push({ rule: 'percent', text: m[0].slice(0, 60) });

  // ③ 최고·최저·중위 가격 인접 괄호의 귀속 — 괄호 속 한글 낱말이 현장 블록에 없으면 창작
  const br = /(최고|최저|중위)[^\n(]{0,40}\(([^)\n]{1,40})\)/g;
  while ((m = br.exec(body)) !== null) {
    const words = m[2].match(/[가-힣]{2,}/g) ?? [];
    const alien = words.filter((w) => !BRACKET_STOP.has(w) && !siteContext.includes(w));
    if (alien.length > 0) defects.push({ rule: 'bracket', text: m[0].slice(0, 80) });
  }

  // 연도 예측 — 일정어가 있는 줄의 연도(2026~2039)가 현장 블록·상수 블록에 없으면 창작 일정(112520 「준공 2030 전후」)
  //    ⚠️ 허용 연도는 «현장 블록» 것만. 제도 상수의 기한·시행일(2028-12-31 등)이 예측 연도를 통과시켰다(112520).
  const known = siteContext;
  const SCHEDULE = /착공|준공|입주|분양|관리처분|사업시행|이주|철거|모집공고|인가|타임라인|일정/;
  for (const line of body.split('\n')) {
    if (!SCHEDULE.test(line)) continue;
    const ys = line.match(/20(2[6-9]|3\d)(?=\s*(년|상반|하반|전후|경|\)|~|-|\s|$))/g) ?? [];
    const alien = [...new Set(ys)].filter((y) => !known.includes(y));
    if (alien.length > 0) defects.push({ rule: 'year', text: line.trim().slice(0, 80) });
  }

  // ⑥ 외부 이미지
  for (const url of externalImages(body)) defects.push({ rule: 'image', text: url.slice(0, 120) });

  // 유령 지명 — 서울 밖 현장 글에 서울 고유 지명(112517 「동래구 일대는 강남역 …」 · 112515 「강남동」 계보).
  //   ⚠️ 좁은 목록만. 「교대역」·「서면」처럼 부산에도 있는 이름은 넣지 않는다.
  const region = /^- 지역: (\S+)/m.exec(siteContext)?.[1] ?? '';
  if (region && region !== '서울') {
    for (const w of SEOUL_ONLY_PLACES) if (body.includes(w)) defects.push({ rule: 'place', text: w });
  }
  // BN-B2 §5 — 역명·권역 서술(112524 「부산역·범내골역」 동래구 오귀속 · 112528 「부산진구는 동부산」).
  //   위치는 시·구·동까지만. 단지명 속 「역」(사직역자이)은 뒤에 한글이 붙어 걸리지 않고, 현장 블록에 있는 이름은 허용.
  const stationRe = /([가-힣]{1,6}역)(?![가-힣])/g;
  const seenSt = new Set<string>();
  const proseSt = stripUrls(body);
  while ((m = stationRe.exec(proseSt)) !== null) {
    const st = m[1];
    if (seenSt.has(st) || defects.some((d) => d.rule === 'place' && d.text === st) || siteContext.includes(st) || /(지역|구역|영역|권역|전역|무역|수역|성역)$/.test(st)) continue;
    seenSt.add(st);
    defects.push({ rule: 'place', text: st });
  }
  for (const w of REGION_BELT_WORDS) if (body.includes(w) && !siteContext.includes(w)) defects.push({ rule: 'place', text: w });

  // ④ 지시문 누출 — 마커 · 규율 용어 · 「본 기사는 …하지 않습니다」 자기 서술 · 내부 트랙 표기
  const leaks = [
    /BN\s*허브|허브\s*발행|bn_hub|bp70_hub|BP70|BP-B|BN-B/,
    /글감|선택\s*조건|이 글의 조건|운영\s*메모|발행\s*경로/,
    new RegExp(PROMPT_LEAK_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    /(데이터|현장|상수)\s*블록/,
    /(수치|사실)\s*규율|수치\s*출처율/,
    /이 문장 그대로|단정하지 말 것|추정하거나 단정하지 말/,
    /(본|이)\s*(기사|글|분석)[은는에서]*\s*[^\n.]{0,40}(추정|계산|단정|사용)(하지|을 하지|는 하지)\s*않/,
  ];
  for (const re of leaks) {
    const hit = re.exec(body);
    if (hit) defects.push({ rule: 'leak', text: body.slice(Math.max(0, hit.index - 20), hit.index + hit[0].length + 20).replace(/\n/g, ' ') });
  }
  return defects;
}

/**
 * ⑤ 제목 규격 — raw_data.complex_name·zone_label 이 있는 글감(BN)만. 규격 머리 「{단지명} — {구역}」 로
 * 시작하지 않으면 규격 제목으로 바꾼다(본문 무손실 · LLM 재호출 없음). 바뀌면 원래 제목을 돌려준다.
 */
export function enforceTitleSpec(title: string, rawData: any): { title: string; replaced: string | null } {
  const cn = String(rawData?.complex_name ?? '').trim();
  const zone = String(rawData?.zone_label ?? '').trim();
  if (!cn || !zone) return { title, replaced: null };
  const head = `${cn} — ${zone}`;
  if ((title ?? '').trim().startsWith(head)) return { title, replaced: null };
  return { title: `${head} 현재 상황·일정 총정리`, replaced: title };
}
