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
  overflow-wrap: break-word; word-break: break-word;
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
 * 지도 링크 깨짐 수정
 * - 카카오맵/네이버지도 링크의 인코딩된 한글 URL을 깔끔한 버튼으로 교체
 * - %EC%9A%B8 같은 깨진 텍스트 제거
 */
function fixMapLinks(html: string): string {
  // 카카오맵 링크를 깔끔한 버튼으로 교체
  let fixed = html.replace(
    /<p>👉\s*<a\s+href="(https:\/\/map\.kakao\.com\/[^"]*)"[^>]*>.*?카카오맵.*?<\/a><\/p>/gi,
    (_, url) => {
      const decoded = decodeURIComponent(url);
      return `<div style="display:flex;gap:8px;margin:8px 0"><a href="${decoded}" target="_blank" rel="noopener noreferrer" style="flex:1;text-align:center;padding:10px 0;border-radius:8px;background:var(--bg-hover);border:1px solid var(--border);color:var(--text-primary);text-decoration:none;font-size:var(--fs-sm);font-weight:600">🗺️ 카카오맵에서 보기</a>`;
    }
  );

  // 네이버지도 링크
  fixed = fixed.replace(
    /<p>👉\s*<a\s+href="(https:\/\/map\.naver\.com\/[^"]*)"[^>]*>.*?네이버.*?<\/a><\/p>/gi,
    (_, url) => {
      const decoded = decodeURIComponent(url);
      return `<a href="${decoded}" target="_blank" rel="noopener noreferrer" style="flex:1;text-align:center;padding:10px 0;border-radius:8px;background:var(--bg-hover);border:1px solid var(--border);color:var(--text-primary);text-decoration:none;font-size:var(--fs-sm);font-weight:600">🗺️ 네이버지도에서 보기</a></div>`;
    }
  );

  // 인라인 깨진 패턴 (👉 텍스트 안에 인코딩된 URL이 노출되는 경우)
  fixed = fixed.replace(
    /👉\s*(?:<a[^>]*>)?[^<]*(%[0-9A-F]{2}){3,}[^<]*(?:<\/a>)?/gi,
    ''
  );

  return fixed;
}

/**
 * 위치 확인 섹션 전체를 깔끔하게 교체
 */
function cleanLocationSection(html: string): string {
  // "위치 확인" h2/h3 + 다음 내용을 찾아서 깔끔하게 교체
  return html.replace(
    /<h[23][^>]*id="[^"]*"[^>]*>.*?위치\s*확인.*?<\/h[23]>\s*(?:<p>.*?지도.*?확인.*?<\/p>\s*)?/gi,
    '<h2 id="위치-확인" style="display:flex;align-items:center;gap:6px">📍 위치 확인</h2><p style="color:var(--text-tertiary);font-size:var(--fs-sm)">아래 버튼으로 지도에서 정확한 위치를 확인하세요.</p>'
  );
}

/**
 * 메인 함수: 블로그 HTML에 시각화 요소 추가
 */
export function enhanceBlogVisuals(html: string, options?: { excerpt?: string | null }): string {
  let enhanced = html;
  
  // 0. 지도 링크 깨짐 수정 (가장 먼저)
  enhanced = cleanLocationSection(enhanced);
  enhanced = fixMapLinks(enhanced);
  
  // 0.5 테이블을 스크롤 래퍼로 감싸기 (삐져나감 방지)
  enhanced = enhanced.replace(
    /<table/g,
    '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin:12px 0;border-radius:8px;border:1px solid var(--border)"><table style="min-width:400px"'
  );
  enhanced = enhanced.replace(/<\/table>/g, '</table></div>');
  
  // 1. 숫자 통계 하이라이트
  enhanced = highlightStats(enhanced);
  
  // 2. 핵심 포인트 강조 박스
  enhanced = enhanceKeyPoints(enhanced);
  
  // 3. 요약 카드 삽입
  enhanced = insertSummaryCard(enhanced, options?.excerpt);
  
  return enhanced;
}
