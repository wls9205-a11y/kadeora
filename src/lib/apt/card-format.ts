// src/lib/apt/card-format.ts — s259
// 카드 표시용 포맷터 — 한국식 (만원, ㎡, D-N)

export function formatDday(dday: number | null | undefined): {
  label: string;
  tone: "urgent" | "soon" | "normal" | "past" | "none";
} {
  if (dday === null || dday === undefined) return { label: "-", tone: "none" };
  if (dday < 0) return { label: `마감 +${Math.abs(dday)}`, tone: "past" };
  if (dday === 0) return { label: "D-DAY", tone: "urgent" };
  if (dday <= 3) return { label: `D-${dday}`, tone: "urgent" };
  if (dday <= 7) return { label: `D-${dday}`, tone: "soon" };
  return { label: `D-${dday}`, tone: "normal" };
}

export function formatDateRange(
  start: string | null,
  end: string | null,
): string {
  if (!start && !end) return "-";
  const fmt = (d: string) => {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  };
  if (start && end) return `${fmt(start)} ~ ${fmt(end)}`;
  return fmt(start ?? end!);
}

export function formatPricePerPyeong(value: number | null | undefined): string {
  if (!value || value <= 0) return "-";
  // 만원 단위 입력 → "X,XXX만원/평"
  return `${value.toLocaleString("ko-KR")}만원/평`;
}

export function formatSupplyRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (!min && !max) return "-";
  const toEok = (v: number) => {
    // 만원 단위 → 억/만원
    if (v >= 10000) {
      const eok = Math.floor(v / 10000);
      const man = v % 10000;
      return man > 0 ? `${eok}.${Math.floor(man / 1000)}억` : `${eok}억`;
    }
    return `${v.toLocaleString("ko-KR")}만`;
  };
  if (min && max && min !== max) return `${toEok(min)} ~ ${toEok(max)}`;
  return toEok(min ?? max!);
}

export function formatAreaLineup(lineup: number[] | null | undefined): string {
  if (!lineup || lineup.length === 0) return "-";
  // 너무 많으면 처음 4개 + "외 N개"
  if (lineup.length <= 4) return `${lineup.join(", ")}㎡`;
  return `${lineup.slice(0, 4).join(", ")}㎡ 외 ${lineup.length - 4}개`;
}

export function formatHouseholds(n: number | null | undefined): string {
  if (!n || n <= 0) return "-";
  return `${n.toLocaleString("ko-KR")}세대`;
}

export function formatRegionShort(region: string | null | undefined): string {
  if (!region) return "-";
  // "부산광역시 사상구" → "부산 사상구" (공간 절약)
  return region
    .replace("특별시", "")
    .replace("광역시", "")
    .replace("특별자치시", "")
    .replace("특별자치도", "")
    .trim();
}

export const TAG_KO: Record<string, { label: string; tone: string }> = {
  new:            { label: "신규",       tone: "blue" },
  imminent:       { label: "마감임박",   tone: "red" },
  ongoing:        { label: "진행중",     tone: "green" },
  regulated:      { label: "조정대상",   tone: "amber" },
  speculative:    { label: "투기과열",   tone: "amber" },
  price_limit:    { label: "분양가상한", tone: "purple" },
  station:        { label: "역세권",     tone: "blue" },
  milestone_soon: { label: "단계임박",   tone: "amber" },
  stage_change:   { label: "단계변경",   tone: "blue" },
  large_unsold:   { label: "대규모",     tone: "amber" },
  recent_unsold:  { label: "최근등재",   tone: "blue" },
  discount:       { label: "할인",       tone: "red" },
  active_market:  { label: "활발",       tone: "green" },
  reviewed:       { label: "리뷰多",     tone: "blue" },
  rising:         { label: "↑ 상승",     tone: "red" },
  falling:        { label: "↓ 하락",     tone: "blue" },
  recent_trade:   { label: "최근거래",   tone: "green" },
};

export function formatTag(tag: string): { label: string; tone: string } {
  return TAG_KO[tag] ?? { label: tag, tone: "gray" };
}

export const TAG_TONE_CLASS: Record<string, string> = {
  blue:   "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  green:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  red:    "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  amber:  "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  gray:   "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
