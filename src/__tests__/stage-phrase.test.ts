// BN 4차 판독 ⑥' — 단계 문형 주입 · 단계/조합 사실 결함(112539·112540)
import { describe, it, expect } from 'vitest';
import { stageSection, injectStageSection, MEMBER_PHRASE, stageName } from '@/lib/content/stage-phrase';
import { scanDraft2 } from '@/lib/content/draft-scan2';

describe('stageSection', () => {
  it('조합설립인가 + 시공사 있음 — 시공자 선정 단계를 건너뛰고 «선정됐다(보도 기준)»', () => {
    const t = stageSection({ stage: 'union_established', builder: '삼성물산', isRedev: true })!;
    expect(t).toContain('**조합설립인가** 단계');
    expect(t).toContain('삼성물산이 선정되었습니다(보도 기준)');
    expect(t).toContain('남은 절차는 사업시행계획인가 → 관리처분계획인가');
    expect(t).not.toMatch(/\d/);
    expect(t).toContain(MEMBER_PHRASE);
  });
  it('관리처분 단계', () => {
    const t = stageSection({ stage: 'mgmt_approved', builder: '현대건설', isRedev: true })!;
    expect(t).toContain('**관리처분계획인가** 단계');
    expect(t).toContain('시공자는 현대건설입니다');
    expect(t).toContain('남은 절차는 이주·철거 → 착공');
  });
  it('정비사업 아님·단계 모름 → null', () => {
    expect(stageSection({ stage: 'post_move_in', isRedev: false })).toBeNull();
    expect(stageSection({ stage: 'weird', isRedev: true })).toBeNull();
    expect(stageName('plan_approved')).toBe('사업시행계획인가');
  });
});

describe('injectStageSection', () => {
  const sec = '확정 문형';
  it('기존 「사업 단계」 본문을 교체', () => {
    const out = injectStageSection('## 현장 개요\n가\n\n## 사업 단계\n조합이 아직 구성되지 않았다\n\n## 주변 거래 데이터\n나', sec);
    expect(out).toBe('## 현장 개요\n가\n\n## 사업 단계\n\n확정 문형\n\n## 주변 거래 데이터\n나');
  });
  it('섹션이 없으면 현장 개요 뒤에 삽입', () => {
    const out = injectStageSection('## 현장 개요\n가\n\n## 자주 묻는 질문\nQ.', sec);
    expect(out).toBe('## 현장 개요\n가\n\n## 사업 단계\n\n확정 문형\n\n## 자주 묻는 질문\nQ.');
  });
});

describe('scan2 fact', () => {
  const SITE = '- 지역: 부산 동래구\n- 시공사: 대우건설\n- 사업 단계(확정): 조합설립인가 — …';
  const scan = (c: string) => scanDraft2({ title: '', content: c, siteContext: SITE, constantsBlock: '' }).filter((d) => d.rule === 'fact');
  it('세입자 조합원 단정', () => { expect(scan('세입자도 조합원 자격을 얻는다')).toHaveLength(1); });
  it('세입자는 조합원이 아니다 — 통과', () => { expect(scan('세입자는 조합원이 아니다')).toHaveLength(0); });
  it('시공사가 있는데 「시공사 선정 전」', () => { expect(scan('현재 시공사 선정 전 단계')).toHaveLength(1); });
  it('조합설립인가인데 「조합이 아직 구성되지」', () => { expect(scan('조합이 아직 구성되지 않은 예비 단계')).toHaveLength(1); });
  it('확정 문형 자체는 통과', () => {
    expect(scan(MEMBER_PHRASE)).toHaveLength(0);
  });
});

describe('주입 문형은 스캔2 fact 를 스스로 어기지 않는다', () => {
  it('모든 단계 × 시공사 유무', () => {
    const names: Record<string, string> = { site_planning: '정비구역 지정·추진위원회 구성', union_established: '조합설립인가', constructor_selected: '시공자 선정', plan_approved: '사업시행계획인가', mgmt_approved: '관리처분계획인가', construction: '착공' };
    for (const [stage, nm] of Object.entries(names)) {
      for (const builder of ['대우건설', '']) {
        const t = stageSection({ stage, builder, isRedev: true })!;
        const site = `- 지역: 부산 동래구\n- 시공사: ${builder || '미정(단정하지 말 것)'}\n- 사업 단계(확정): ${nm} — …`;
        const d = scanDraft2({ title: '', content: `## 사업 단계\n\n${t}`, siteContext: site, constantsBlock: '', compact: true });
        expect(d, `${stage}/${builder}`).toEqual([]);
      }
    }
  });
  it('112539·112540 실측 문장은 fact', () => {
    const site = '- 지역: 부산 부산진구\n- 시공사: 현대건설\n- 사업 단계(확정): 사업시행계획인가 — …';
    const s = (c: string) => scanDraft2({ title: '', content: c, siteContext: site, constantsBlock: '' }).filter((x) => x.rule === 'fact').length;
    expect(s('재개발 사업은 구역 내 기존 주택 소유자와 세입자로 구성된 조합 구조입니다.')).toBe(1);
    expect(s('시공사 제안이 이루어졌으나, 아직 조합이 공식으로 구성되지 않은 상태입니다.')).toBe(1);
    expect(s('사업은 조합 구성 → 조합원 모집 → 관리처분 → 인허가 → 분양의 단계를 거쳐야 합니다.')).toBe(1);
    expect(s('힐스테이트 르네센트는 현재 초기 개발 단계에 있습니다.')).toBe(1);
  });
});

