/**
 * 「수치 출처율 100%」 게이트 — 판정회신_EX-A ③ (2026-09-15).
 *
 * 환각 계열 3호: LLM 이 데이터 블록에 없는 금액·연월·퍼센트를 확정처럼 쓴다
 *   (BP-B 1회차 실측: 「84㎡ 기준 약 7,200~7,800만원대」「평당 12.5~14만 원」「2026년 10월 공식 모집공고」).
 * 규칙: 본문의 수치 토큰을 «허용 목록» 과 대조한다. 목록에 없는 토큰이 하나라도 있으면 막는다.
 *
 * ⛔ 판정만 한다(RULES#143) — DB·AI 를 모른다. 허용 목록은 호출부가 «그 글에 넣어 준 데이터» 로 만든다.
 * ⚠️ 동치: 3.8억 ↔ 38,000만원 ↔ 380,000,000원 은 같은 값이다. 금액은 «만원 정수» 로 정규화해 비교한다.
 * ⚠️ 반올림: 데이터가 37,950만원이면 본문 「3.8억」은 통과한다(표기 단위의 유효자릿수 안의 차이).
 * ⚠️ 연도 단독(「2026년」)은 검사하지 않는다 — 기준 연도·면책 문구에 늘 쓰여 오탐만 만든다. 연월(「2026년 10월」)부터 본다.
 */

export type NumKind = 'amount' | 'ym' | 'pct';
export interface NumToken { kind: NumKind; raw: string; value: number; tolerance: number }

const n = (s: string) => Number(s.replace(/,/g, ''));

/** 금액 토큰 → 만원. 「3억 8,000만」「3.8억」「38,000만원」「380,000,000원」. */
function amountTokens(text: string): NumToken[] {
  const out: NumToken[] = [];
  // 만 단위: 「원」이 붙으면 자릿수 무관(「14만 원」), 안 붙으면 세 자리 이상만(「1만 세대」 같은 수량 오탐 방지)
  const re = /(\d+(?:\.\d+)?)\s*억(?:\s*(\d{1,3}(?:,\d{3})*|\d+)\s*만)?\s*원?|(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*만\s*원|(\d{1,3}(?:,\d{3})+|\d{3,})\s*만(?!\s*(?:세대|명|건|호|가구|㎡))|(\d{1,3}(?:,\d{3}){2,})\s*원/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1]) {
      const eok = n(m[1]);
      const man = m[2] ? n(m[2]) : 0;
      const value = Math.round(eok * 10000 + man);
      // 「3.8억」은 0.1억 단위 표기 — ±500만 안이면 같은 값으로 본다
      const decimals = (m[1].split('.')[1] ?? '').length;
      const tolerance = m[2] ? 0 : decimals === 0 ? 5000 : decimals === 1 ? 500 : 50;
      out.push({ kind: 'amount', raw: m[0].trim(), value, tolerance });
    } else if (m[3] || m[4]) {
      out.push({ kind: 'amount', raw: m[0].trim(), value: n(m[3] ?? m[4]), tolerance: 0 });
    } else if (m[5]) {
      out.push({ kind: 'amount', raw: m[0].trim(), value: Math.round(n(m[5]) / 10000), tolerance: 0 });
    }
  }
  return out;
}

function ymTokens(text: string): NumToken[] {
  const out: NumToken[] = [];
  const re = /(20\d{2})\s*년\s*(1[0-2]|0?[1-9])\s*월|(20\d{2})[-.](1[0-2]|0[1-9])(?![\d])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const y = Number(m[1] ?? m[3]);
    const mo = Number(m[2] ?? m[4]);
    out.push({ kind: 'ym', raw: m[0].trim(), value: y * 100 + mo, tolerance: 0 });
  }
  return out;
}

function pctTokens(text: string): NumToken[] {
  const out: NumToken[] = [];
  const re = /(\d+(?:\.\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const decimals = (m[1].split('.')[1] ?? '').length;
    out.push({ kind: 'pct', raw: m[0].trim(), value: n(m[1]), tolerance: decimals === 0 ? 0.5 : 0.05 });
  }
  return out;
}

/** 「7,200~7,800만원」「3~4억원대」 — 범위의 앞 숫자에 뒤 단위를 붙인다. 안 붙이면 앞 숫자가 검사를 빠져나간다. */
function expandRanges(text: string): string {
  return text.replace(/(\d[\d,]*(?:\.\d+)?)\s*[~∼-]\s*(\d[\d,]*(?:\.\d+)?)\s*(억|만\s*원|만|%)/g, '$1$3 ~ $2$3');
}

export function extractNumbers(text: string): NumToken[] {
  const t = expandRanges(text ?? '');
  return [...amountTokens(t), ...ymTokens(t), ...pctTokens(t)];
}

export interface Allow { amount: number[]; ym: number[]; pct: number[] }

/** 허용 목록 — 데이터 블록·원문 요약 등 «그 글에 준 텍스트» 에서 같은 추출기로 뽑는다(추출 규칙이 하나다). */
export function buildAllow(sources: Array<string | null | undefined>, extra: Partial<Allow> = {}): Allow {
  const allow: Allow = { amount: [...(extra.amount ?? [])], ym: [...(extra.ym ?? [])], pct: [...(extra.pct ?? [])] };
  for (const s of sources) for (const tok of extractNumbers(s ?? '')) allow[tok.kind].push(tok.value);
  return allow;
}

export interface VerifyResult { ok: boolean; checked: number; unverified: string[] }

export function verifyNumbers(body: string, allow: Allow): VerifyResult {
  const toks = extractNumbers(body);
  const unverified: string[] = [];
  for (const t of toks) {
    const pool = allow[t.kind];
    const hit = pool.some((v) => Math.abs(v - t.value) <= t.tolerance);
    if (!hit) unverified.push(t.raw);
  }
  return { ok: unverified.length === 0, checked: toks.length, unverified: Array.from(new Set(unverified)) };
}
