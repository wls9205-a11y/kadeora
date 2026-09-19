// BN 4차 판독 ⑥' — 단계 문형 주입 · 단계/조합 사실 결함(112539·112540)
import { describe, it, expect } from 'vitest';
import { stageSection, injectStageSection, MEMBER_PHRASE, stageName } from '@/lib/content/stage-phrase';
import { scanDraft2 } from '@/lib/content/draft-scan2';

describe('stageSection', () => {
  it('조합설립인가 + 시공사 있음 — 시공자 선정 단계를 건너뛰고 «선정됐다(보도 기준)»', () => {
    const t = stageSection({ stage: 'union_established', builder: '삼성물산', isRedev: true })!;
    expect(t).toContain('**조합설립인가** 단계');
    expect(t).toContain('삼성물산이(가) 선정되었습니다(보도 기준)');
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
    expect(stageSection({ stage: 'pre_announcement', isRedev: false })).toBeNull();
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
