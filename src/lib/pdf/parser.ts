// lib/pdf/parser.ts — s258
// PDF/HWP/HWPX/ZIP 분기 파싱 + 거짓 성공 방지
// raw_text length>=100 일 때만 success 마크
// Architecture Rule #16: maxDuration=10 envelope 안에서 호출되도록 timeout 옵션 노출

import pdfParse from "pdf-parse";

export type PdfParseResult = {
  ok: boolean;
  raw_text: string | null;
  byte_size: number;
  content_type: string;
  format: "pdf" | "hwp" | "hwpx" | "zip" | "unknown";
  error?: string;
};

const MIN_RAW_LEN = 100;
const MAX_RAW_LEN = 20_000; // 5,000자 cap → 20,000자
const FETCH_TIMEOUT_MS = 8_000;

async function fetchWithTimeout(
  url: string,
  ms: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      // 한국 공공 fileserver 일부가 UA 차단함
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KadeoraBot/1.0)" },
      redirect: "follow",
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function sniffFormat(
  contentType: string,
  bytes: Uint8Array,
): PdfParseResult["format"] {
  // 1) Content-Type 우선
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("pdf")) return "pdf";
  if (ct.includes("hwp")) return "hwp";
  if (ct.includes("zip") || ct.includes("hwpx")) return "hwpx";

  // 2) Magic number sniff
  if (bytes.length >= 4) {
    const sig = String.fromCharCode(...bytes.slice(0, 4));
    if (sig.startsWith("%PDF")) return "pdf";
    if (sig.startsWith("PK")) return "hwpx"; // ZIP 시그니처 (HWPX는 ZIP 컨테이너)
  }
  if (bytes.length >= 8) {
    const hex8 = Array.from(bytes.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    // HWP 5.x 시그니처: D0CF11E0A1B11AE1 (OLE Compound File)
    if (hex8.startsWith("d0cf11e0a1b11ae1")) return "hwp";
  }
  return "unknown";
}

export async function parseAnnouncementDoc(
  url: string,
): Promise<PdfParseResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(url);
  } catch (e: any) {
    return {
      ok: false,
      raw_text: null,
      byte_size: 0,
      content_type: "",
      format: "unknown",
      error: `fetch_failed: ${e?.message?.slice(0, 200) || "unknown"}`,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      raw_text: null,
      byte_size: 0,
      content_type: res.headers.get("content-type") || "",
      format: "unknown",
      error: `http_${res.status}`,
    };
  }

  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const ct = res.headers.get("content-type") || "";
  const format = sniffFormat(ct, bytes);

  // PDF 처리
  if (format === "pdf") {
    try {
      const parsed = await pdfParse(Buffer.from(ab), { max: 0 });
      const text = (parsed.text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_RAW_LEN);
      const ok = text.length >= MIN_RAW_LEN;
      return {
        ok,
        raw_text: ok ? text : null,
        byte_size: bytes.length,
        content_type: ct,
        format,
        error: ok ? undefined : `pdf_text_too_short:${text.length}`,
      };
    } catch (e: any) {
      return {
        ok: false,
        raw_text: null,
        byte_size: bytes.length,
        content_type: ct,
        format,
        error: `pdf_parse_threw: ${e?.message?.slice(0, 200) || "unknown"}`,
      };
    }
  }

  // HWP/HWPX/ZIP — 외부 파서 미설치 환경에서는 일단 unsupported로 마크
  // (별도 cron이 hwp.js / unzipper로 처리 — 본 라우트에선 skip)
  if (format === "hwp" || format === "hwpx" || format === "zip") {
    return {
      ok: false,
      raw_text: null,
      byte_size: bytes.length,
      content_type: ct,
      format,
      error: `unsupported_format:${format}`,
    };
  }

  return {
    ok: false,
    raw_text: null,
    byte_size: bytes.length,
    content_type: ct,
    format: "unknown",
    error: `unknown_format:${ct.slice(0, 60)}`,
  };
}

// 평당가/공급가 추출 — LLM 호출 전 단계 정규식 휴리스틱
export function extractPriceHeuristic(raw: string): {
  price_per_pyeong: number | null;
  evidence: string | null;
} {
  if (!raw) return { price_per_pyeong: null, evidence: null };
  // "평당 1,234만원" / "3.3㎡당 1,234,000원" / "평당가 4,500" 등 패턴
  const patterns: RegExp[] = [
    /평당\s*([0-9,]{2,8})\s*만\s*원/,
    /평당가\s*([0-9,]{2,8})\s*만/,
    /3\.?3\s*㎡\s*당\s*([0-9,]{2,8})\s*만/,
    /([0-9,]{2,8})\s*만\s*원\s*\/\s*평/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) {
      const num = parseInt(m[1].replace(/,/g, ""), 10);
      if (Number.isFinite(num) && num >= 100 && num <= 30_000) {
        return {
          price_per_pyeong: num,
          evidence: m[0].slice(0, 100),
        };
      }
    }
  }
  return { price_per_pyeong: null, evidence: null };
}
