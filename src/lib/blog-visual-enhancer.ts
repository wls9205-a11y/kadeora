/**
 * 블로그 본문 시각화 강화
 * 마크다운 → HTML 변환 후 적용하여 시각적 요소를 자동 삽입
 * 
 * 1. 숫자 통계를 하이라이트 카드로 변환
 * 2. 핵심 포인트(✅, ⚡, 💡 등) 강조 박스
 * 3. 첫 번째 h2 앞에 요약 카드 삽입
 * 4. 비교 문장을 비주얼 비교 블록으로 변환
 */

const STAT_CARD_STYLE = `
  display: inline-flex; align-items: baseline; gap: 4px;
  padding: 4px 12px; border-radius: 8px;
  background: var(--brand-bg); border: 1px solid var(--brand-border);
  font-weight: 700; color: var(--brand);
`.replace(/\n/g, '').trim();

const HIGHLIGHT_BOX_STYLE = `
  padding: 14px 16px; border-radius: 10px; margin: 16px 0;
  border-left: 4px solid var(--brand);
  background: var(--bg-surface); border-top: 1px solid var(--border);
  border-right: 1px solid var(--border); border-bottom: 1px solid var(--border);
`.replace(/\n/g, '').trim();

/**
 * 숫자 통계 하이라이트
 * "약 3.2조원" → 하이라이트 스팬
 * "전년 대비 15.3% 증가" → 증감 표시
 */
function highlightStats(html: string): string {
  // 큰 숫자 (억, 조, 만, %) 패턴
  return html.replace(
    /([약]?\s*)([\d,.]+)\s*(조원?|억원?|만원?|만\s*세대|만\s*호|%|퍼센트)/g,
    (match, prefix, num, unit) => {
      const isPercent = unit.includes('%') || unit.includes('퍼센트');
      return `${prefix}<span style="${STAT_CARD_STYLE}">${num}${unit}</span>`;
    }
  );
}

/**
 * 핵심 포인트 강조 박스
 * ✅, ⚡, 💡, ⚠️, 📌 로 시작하는 문단을 강조 박스로 변환
 */
function enhanceKeyPoints(html: string): string {
  const icons = ['✅', '⚡', '💡', '⚠️', '📌', '🔑', '💰', '📊', '🎯', '🏆'];
  const iconPattern = icons.map(i => i.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  
  return html.replace(
    new RegExp(`<p>((?:${iconPattern})\\s*.+?)<\\/p>`, 'g'),
    (_, content) => `<div style="${HIGHLIGHT_BOX_STYLE}">${content}</div>`
  );
}

/**
 * 요약 카드: 첫 번째 h2 앞에 글 요약 삽입
 * excerpt가 있으면 사용
 */
function insertSummaryCard(html: string, excerpt?: string | null): string {
  if (!excerpt || excerpt.length < 20) return html;
  
  const summaryCard = `
<div style="padding: 16px 18px; border-radius: 12px; margin: 16px 0 24px; background: linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%); border: 1px solid var(--border);">
  <div style="font-size: var(--fs-xs); font-weight: 700; color: var(--brand); margin-bottom: 6px; letter-spacing: 0.5px;">📋 핵심 요약</div>
  <div style="font-size: var(--fs-sm); color: var(--text-secondary); line-height: 1.7;">${excerpt}</div>
</div>`.trim();

  // 첫 번째 h2 앞에 삽입
  const h2Index = html.indexOf('<h2');
  if (h2Index > 0) {
    return html.slice(0, h2Index) + summaryCard + html.slice(h2Index);
  }
  // h2 없으면 첫 번째 p 뒤에
  const firstPEnd = html.indexOf('</p>');
  if (firstPEnd > 0) {
    return html.slice(0, firstPEnd + 4) + summaryCard + html.slice(firstPEnd + 4);
  }
  return summaryCard + html;
}

/**
 * 메인 함수: 블로그 HTML에 시각화 요소 추가
 */
export function enhanceBlogVisuals(html: string, options?: { excerpt?: string | null }): string {
  let enhanced = html;
  
  // 1. 숫자 통계 하이라이트
  enhanced = highlightStats(enhanced);
  
  // 2. 핵심 포인트 강조 박스
  enhanced = enhanceKeyPoints(enhanced);
  
  // 3. 요약 카드 삽입
  enhanced = insertSummaryCard(enhanced, options?.excerpt);
  
  return enhanced;
}