// BN-B4 — 거래 데이터 문형 · 절제기
import { dataSection, injectDataSection } from '@/lib/content/stage-phrase';
import { exciseCompact } from '@/lib/content/draft-scan2';

describe('dataSection', () => {
  const SITE = '- 지역: 부산 동래구\n- 같은 시군구 아파트 실거래(2026-04~2026-09, 1000건+): 중위 4억 8,800만원 — 단지를 특정하지 않은 시군구 전체 집계. 인용할 때 …';
  it('블록 값을 수식어 없이', () => {
    expect(dataSection(SITE)).toBe('부산 동래구 아파트 실거래(2026-04~2026-09, 1,000건 이상 집계)의 중위 거래가는 4억 8,800만원입니다. 단지를 특정하지 않은 시군구 전체 집계이므로 개별 단지의 가격과는 다를 수 있습니다.');
  });
  it('실거래 줄 없음 → 수치 없는 한 문장', () => {
    expect(dataSection('- 지역: 부산 동래구')).toMatch(/집계가 충분하지 않아/);
  });
  it('주입 — 기존 섹션 교체', () => {
    expect(injectDataSection('## 사업 단계\n가\n\n## 주변 거래 데이터\n중위 거래액은 상당 수준입니다.\n\n## 자주 묻는 질문\nQ.', 'X'))
      .toBe('## 사업 단계\n가\n\n## 주변 거래 데이터\n\nX\n\n## 자주 묻는 질문\nQ.');
  });
});

describe('exciseCompact', () => {
  const T = '자이 더 센터니티 — 부곡2구역 재개발 현재 상황·일정 총정리';
  it('메타 표 · 목차 밖 H2 · FAQ 7+ 절제, 관련 정보 이후 보존', () => {
    const faq = Array.from({ length: 8 }, (_, i) => `**Q${i + 1}. 질문?**\nA. 답.`).join('\n\n');
    const c = `## 현장 개요\n\n| 항목 | 내용 |\n|---|---|\n| 대상 | 부곡2 |\n| 카테고리 | 부동산 |\n| 분석 시점 | 2026-09-19 |\n\n본문\n\n## 투자 판단 시 주의사항\n일반론\n\n## 자주 묻는 질문\n\n${faq}\n\n## 관련 정보\n\n- [x](/apt)`;
    const r = exciseCompact(c, T);
    expect(r.removed).toEqual(['meta_table', '## 투자 판단 시 주의사항', 'faq_2_trimmed']);
    expect(r.content).not.toContain('분석 시점');
    expect(r.content).not.toContain('투자 판단');
    expect(r.content).toContain('Q6.');
    expect(r.content).not.toContain('Q7.');
    expect(r.content).toContain('## 관련 정보');
  });
});

describe('scan2 — 데이터 없는 데이터 섹션', () => {
  it('숫자 0 → section', () => {
    const d = scanDraft2({ title: '', content: '## 주변 거래 데이터\n중위 거래액은 상당 수준입니다.\n\n## 자주 묻는 질문', siteContext: '', constantsBlock: '', compact: true });
    expect(d.map((x) => x.text)).toContain('## 주변 거래 데이터(수치 없음)');
  });
});

describe('scan2 — 수치 없는 시세 문장(5회차 112564·112566)', () => {
  const site = '- 지역: 부산 동래구\n- 시공사: 대우건설\n- 사업 단계(확정): 시공자 선정 — …';
  const f = (c: string) => scanDraft2({ title: '', content: c, siteContext: site, constantsBlock: '' }).filter((x) => x.rule === 'fact').length;
  it('공허 시세 문장은 fact', () => {
    expect(f('A. 부산 동래구 아파트의 중위 거래가는 다양한 수준입니다(2026년 4월~9월 기준).')).toBe(1);
    expect(f('A. 부산진구 아파트의 거래 시세는 개별 단지와 면적에 따라 달라집니다(2026년 6월~9월 기준). 정확한 정보는 부동산 시장 자료를 참고하시기 바랍니다.')).toBe(1);
  });
  it('주입 거래 문형·수치 있는 문장은 통과', () => {
    expect(f(dataSection('- 지역: 부산 동래구\n- 같은 시군구 아파트 실거래(2026-04~2026-09, 1000건+): 중위 4억 8,800만원 — …'))).toBe(0);
    expect(f('동래구 아파트의 최근(2026년 4월~9월) 중위 거래가는 4억 8,800만원으로 시장 기준점입니다.')).toBe(0);
  });
});

