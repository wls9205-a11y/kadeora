// BN-2 §4 — 스캔2. 표본은 112514·112515(2026-09-18) 실측 결함 문장 그대로.
import { describe, it, expect } from 'vitest';
import { scanDraft2, extractWonAmounts, dataWindowMonths, enforceTitleSpec, PROMPT_LEAK_MARKER } from '@/lib/content/draft-scan2';

const SITE = [
  '- 지역: 부산 동래구',
  '- 같은 시군구 아파트 실거래(2026-03~2026-09, 1000건+): 중위 4억 8,800만원 · 최저 2,700만원 · 최고 15억 7,000만원 — 단지를 특정하지 않은 시군구 전체 집계',
].join('\n');
const CONST = '- 청약예치금(부산·85㎡ 이하): 250만원 — 주택공급규칙, 2026-09-01 기준\n- 취득세 1% 구간: 6억원 이하 — 지방세법, 2026-09-01 기준';
const scan = (content: string) => scanDraft2({ title: '', content, siteContext: SITE, constantsBlock: CONST });

describe('extractWonAmounts', () => {
  it('복합·단일·범위', () => {
    const w = extractWonAmounts('3억 6,900만원 · 4,300만원 · 14억원 · 8,000~12,000원 · 1조 3,086억원').map((a) => a.won);
    expect(w).toEqual(expect.arrayContaining([369_000_000, 43_000_000, 1_400_000_000, 12_000, 8_000, 1_308_600_000_000]));
  });
});

describe('dataWindowMonths', () => {
  it('양끝 포함 개월', () => { expect(dataWindowMonths(SITE)).toBe(7); expect(dataWindowMonths('')).toBeNull(); });
});

describe('scanDraft2', () => {
  it('① 데이터 창과 다른 기간 수식어', () => {
    expect(scan('최근 5년간 중위 실거래가가 4억 8,800만원').map((d) => d.rule)).toEqual(['period']);
    expect(scan('최근 6개월 실거래 중위 4억 8,800만원')).toEqual([]);
  });
  it('② 블록 밖 금액 — 관리비 추정', () => {
    const d = scan('관리비는 **평당 월 8,000~12,000원 대**에서 형성될 가능성');
    expect(d.every((x) => x.rule === 'amount')).toBe(true);
    expect(d.length).toBeGreaterThan(0);
  });
  it('② 블록 안 금액은 통과(실거래 집계·제도 상수)', () => {
    expect(scan('중위 4억 8,800만원, 예치금 250만원, 6억원 이하 1%')).toEqual([]);
  });
  it('③ 최고·최저가 괄호 귀속 창작', () => {
    const d = scan('- **최고가**: 15억 7,000만원(강남동 고급 단지)\n- **최저가**: 2,700만원(소형·낙후지역)');
    expect(d.filter((x) => x.rule === 'bracket')).toHaveLength(2);
  });
  it('③ 블록에 있는 낱말 괄호는 통과', () => {
    expect(scan('최고 15억 7,000만원(동래구 전체 집계)')).toEqual([]);
  });
  it('④ 지시문 누출', () => {
    expect(scan('본 기사는 **분양가를 추정하거나 임의로 계산하지 않습니다**.').map((d) => d.rule)).toEqual(['leak']);
    expect(scan(`## 현장 ${PROMPT_LEAK_MARKER}`).map((d) => d.rule)).toContain('leak');
    expect(scan('데이터 블록에 따르면').map((d) => d.rule)).toEqual(['leak']);
  });
});

describe('enforceTitleSpec', () => {
  const raw = { complex_name: '푸르지오 그라니엘', zone_label: '사직4구역 재개발' };
  it('규격 머리가 아니면 규격 제목으로', () => {
    expect(enforceTitleSpec('부산 동래구 푸르지오 그라니엘·사직4구역 재개발 일정·현황', raw))
      .toEqual({ title: '푸르지오 그라니엘 — 사직4구역 재개발 현재 상황·일정 총정리', replaced: '부산 동래구 푸르지오 그라니엘·사직4구역 재개발 일정·현황' });
  });
  it('규격 머리면 그대로 · BN 키 없으면 그대로', () => {
    expect(enforceTitleSpec('푸르지오 그라니엘 — 사직4구역 재개발 분양 일정', raw).replaced).toBeNull();
    expect(enforceTitleSpec('아무 제목', {}).replaced).toBeNull();
  });
});
