// BN §3-A — 관련 정보 푸터는 넘겨받은 현장만 싣는다. 모르면 랜딩만(현장 링크 0).
import { describe, it, expect } from 'vitest';
import { buildRelatedFooter } from '@/lib/internal-link-injector';
import { extractAptSiteSlugs } from '@/lib/blog-safe-insert';

describe('buildRelatedFooter', () => {
  it('현장이 없으면 어떤 카테고리도 /apt/<슬러그> 를 만들지 않는다', () => {
    for (const cat of ['stock', 'finance', 'general', 'apt', undefined, 'unknown']) {
      const f = buildRelatedFooter(cat, []);
      expect(f).toContain('## 관련 정보');
      expect(extractAptSiteSlugs(f)).toEqual([]);
      expect(f).not.toContain('/apt/redev/');
    }
  });

  it('넘긴 현장만, 넘긴 순서대로, 최대 3개', () => {
    const f = buildRelatedFooter('apt', [
      { slug: '사직2-재개발', label: '래미안 사직 엘라티오' },
      { slug: '사직3-재개발', label: '사직3 재개발' },
      { slug: '사직4-재개발', label: '사직4 재개발' },
      { slug: '사직5-재개발', label: '사직5 재개발' },
    ]);
    expect(extractAptSiteSlugs(f)).toEqual(['사직2-재개발', '사직3-재개발', '사직4-재개발']);
    expect(f).toContain('- [래미안 사직 엘라티오 →](/apt/사직2-재개발)');
  });
});

// BN §3-A 후속 — 인라인 링크 주입의 부분일치 오귀속(112516 「힐스테이트」 → 경기 이천).
import { isBrandOnlyName, boundedIndexOf, replaceFirstOccurrence } from '@/lib/internal-link-injector';

describe('internal link injector 경계', () => {
  const brands = new Set(['힐스테이트', '아이파크', 'e편한세상']);
  it('브랜드 단독 이름은 제외', () => {
    expect(isBrandOnlyName('힐스테이트', brands)).toBe(true);
    expect(isBrandOnlyName('힐스테이트 오션스카이', brands)).toBe(false);
  });
  it('앞쪽 경계 — 더 긴 낱말의 꼬리는 링크하지 않는다', () => {
    expect(boundedIndexOf('해운대센텀 분석', '센텀')).toBe(-1);
    expect(boundedIndexOf('해운대 센텀 분석', '센텀')).toBe(4);
  });
  it('뒤쪽 조사는 허용', () => {
    const r = replaceFirstOccurrence('잠실엘스는 대단지다', '잠실엘스', '/apt/잠실엘스-송파구');
    expect(r.out).toBe('[잠실엘스](/apt/잠실엘스-송파구)는 대단지다');
  });
});

import { appendRelatedHubFooter } from '@/lib/internal-link-injector';

describe('appendRelatedHubFooter — 기존 관련 정보 섹션', () => {
  const sb = (row: any) => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }) }) }) });
  const site = { slug: '수영1-재개발', name: '수영1 재개발', display_name: null };
  it('섹션이 있어도 글감 현장 링크가 없으면 머리 아래에 한 줄', async () => {
    const out = await appendRelatedHubFooter(sb(site), '본문\n\n## 관련 정보\n\n- [청약 일정](/apt)\n', { category: 'apt', siteSlug: '수영1-재개발' });
    expect(out).toContain('## 관련 정보\n\n- [수영1 재개발 →](/apt/수영1-재개발)\n\n- [청약 일정](/apt)');
    expect(extractAptSiteSlugs(out)).toEqual(['수영1-재개발']);
  });
  it('이미 링크가 있으면 그대로', async () => {
    const c = '[수영1](/apt/수영1-재개발)\n\n## 관련 정보\n\n- [청약 일정](/apt)\n';
    expect(await appendRelatedHubFooter(sb(site), c, { category: 'apt', siteSlug: '수영1-재개발' })).toBe(c);
  });
});