describe('scan2 — 수치 없는 시세: 단서 문장 오탐(112560)', () => {
  it('같은 단락에 금액이 있으면 통과', () => {
    const site = '- 지역: 부산 동래구\n- 시공사: 현대건설\n- 사업 단계(확정): 조합설립인가 — …';
    const c = 'A. 부산 동래구 아파트의 최근 6개월(2026년 4월~9월) 중위 거래가는 4억 8,800만원입니다. 지역의 개별 단지와 입지에 따라 거래가는 달라질 수 있습니다.';
    expect(scanDraft2({ title: '', content: c, siteContext: site, constantsBlock: '' }).filter((x) => x.rule === 'fact')).toHaveLength(0);
  });
});

// BN 6차 판독 — 링크 치환 · redev 2단계 경로 · 조사
import { repairLinks, extractInternalLinks } from '@/lib/content/draft-scan2';
import { josaIGa } from '@/lib/content/stage-phrase';

describe('BN 6차 — 링크', () => {
  it('/apt/redev/<숫자> 는 비실존, /apt/redev/<시·도> 는 실존', () => {
    expect(extractInternalLinks('[감천2구역 재개발](/apt/redev/2093) [부산 정비](/apt/redev/부산)').badRoutes).toEqual(['/apt/redev/2093']);
  });
  it('비실존 /apt 는 글감 현장으로, 비실존 /blog 는 링크만 풀기', () => {
    const r = repairLinks('도입 [감천2구역 재개발](/apt/redev/2093) · [기초](/blog/redev-basic)', ['/apt/redev/2093', '/blog/redev-basic'], '감천2-재개발');
    expect(r.content).toBe('도입 [감천2구역 재개발](/apt/감천2-재개발) · 기초');
    expect(r.repaired).toEqual(['/apt/redev/2093', '/blog/redev-basic']);
  });
});

describe('josaIGa', () => {
  it('받침 → 이, 없음·영문 → 가', () => {
    expect(josaIGa('삼성물산')).toBe('이');
    expect(josaIGa('현대건설')).toBe('이');
    expect(josaIGa('DL이앤씨')).toBe('가');
    expect(josaIGa('GS')).toBe('가');
  });
});

describe('7차 판독 — 절차 나열 속 「조합 구성」', () => {
  it('사업시행계획인가 이후 「이후 조합 구성, …」 은 fact', () => {
    const site = '- 지역: 부산 부산진구\n- 시공사: 현대건설\n- 사업 단계(확정): 사업시행계획인가 — …';
    const d = scanDraft2({ title: '', content: 'A. 현재 사업시행계획인가 단계입니다. 이후 조합 구성, 관계인 동의, 모집공고 순으로 진행될 예정입니다.', siteContext: site, constantsBlock: '' });
    expect(d.filter((x) => x.rule === 'fact')).toHaveLength(1);
  });
});

describe('FW — 일반 분양·입주 현장 단계 문형', () => {
  it('청약·공사 단계는 숫자 없는 확정 문형', () => {
    const t = stageSection({ stage: 'pre_announcement', isRedev: false })!;
    expect(t).toContain('입주자모집공고 전 단계');
    expect(stageSection({ stage: 'construction', isRedev: false })).toContain('월 단위');
    for (const k of ['pre_announcement', 'subscription_open', 'award_pending', 'construction', 'move_in_started'])
      expect(stageSection({ stage: k, isRedev: false })).not.toMatch(/\d/);
  });
});

import { MEMBER_PHRASE_RECON, isReconstruction } from '@/lib/content/stage-phrase';
describe('재건축 조합원 문형 — 도시정비법 제2조 제9호 나목·제39조', () => {
  it('재건축 현장은 동의자 문형, 재개발은 토지등소유자 문형', () => {
    expect(isReconstruction('반여4 재건축', '반여4-재건축')).toBe(true);
    expect(isReconstruction('광안5구역', '광안5-재개발')).toBe(false);
    const r = stageSection({ stage: 'union_established', isRedev: true, recon: true })!;
    expect(r).toContain(MEMBER_PHRASE_RECON);
    expect(r).not.toContain('토지 또는 건축물');
    expect(stageSection({ stage: 'union_established', isRedev: true })).toContain('토지 또는 건축물');
  });
});
