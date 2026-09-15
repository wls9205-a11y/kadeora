/** 「수치 출처율 100%」 — 판정회신_EX-A ③. BP-B 1회차 실제 환각 문장을 픽스처로 쓴다. */
import { describe, expect, it } from 'vitest';
import { buildAllow, extractNumbers, verifyNumbers } from '@/lib/content/number-verify';

describe('extractNumbers', () => {
  it('금액 동치 — 3.8억 · 38,000만원 · 380,000,000원 · 3억 8,000만', () => {
    const v = extractNumbers('3.8억 / 38,000만원 / 380,000,000원 / 3억 8,000만').map((t) => t.value);
    expect(v).toEqual([38000, 38000, 38000, 38000]);
  });
  it('쉼표 있는 억 — 「3,000억」을 「000억」으로 자르지 않는다', () => {
    expect(extractNumbers('사업비 3,000억원').map((t) => t.value)).toEqual([30000000]);
  });
  it('연월·퍼센트 — 연도 단독은 뽑지 않는다', () => {
    const toks = extractNumbers('2026년 10월 분양, 2026-09 보도, 경쟁률 12.5%, 2026년 기준');
    expect(toks.map((t) => `${t.kind}:${t.value}`)).toEqual(['ym:202610', 'ym:202609', 'pct:12.5']);
  });
});

describe('verifyNumbers', () => {
  const block = [
    '- 세대수: 432세대',
    '- 예상 분양 시기: 2026Q3 (2026-09-14 기준 보도)',
    '- 같은 시군구 실거래(2026-03~2026-08, 42건): 중위 3억 7,950만원 · 최저 2억 1,000만원 · 최고 6억 4,500만원',
  ].join('\n');
  const allow = buildAllow([block, '부산 동구 초량 호반써밋 센트럴베이 분양일정']);

  it('데이터 블록 값은 표기를 바꿔도 통과한다(반올림 동치)', () => {
    const r = verifyNumbers('주변 실거래 중위값은 약 3.8억, 최고 6억 4,500만원입니다(2026-09 보도).', allow);
    expect(r).toEqual({ ok: true, checked: 3, unverified: [] });
  });

  it('BP-B 1회차 환각 문장은 막는다', () => {
    const r = verifyNumbers('84㎡ 기준 약 7,200~7,800만원대로 예상되며, 2026년 10월 공식 모집공고에서 확정됩니다. 평당 12.5~14만 원.', allow);
    expect(r.ok).toBe(false);
    // 「7,800만원대로」는 추정 표현(원대) — 허용 목록과 무관하게 추정: 접두로 막힌다
    expect(r.unverified).toEqual(expect.arrayContaining(['7,200만원', '추정:7,800만원', '2026년 10월', '12.5만 원', '14만 원']));
  });

  it('수량 「만」은 금액이 아니다 — 「1만 세대」·「3만 명」', () => {
    expect(extractNumbers('1만 세대 공급, 방문객 3만 명').length).toBe(0);
  });

  it('ABG 증분4 — 연도 결합 시기 주장은 좁은 연도 목록으로만 허가', () => {
    const narrow = { ...allow, year: [2026] };
    expect(verifyNumbers('김해 부원동 지역주택조합 분양 2026년 일정', { ...allow, year: [] }).ok).toBe(false);
    expect(verifyNumbers('2026년 하반기 분양 예정', narrow).ok).toBe(true);
    expect(verifyNumbers('2027년 입주 예정', narrow).unverified).toEqual(['2027년 입주']);
    // 연월은 ym 축 — 연도 결합 토큰으로 이중 검사하지 않는다
    expect(verifyNumbers('2026년 9월 분양', narrow).unverified).toEqual([]);
    // 결합어가 없는 연도 단독은 검사하지 않는다
    expect(verifyNumbers('2026년 기준 제도', { ...allow, year: [] }).ok).toBe(true);
    // allow.year 가 없으면(다른 호출부) 연도 결합 토큰 미검사 — 기존 동작 불변
    expect(verifyNumbers('2027년 입주 예정', allow).ok).toBe(true);
  });

  it('ABG 증분5 — 추정 표현이 수식하는 금액은 허용 목록과 맞아도 막는다', () => {
    // 블록에 「최저 2억 1,000만원」이 있어 허용폭(±5,000만)으로는 통과하던 112444 실물 문장
    const r = verifyNumbers('예를 들어 2억원대 예상 분양가 기준으로 자기자금 30% 이상 준비가 필요합니다.', { ...allow, pct: [30] });
    expect(r.ok).toBe(false);
    expect(r.unverified).toContain('추정:2억원');
    expect(verifyNumbers('예상 분양가는 3억 7,950만원 수준', allow).unverified).toEqual(['추정:3억 7,950만원']);
    expect(verifyNumbers('최고 6억 4,500만원 안팎', allow).ok).toBe(false);
    // 데이터 값의 반올림 표기(「약」)와 「대출」 같은 낱말은 추정 표현이 아니다
    expect(verifyNumbers('주변 실거래 중위값은 약 3.8억입니다.', allow).ok).toBe(true);
    expect(verifyNumbers('최저 2억 1,000만원 대출 비교', allow).ok).toBe(true);
  });

  it('숫자가 없는 본문은 통과(검사 0)', () => {
    expect(verifyNumbers('분양가는 미공개이며 모집공고 후 확정됩니다.', allow)).toEqual({ ok: true, checked: 0, unverified: [] });
  });
});
