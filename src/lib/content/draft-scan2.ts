// BN-2 §4 — 판독 게이트 보강 5종(스캔2). 수치 출처 게이트(number-verify)가 못 잡은 결함형을 잡는다.
//
// 112514·112515(2026-09-18) 실측 결함형:
//   ① 기간 수식어 — 데이터 창은 6개월인데 「최근 5년간 중위 실거래가」
//   ② 블록 밖 금액 — 「관리비 평당 월 8,000~12,000원 대」(추정 표현 사전의 「~대」가 게이트를 통과시켰다)
//   ③ 괄호 귀속 창작 — 「최고가 15억 7,000만원(강남동 고급 단지)」 — 동래구에 강남동은 없다
//   ④ 지시문 누출 — 「본 기사는 분양가를 추정하거나 임의로 계산하지 않습니다」
//   ⑤ 제목 규격 불일치 — title_spec 을 따르지 않은 제목
// 모두 순수 함수다. 판정·기록은 호출부(issue-draft)가 한다.

/** 프롬프트의 현장 블록 머리에 박는 마커. 본문에 나오면 지시문을 옮긴 것이다. */
export const PROMPT_LEAK_MARKER = '⟦KDR⟧';

export interface Scan2Defect { rule: 'period' | 'amount' | 'bracket' | 'leak'; text: string }

const UNIT_WON: Record<string, number> = { 조: 1e12, 억: 1e8, 만: 1e4, 천: 1e3 };
const num = (s: string) => Number(String(s).replace(/,/g, ''));

/**
 * 금액 표기 → 원 단위 정수 목록. 「3억 6,900만원」 「14억원」 「4,300만원」 「8,000원」 「1조 3,086억원」,
 * 범위 「8,000~12,000원」의 앞쪽(단위는 뒤쪽을 따른다)까지.
 */
export function extractWonAmounts(text: string): Array<{ won: number; text: string }> {
  const out: Array<{ won: number; text: string }> = [];
  // 복합(조·억 + 하위 단위) → 단일 단위 순으로 한 번에. 소비한 구간은 다시 세지 않는다.
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(조|억)(?:\s*(\d[\d,]*(?:\.\d+)?)\s*(억|만|천)?)?\s*원?|(\d[\d,]*(?:\.\d+)?)\s*(만|천)?\s*원/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let won: number;
    if (m[2]) {
      won = num(m[1]) * UNIT_WON[m[2]];
      if (m[3]) won += num(m[3]) * (m[4] ? UNIT_WON[m[4]] : (m[2] === '조' ? 1e8 : 1e4));
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

/** 현장 블록의 실거래 창 — 「실거래(2026-03~2026-09, …」 → 개월 수(양끝 포함). 없으면 null. */
export function dataWindowMonths(siteContext: string): number | null {
  const m = /실거래\((\d{4})-(\d{2})~(\d{4})-(\d{2})/.exec(siteContext);
  if (!m) return null;
  return (Number(m[3]) - Number(m[1])) * 12 + (Number(m[4]) - Number(m[2])) + 1;
}

const BRACKET_STOP = new Set(['기준', '기준일', '실거래', '거래', '시군구', '전체', '집계', '아파트', '계약', '전용', '신고', '국토교통부', '국토부', '매매']);

export interface Scan2Input { title: string; content: string; siteContext: string; constantsBlock: string }

export function scanDraft2({ content, siteContext, constantsBlock }: Scan2Input): Scan2Defect[] {
  const defects: Scan2Defect[] = [];
  const body = content ?? '';

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

  // ③ 최고·최저·중위 가격 인접 괄호의 귀속 — 괄호 속 한글 낱말이 현장 블록에 없으면 창작
  const br = /(최고|최저|중위)[^\n(]{0,40}\(([^)\n]{1,40})\)/g;
  while ((m = br.exec(body)) !== null) {
    const words = m[2].match(/[가-힣]{2,}/g) ?? [];
    const alien = words.filter((w) => !BRACKET_STOP.has(w) && !siteContext.includes(w));
    if (alien.length > 0) defects.push({ rule: 'bracket', text: m[0].slice(0, 80) });
  }

  // ④ 지시문 누출 — 마커 · 규율 용어 · 「본 기사는 …하지 않습니다」 자기 서술
  const leaks = [
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
