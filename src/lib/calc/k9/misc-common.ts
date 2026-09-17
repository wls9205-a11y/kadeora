/**
 * K-9 수치층 — misc 클러스터 공통 (2026-09-17).
 *
 * ⛔ 법정 수치는 여기 적지 않는다. policy_constants 가 정본이고, 서버가 `__policy` 로 주입한다.
 *    계산기는 «어느 행인가» 만 안다. 주입이 없거나 행이 없으면 «지어내지 않고» 그렇게 말한다.
 */
import type { CalcResult } from '../formulas';
import { formatKRWExact } from '../tax-tables';
import { parsePolicyPack } from '../gov-tables';

export type V = Record<string, number | string>;

export const n = (v: unknown) => Number(v) || 0;
/** 산출액은 전부 무손실 표기(G2). */
export const fmt = (v: number) => formatKRWExact(v);

type Detail = { label: string; value: string };

/**
 * 정책 상수 판독기 — 읽는 순간 «없는 키» 를 기록한다.
 * 계산 전에 필요한 키를 전부 읽고, `missing` 이 비어 있지 않으면 계산하지 않는다.
 */
export function policyReader(v: V) {
  const pack = parsePolicyPack(v.__policy);
  const missing: string[] = [];
  const used = new Set<string>();
  const pct = (key: string): number => {
    used.add(key);
    const x = pack?.pct?.[key];
    if (typeof x !== 'number') { missing.push(key); return NaN; }
    return x;
  };
  return {
    pack,
    missing,
    pct,
    /** 퍼센트 → 비율(15 → 0.15). */
    rate: (key: string): number => pct(key) / 100,
    amt: (key: string): number => {
      used.add(key);
      const x = pack?.amt?.[key];
      if (typeof x !== 'number') { missing.push(key); return NaN; }
      return x;
    },
    /** 있으면 금액, 없으면 null — «선택적» 규제(예: LTV 가격별 한도)에만 쓴다. */
    amtOpt: (key: string): number | null => {
      const x = pack?.amt?.[key];
      if (typeof x === 'number') { used.add(key); return x; }
      return null;
    },
    /** 읽은 행들의 출처·시행일·상태를 한 줄로. 날짜 없는 규제 수치는 거짓 신선도다. */
    basis: (): Detail[] => {
      const out: Detail[] = [];
      const src = new Map<string, Set<string>>();
      const unverified: string[] = [];
      for (const k of used) {
        const m = (pack?.meta?.[k] ?? {}) as { source?: string; from?: string; status?: string };
        if (m.source) {
          if (!src.has(m.source)) src.set(m.source, new Set());
          if (m.from) src.get(m.source)!.add(m.from);
        }
        if (m.status && m.status !== 'confirmed') unverified.push(k);
      }
      if (src.size) {
        out.push({
          label: '근거',
          value: [...src.entries()]
            .map(([s, d]) => (d.size ? `${s}(시행 ${[...d].sort().join('·')})` : s))
            .join(' / '),
        });
      }
      if (unverified.length) {
        out.push({ label: '⚠️ 상태', value: `원문 대조 전 값이 섞여 있다(${unverified.join(', ')}) — 그렇게 말합니다 단계` });
      }
      return out;
    },
  };
}

/** 주입 누락 — 「세율 기준 미수신」. 숫자를 채워 넣지 않는다. */
export function missingResult(keys: string[]): CalcResult {
  return {
    main: { label: '세율 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
    details: [{ label: '사유', value: `법정 기준값(${[...new Set(keys)].join(', ')})을 아직 받지 못했다 — 추정값으로 채우지 않는다` }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 날짜 — 'YYYY-MM-DD' 를 «현지 자정» 으로 읽는다.
// ⚠️ new Date('YYYY-MM-DD') 는 UTC 로 파싱된다. KST 는 괜찮지만 음수 오프셋에서 하루 밀린다.
// ─────────────────────────────────────────────────────────────────────────────
export function parseYmd(s: unknown): Date | null {
  const m = String(s ?? '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 테스트가 «오늘» 을 고정할 수 있게 — 사용자 입력이 아니다. */
export function today(v: V): Date {
  const t = parseYmd(v.__today);
  if (t) return t;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/**
 * 월·년 단위 기간의 만료일 — 민법 §160.
 *   ② 기간 말일은 최종 월에서 기산일에 «해당한 날의 전일»
 *   ③ 최종 월에 해당일이 없으면 «그 월의 말일»
 * 기산일(start)부터 months 개월.
 * ⛔ JS setMonth 는 넘친다(8/31 + 18개월 → 3/3). 쓰지 않는다.
 */
export function periodEnd(start: Date, months: number): Date {
  const total = start.getMonth() + months;
  const y = start.getFullYear() + Math.floor(total / 12);
  const mo = ((total % 12) + 12) % 12;
  const lastDay = new Date(y, mo + 1, 0).getDate();
  if (start.getDate() > lastDay) return new Date(y, mo, lastDay);     // ③
  return new Date(y, mo, start.getDate() - 1);                         // ② (1일이면 전월 말일로 자연 이동)
}
