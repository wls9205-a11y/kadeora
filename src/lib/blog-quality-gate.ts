/**
 * 블로그 품질 게이트 v1.0
 * 70점 미만 → 발행 차단
 * "데이터가 없으면 발행하지 않는다" 원칙 강제
 */

export interface QualityResult {
  pass: boolean;
  score: number;
  issues: string[];
  tier: 'S' | 'A' | 'B' | 'C' | 'F';
}

const BOILERPLATES = [
  '부동산 시장 회복과 함께 실수요자와 투자자 관심이 높아지고',
  '아파트 투자의 핵심은 입지(교통·학군·편의시설)',
  '학군은 부동산 가치에 중요한 영향을 미치는 요소',
  '2026년 부동산 시장의 회복세와 함께',
  '실수요자와 투자자 모두의 관심이 집중되고 있습니다',
  '충분한 시장 조사 후 결정하시기 바랍니다',
];

export function checkBlogQuality(content: string, category: string): QualityResult {
  const issues: string[] = [];
  let score = 100;

  // 순수 텍스트 추출
  const text = content.replace(/<[^>]+>/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_~`>|]/g, '').replace(/\s+/g, ' ').trim();

  // 1. 길이 (30점)
  if (text.length < 2000) { issues.push(`텍스트 ${text.length}자 (최소 2,000자)`); score -= 30; }
  else if (text.length < 3000) { issues.push(`텍스트 ${text.length}자 (권장 3,000자+)`); score -= 15; }
  else if (text.length < 5000) { score -= 5; }

  // 2. 인라인 HTML 하드코딩 (20점)
  if (/style="[^"]*background\s*:\s*#|style="[^"]*color\s*:\s*#[0-9a-f]/i.test(content)) {
    issues.push('인라인 HTML 하드코딩 색상'); score -= 20;
  }

  // 3. 영어 raw값 (15점)
  if (/>(trade|subscription|active|closed)</i.test(content)) {
    issues.push('영어 raw값 노출'); score -= 15;
  }

  // 4. 보일러플레이트 (15점)
  const bpCount = BOILERPLATES.filter(bp => content.includes(bp)).length;
  if (bpCount >= 3) { issues.push(`보일러플레이트 ${bpCount}개 감지`); score -= 15; }
  else if (bpCount >= 1) { issues.push(`보일러플레이트 ${bpCount}개`); score -= 7; }

  // 5. 실데이터 존재 (10점)
  if (category === 'apt' || category === 'unsold') {
    const hasUnits = /\d+\s*세대/.test(text);
    const hasPrice = /\d+\s*만원/.test(text) || /\d+\s*억/.test(text);
    if (!hasUnits && !hasPrice) { issues.push('부동산 실데이터 없음 (세대수/가격)'); score -= 10; }
  }
  if (category === 'stock') {
    const hasPrice = /\d+원|\d+달러|\$\d+/.test(text);
    const hasPct = /[+-]?\d+\.?\d*%/.test(text);
    if (!hasPrice && !hasPct) { issues.push('주식 실데이터 없음 (가격/등락률)'); score -= 10; }
  }

  // 6. 내부 링크 (5점)
  const internalLinks = (content.match(/\]\(\//g) || []).length;
  if (internalLinks < 3) { issues.push(`내부 링크 ${internalLinks}개 (최소 3개)`); score -= 5; }

  // 7. 마크다운 표 (5점)
  if (!/\|[\s-]+\|/.test(content)) { issues.push('표(table) 없음'); score -= 5; }

  // 8. 목차 템플릿 잔존 (5점)
  if (content.includes('## 목차')) { issues.push('"## 목차" 잔존'); score -= 5; }

  // 9. placeholder 잔존 (5점)
  if (/확인 필요|N\/A|미정<\/span>|확인중/.test(content)) {
    issues.push('placeholder 데이터 잔존'); score -= 5;
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    pass: finalScore >= 70,
    score: finalScore,
    issues,
    tier: finalScore >= 90 ? 'S' : finalScore >= 80 ? 'A' : finalScore >= 70 ? 'B' : finalScore >= 50 ? 'C' : 'F',
  };
}

/**
 * 콘텐츠에서 인라인 HTML을 제거하고 순수 마크다운으로 변환
 */
export function stripInlineHtml(content: string): string {
  let c = content;
  // <div style="...">내용</div> → 내용
  c = c.replace(/<div[^>]*style="[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1');
  // <span style="...">텍스트</span> → 텍스트
  c = c.replace(/<span[^>]*style="[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  // <strong style="...">텍스트</strong> → **텍스트**
  c = c.replace(/<strong[^>]*style="[^"]*"[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  // <h3 style="...">텍스트</h3> → ### 텍스트
  c = c.replace(/<h3[^>]*style="[^"]*"[^>]*>([\s\S]*?)<\/h3>/gi, '### $1');
  c = c.replace(/<h4[^>]*style="[^"]*"[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1');
  // <a href="..." style="...">텍스트</a> → [텍스트](href)
  c = c.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  // <table style="..."> → <table>
  c = c.replace(/<table[^>]*style="[^"]*"[^>]*>/gi, '<table>');
  c = c.replace(/<t[hd][^>]*style="[^"]*"[^>]*>/gi, (m) => m.replace(/\s*style="[^"]*"/g, ''));
  // <br> → \n
  c = c.replace(/<br\s*\/?>/gi, '\n');
  // • 리스트 아이템
  c = c.replace(/•\s*/g, '- ');
  // 잔여 빈 div/span 정리
  c = c.replace(/<\/?(?:div|span)>/gi, '');
  return c.trim();
}
