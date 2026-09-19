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
  it('① 시세 문맥 밖의 기간(재당첨 제한 규정)은 통과 — 112519 오탐', () => {
    expect(scan('- **당첨 제한**: 과거 5년 이내 당첨자 세대 아님')).toEqual([]);
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

// BN-B 판독 §3 — ⑥ 외부 이미지 · ⑦ 링크 추출 · 연도 예측 · 내부 표기 누출(112517·112520 실측)
import { externalImages, extractInternalLinks, HARD_HOLD_RULES } from '@/lib/content/draft-scan2';

describe('BN-B 증보', () => {
  it('⑥ 외부 이미지 — 유튜브 썸네일은 결함, 우리 도메인·Storage 는 통과', () => {
    expect(externalImages('![x](https://i.ytimg.com/vi/jEWEnQHYgqs/maxresdefault.jpg)')).toHaveLength(1);
    expect(externalImages('![x](https://kadeora.app/api/og?title=a) ![y](https://abc.supabase.co/storage/v1/x.webp)')).toEqual([]);
    expect(scan('![썸네일](https://i.ytimg.com/vi/a/maxresdefault.jpg)').map((d) => d.rule)).toEqual(['image']);
    expect(scan('![광화문 래미안](https://i.ytimg.com/vi/a/maxresdefault.jpg)').map((d) => d.rule)).toEqual(['image', 'place']);
    expect(HARD_HOLD_RULES.has('image') && HARD_HOLD_RULES.has('link')).toBe(true);
  });
  it('⑦ 내부 링크 추출 — /apt·/blog 한 단계만, 디코드', () => {
    expect(extractInternalLinks('[a](/blog/redev-basic) [b](/apt/%EC%82%AC%EC%A7%815-%EC%9E%AC%EA%B0%9C%EB%B0%9C) [c](/blog?category=apt) [d](/apt/redev/부산)'))
      .toEqual({ apt: ['사직5-재개발'], blog: ['redev-basic'] });
  });
  it('연도 예측 — 블록에 없는 연도의 일정 줄', () => {
    expect(scan('| 준공 | 2030 전후 |').map((d) => d.rule)).toEqual(['year']);
    expect(scan('실거래 기준 기간은 2026-03~2026-09 입니다. 분양 일정은 모집공고 후 확정')).toEqual([]);
  });
  it('내부 표기 누출 — 「(BN 허브 발행)」', () => {
    expect(scan('> 사업 단계·일정 정리 (BN 허브 발행)').map((d) => d.rule)).toEqual(['leak']);
  });
});

describe('BN-B 증보 2 — 유령 지명 · 상수 연도 비허용', () => {
  it('서울 밖 현장 글의 서울 고유 지명 + 역명(BN-B2 §5 — 역명 서술 자체 금지)', () => {
    expect(scan('동래구 일대는 강남역, 교대역, 사직역 등').map((d) => d.text).sort()).toEqual(['강남역', '교대역', '사직역']);
  });
  it('상수 블록의 연도는 일정 예측을 허가하지 않는다', () => {
    const d = scanDraft2({ title: '', content: '6. **준공 및 입주** (2030년 전후)', siteContext: SITE, constantsBlock: '- 감면 기한: 2030-12-31' });
    expect(d.map((x) => x.rule)).toEqual(['year']);
  });
});

describe('BN-B 재생성 판독 — 퍼센트 · 금액 파서', () => {
  it('계약금·중도금 비율은 숫자 자체가 결함', () => {
    expect(scan('- **계약금:** 분양가의 5~10% (계약 시 납부)').map((d) => d.rule)).toContain('percent');
  });
  it('URL 퍼센트 인코딩은 수치가 아니다', () => {
    expect(scan('![표지](https://kadeora.app/api/og?title=%EC%82%AC%EC%A7%814)')).toEqual([]);
  });
  it('「9억 1~3%」의 1 은 금액이 아니다', () => {
    expect(extractWonAmounts('6억~9억 1~3%').map((a) => a.won)).not.toContain(900_010_000);
  });
});

// BN-B2 §3·§5 — 편집 대상 분류 · 역명·권역 · 운영 메모 누출(112524·112528 실측)
import { LOCAL_EDIT_RULES } from '@/lib/content/draft-scan2';

describe('BN-B2 증보', () => {
  it('편집 회차는 국소 결함만', () => {
    for (const r of ['period', 'percent', 'year', 'bracket', 'amount'] as const) expect(LOCAL_EDIT_RULES.has(r)).toBe(true);
    for (const r of ['place', 'leak', 'image', 'link'] as const) expect(LOCAL_EDIT_RULES.has(r)).toBe(false);
  });
  it('역명·권역은 결함, 단지명 속 「역」·지역·구역은 통과', () => {
    expect(scan('지하철 1·2호선 교차(부산역, 범내골역 등)').filter((d) => d.rule === 'place').map((d) => d.text)).toEqual(['부산역', '범내골역']);
    expect(scan('부산진구는 동부산의 대표 주거지').map((d) => d.rule)).toEqual(['place']);
    expect(scan('사직역자이 엘리스트는 동래구 사직동 구역 지역에 있다')).toEqual([]);
  });
  it('운영 메모 누출', () => {
    expect(scan('농어촌특별세(이 글의 글감 선택 조건상 비적용)').map((d) => d.rule)).toEqual(['leak']);
  });
});
