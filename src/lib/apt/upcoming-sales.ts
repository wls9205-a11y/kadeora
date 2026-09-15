/**
 * E-7·E-11 — 지역 허브의 「분양예정 단지」 목록과 질문형 FAQ (PQAB · TC 증분 · 2026-09-15).
 *
 * 왜: 지역 허브는 청약·실거래·재개발·미분양 «원천 네 목록» 만 보여 줘서, 공고 전 분양예정 현장(esp 보유)은
 *     구조적으로 한 곳도 안 떴다(신규 12곳 허브 노출 0 실측). 그리고 「2026년 하반기 부산 분양 예정 단지는
 *     어디인가요?」 같은 질문형 검색에 답할 데이터(esp)는 우리만 갖고 있다.
 *
 * ⛔ 판정만 한다(RULES#143) — DB·화면을 모른다.
 * ⛔ 원문보다 정밀하게 말하지 않는다(sale-period.ts §7-1). 「2026」 현장을 「하반기」 목록에 넣지 않는다.
 * ⛔ 지나간 시기의 esp(「2026-03」인데 오늘이 9월)는 «분양예정» 이 아니다 — 목록에서 뺀다.
 */
import { parseSalePeriod, salePeriodText } from '@/lib/apt/sale-period';

export interface UpcomingRow {
  slug: string;
  name: string;
  sigungu?: string | null;
  period: string;          // expected_sale_period 원문
  asof?: string | null;    // expected_sale_period_asof
}

export interface UpcomingItem extends UpcomingRow { text: string; start: string; end: string }

const RE = /^(\d{4})(?:(H[12])|(Q[1-4])|-(0[1-9]|1[0-2]))?$/;
const pad = (n: number) => String(n).padStart(2, '0');

/** 시기 값이 가리키는 «구간» [start, end] (YYYY-MM). 못 읽으면 null. */
export function periodWindow(raw: string): { start: string; end: string } | null {
  const m = RE.exec((raw ?? '').trim());
  if (!m) return null;
  const y = m[1];
  if (m[4]) return { start: `${y}-${m[4]}`, end: `${y}-${m[4]}` };
  if (m[3]) { const q = Number(m[3][1]); return { start: `${y}-${pad(q * 3 - 2)}`, end: `${y}-${pad(q * 3)}` }; }
  if (m[2]) return m[2] === 'H1' ? { start: `${y}-01`, end: `${y}-06` } : { start: `${y}-07`, end: `${y}-12` };
  return { start: `${y}-01`, end: `${y}-12` };
}

/**
 * 아직 끝나지 않은 시기만, «구간이 먼저 끝나는» 순으로.
 * ⚠️ 시작일로 정렬하면 연도만 아는 「2026」(1월 시작)이 「2026년 3분기」보다 앞에 온다 — 가까운 순이 아니다.
 */
export function upcomingItems(rows: UpcomingRow[], todayYm: string): UpcomingItem[] {
  const out: UpcomingItem[] = [];
  for (const r of rows) {
    const w = periodWindow(r.period);
    const text = salePeriodText(r.period);
    if (!w || !text || w.end < todayYm) continue;
    out.push({ ...r, text, ...w });
  }
  return out.sort((a, b) => a.end.localeCompare(b.end) || a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}

export interface HubFaq { q: string; a: string }

const listNames = (items: UpcomingItem[], max: number) =>
  items.slice(0, max).map((i) => `${i.name}(${i.sigungu ? `${i.sigungu} · ` : ''}${i.text})`).join(', ')
  + (items.length > max ? ` 외 ${items.length - max}곳` : '');

/**
 * 질문형 FAQ. 데이터가 없으면 그 질문을 «만들지 않는다»(빈 답 금지).
 * ⚠️ 반기 질문에는 «그 반기 안에 들어가는» 현장만 싣는다 — 연도만 아는 현장(「2026년」)은 하반기라고 말할 수 없다.
 */
export function upcomingFaqs(region: string, items: UpcomingItem[], todayYm: string): HubFaq[] {
  const faqs: HubFaq[] = [];
  const [y, mo] = todayYm.split('-').map(Number);
  const half = mo <= 6 ? 'H1' : 'H2';
  const halfWin = periodWindow(`${y}${half}`)!;
  const inHalf = items.filter((i) => parseSalePeriod(i.period)?.precision !== 'year' && i.start >= halfWin.start && i.end <= halfWin.end);
  if (inHalf.length > 0) {
    faqs.push({
      q: `${y}년 ${half === 'H1' ? '상' : '하'}반기 ${region} 분양 예정 단지는 어디인가요?`,
      a: `카더라가 보도·공고로 확인한 ${y}년 ${half === 'H1' ? '상' : '하'}반기 ${region} 분양예정 현장은 ${inHalf.length}곳입니다: ${listNames(inHalf, 8)}. 시기는 각 현장 보도 기준이며 모집공고가 나오면 바뀔 수 있습니다.`,
    });
  }
  if (items.length > 0) {
    faqs.push({
      q: `${region}에서 곧 분양하는 아파트는 어디인가요?`,
      a: `가장 가까운 분양예정 현장은 ${listNames(items, 5)}입니다. 전체 ${items.length}곳의 시기·출처는 이 페이지 「분양예정 단지」 목록에서 확인할 수 있습니다.`,
    });
  }
  return faqs;
}
