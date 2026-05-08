// lib/blog-templates/data-table.ts — s258
// 매 블로그 글에 비교표 1개 이상 자동 삽입 (네이버 노출 면적 ↑)

export type ComparisonTableRow = (string | number)[];

export function buildMarkdownTable(
  headers: string[],
  rows: ComparisonTableRow[],
  caption?: string,
): string {
  if (rows.length === 0) return "";
  const headLine = `| ${headers.join(" | ")} |`;
  const sepLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyLines = rows.map(
    (r) =>
      `| ${r
        .map((v) =>
          typeof v === "number" ? v.toLocaleString("ko-KR") : String(v),
        )
        .join(" | ")} |`,
  );
  const tbl = [headLine, sepLine, ...bodyLines].join("\n");
  return caption ? `${caption}\n\n${tbl}\n` : `${tbl}\n`;
}

// 카테고리별 기본 비교표 템플릿
export function aptPriceBandTable(rows: {
  size: string;
  region: string;
  avg_price: number; // 만원
  ytd_pct?: number;
}[]): string {
  return buildMarkdownTable(
    ["평형", "지역", "평균 매매가(만원)", "YTD 변동(%)"],
    rows.map((r) => [
      r.size,
      r.region,
      r.avg_price,
      r.ytd_pct !== undefined ? `${r.ytd_pct >= 0 ? "+" : ""}${r.ytd_pct}%` : "-",
    ]),
    "### 평형·지역별 평균 매매가",
  );
}

export function stockComparisonTable(rows: {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  per?: number;
  market_cap?: number;
}[]): string {
  return buildMarkdownTable(
    ["종목", "현재가", "등락률", "PER", "시가총액(억원)"],
    rows.map((r) => [
      `[${r.name}](/stock/${r.symbol})`,
      r.price,
      `${r.change_pct >= 0 ? "+" : ""}${r.change_pct.toFixed(2)}%`,
      r.per ?? "-",
      r.market_cap ?? "-",
    ]),
    "### 관련 종목 비교",
  );
}

export function taxBandTable(rows: {
  band: string;
  rate: string;
  example?: string;
}[]): string {
  return buildMarkdownTable(
    ["과세표준", "세율", "예시"],
    rows.map((r) => [r.band, r.rate, r.example ?? "-"]),
    "### 과세표준 구간별 세율",
  );
}

// 본문에 표가 없으면 빈 표 placeholder를 만들지 말고 false 반환
export function ensureContentHasTable(content: string): {
  has_table: boolean;
  hint: string;
} {
  if (!content)
    return { has_table: false, hint: "본문에 비교표를 1개 이상 추가하세요." };
  if (/<table[\s>]/i.test(content)) return { has_table: true, hint: "" };
  if (/\|[^\n]+\|[\s\S]*?\n\s*\|[\s\-:|]+\|/m.test(content))
    return { has_table: true, hint: "" };
  return {
    has_table: false,
    hint: "비교표(평형/지역/세율/종목 등)를 markdown 형식으로 1개 이상 삽입해야 합니다.",
  };
}
