/** EX-A2 ③ — 출처 기사 본문 추출(판정만). */
import { describe, expect, it } from 'vitest';
import { extractArticleText } from '@/lib/content/article-text';

describe('extractArticleText', () => {
  it('article 안 본문만 · 스크립트·메뉴 제거 · 짧은/비한글 줄 제거', () => {
    const html = `<html><nav>홈 뉴스 경제</nav><script>var a=1;</script>
      <article><h1>부산 신규 분양 3,000세대 공급 예정</h1><p>부산시는 올해 하반기 신규 분양 물량이 3,000세대에 이를 것이라고 밝혔다.</p>
      <div>광고</div><p>평균 분양가는 3.3㎡당 2,100만원 수준으로 전년보다 5% 올랐다고 설명했다.</p></article><footer>저작권</footer></html>`;
    const t = extractArticleText(html);
    expect(t).toContain('3,000세대에 이를 것');
    expect(t).toContain('2,100만원');
    expect(t).not.toContain('var a');
    expect(t).not.toContain('광고');
  });
  it('상한 길이', () => {
    const html = `<article><p>${'가'.repeat(9000)}</p></article>`;
    expect(extractArticleText(html, 6000).length).toBe(6000);
  });
});
