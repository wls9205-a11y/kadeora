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
