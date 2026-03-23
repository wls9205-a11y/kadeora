import { describe, it, expect } from 'vitest';
import { generateEnglishSlug } from '@/lib/slug-utils';

describe('generateEnglishSlug', () => {
  it('converts Korean finance terms to English', () => {
    const slug = generateEnglishSlug('삼성전자 주식 분석');
    expect(slug).toContain('stock');
    expect(slug).toContain('analysis');
  });

  it('handles pure Korean titles with fallback', () => {
    const slug = generateEnglishSlug('오늘 점심 뭐 먹지', 'abc12345');
    expect(slug.length).toBeGreaterThan(0);
  });

  it('handles English-only titles', () => {
    const slug = generateEnglishSlug('Samsung Electronics Q4 Earnings');
    expect(slug).toBe('samsung-electronics-q4-earnings');
  });

  it('removes special characters', () => {
    const slug = generateEnglishSlug('코스피 3000 돌파!!! 🚀');
    expect(slug).not.toContain('!');
    expect(slug).not.toContain('🚀');
  });

  it('generates fallback for empty result', () => {
    const slug = generateEnglishSlug('');
    expect(slug).toMatch(/^post-\d+$/);
  });
});
