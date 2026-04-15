/**
 * 블로그 본문 시각화 강화 v3
 * v2 문제: 하드코딩 hex 색상 → 다크/라이트 모드 컬러 부조화
 * v3 수정: CSS 변수(var(--accent-*)) 사용으로 테마 자동 적응
 */

interface EnhanceOptions {
  excerpt?: string | null;
  coverImage?: string | null;
  imageAlt?: string | null;
  title?: string | null;
  category?: string | null;
  tags?: string[] | null;
}

// ── 색상 팔레트 → CSS 변수 기반 ──
// inline style에서 var() 사용 — 다크/라이트 모드 자동 적응
const C = {
  blue:   'var(--accent-blue)',
  green:  'var(--accent-green)',
  purple: 'var(--accent-purple)',
  orange: 'var(--accent-orange)',
  red:    'var(--accent-red)',
  brand:  'var(--brand)',
} as const;

const UNIT_COLORS: Record<string, string> = {
  '만원': C.blue, '억원': C.purple, '억': C.purple, '조원': C.red, '조': C.red,
  '만세대': C.green, '만호': C.green, '퍼센트': C.orange,
};
function colorFor(unit: string): string { return UNIT_COLORS[unit.replace(/\s/g, '')] || C.blue; }

// ── HTML attribute escape ──
function escapeAttr(s: string): string { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ── 1. OG 커버 이미지 히어로 ──
function insertCoverImage(html: string, opts: EnhanceOptions): string {
  let imgUrl = '';
  if (opts.coverImage && opts.coverImage.trim() && !opts.coverImage.includes('default-cover') && !opts.coverImage.includes('generic')) {
    imgUrl = opts.coverImage;
  } else if (opts.title) {
    const cat = opts.category || 'blog';
    imgUrl = '/api/og?title=' + encodeURIComponent(opts.title.slice(0, 60)) + '&design=2&category=' + cat;
  }
  if (!imgUrl) return html;

  const alt = escapeAttr(opts.imageAlt || opts.title || '카더라 블로그');
  const hero = `<div style="margin:0 0 20px;border-radius:12px;overflow:hidden;border:1px solid var(--border)"><img src="${imgUrl}" alt="${alt}" loading="eager" fetchpriority="high" decoding="async" style="width:100%;height:auto;display:block;aspect-ratio:1200/630;object-fit:cover" onerror="this.parentElement.style.display='none'" width="1200" height="630" /></div>`;
  return hero + html;
}

// ── 2. 히어로 통계 카드 (알록달록) ──
function insertHeroStats(html: string): string {
  const tableMatch = html.match(/<div[^>]*><table[^>]*>([\s\S]*?)<\/table><\/div>/i);
  if (!tableMatch) return html;
  const rows = tableMatch[1].match(/<tr>([\s\S]*?)<\/tr>/gi);
  if (!rows || rows.length < 3) return html;

  const stats: { label: string; value: string; color: string }[] = [];
  const labels: Record<string, string> = {
    '평균': C.blue, '최고': C.green, '최저': C.red,
    '평당': C.purple, '건수': C.orange, '면적': C.blue, '세대': C.green, '거래': C.orange,
  };

  for (const row of rows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cells || cells.length < 2) continue;
    const label = cells[0].replace(/<[^>]+>/g, '').trim();
    const value = cells[1].replace(/<[^>]+>/g, '').trim();
    if (!value || value.length > 30 || !value.match(/[\d,.]+/)) continue;
    for (const [key, color] of Object.entries(labels)) {
      if (label.includes(key) && stats.length < 4) {
        stats.push({ label: label.replace(/\*\*/g, ''), value, color });
        break;
      }
    }
  }
  if (stats.length < 2) return html;

  const cards = stats.map(s =>
    `<div style="background:var(--bg-surface);border-radius:10px;padding:12px 10px;border-left:4px solid ${s.color};border-top:1px solid var(--border);border-right:1px solid var(--border);border-bottom:1px solid var(--border)"><div style="font-size:11px;color:var(--text-tertiary)">${s.label}</div><div style="font-size:18px;font-weight:700;color:${s.color};margin-top:2px">${s.value}</div></div>`
  ).join('');
  const grid = `<div style="display:grid;grid-template-columns:repeat(${Math.min(stats.length, 4)},1fr);gap:6px;margin:16px 0">${cards}</div>`;
  const h2Idx = html.indexOf('<h2');
  return h2Idx > 0 ? html.slice(0, h2Idx) + grid + html.slice(h2Idx) : grid + html;
}

// ── 3. 카테고리 컬러 태그 바 (제거됨 — 사용하지 않음) ──

// ── 4. 가격 레인지 바 ──
function insertPriceRange(html: string): string {
  const text = html.replace(/<[^>]+>/g, ' ');
  const avgM = text.match(/평균[^0-9]*([\d,.]+)\s*만원/);
  const minM = text.match(/최저[^0-9]*([\d,.]+)\s*만원/);
  const maxM = text.match(/최고[^0-9]*([\d,.]+)\s*만원/);
  if (!avgM || !minM || !maxM) return html;
  const avg = parseFloat(avgM[1].replace(/,/g, ''));
  const min = parseFloat(minM[1].replace(/,/g, ''));
  const max = parseFloat(maxM[1].replace(/,/g, ''));
  if (max <= min || (avg === 0 && min === 0 && max === 0)) return html;

  const pct = Math.round(((avg - min) / (max - min)) * 100);
  const fmt = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}억` : `${v.toLocaleString()}만`;

  const bar = `<div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin:16px 0"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px"><span style="color:var(--accent-red);font-weight:600">최저 ${fmt(min)}</span><span style="color:var(--accent-blue);font-weight:600">평균 ${fmt(avg)}</span><span style="color:var(--accent-green);font-weight:600">최고 ${fmt(max)}</span></div><div style="height:24px;border-radius:8px;background:var(--bg-hover);position:relative;overflow:hidden"><div style="position:absolute;left:0;width:${pct}%;height:100%;background:var(--brand);border-radius:8px;opacity:0.25"></div><div style="position:absolute;left:${pct}%;top:50%;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:var(--bg-surface);border:3px solid var(--brand);z-index:1"></div></div></div>`;

  // 두 번째 table 뒤에 삽입
  let cnt = 0;
  return html.replace(/<\/div>(?=\s*<div style="margin:24px)/g, (m) => { cnt++; return cnt === 1 ? m + bar : m; });
}

// ── 5. 체크포인트 아이콘 카드 ──
function enhanceCheckpoints(html: string): string {
  const iconMap: Record<string, { emoji: string; color: string }> = {
    '교통': { emoji: '🚇', color: C.blue }, '학군': { emoji: '🏫', color: C.green },
    '개발': { emoji: '🏗️', color: C.orange }, '호재': { emoji: '🏗️', color: C.orange },
    '전세': { emoji: '🏠', color: C.purple }, '인프라': { emoji: '🏥', color: C.blue },
    '리모델링': { emoji: '🔨', color: C.red }, '재건축': { emoji: '🏢', color: C.orange },
  };
  return html.replace(/<li>\s*<strong>([^<]+)<\/strong>\s*[:：]\s*([^<]+)<\/li>/g, (match, title, desc) => {
    for (const [key, cfg] of Object.entries(iconMap)) {
      if (title.includes(key)) {
        return `<li style="list-style:none;margin:6px 0"><div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-surface);border-radius:8px;border-left:4px solid ${cfg.color};border-top:1px solid var(--border);border-right:1px solid var(--border);border-bottom:1px solid var(--border)"><span style="font-size:16px;flex-shrink:0">${cfg.emoji}</span><div><div style="font-size:13px;font-weight:600;color:var(--text-primary)">${title.replace(/\*\*/g, '')}</div><div style="font-size:12px;color:var(--text-secondary)">${desc.trim()}</div></div></div></li>`;
      }
    }
    return match;
  });
}

// ── 6. 그라데이션 구분선 ──
function enhanceDividers(html: string): string {
  return html.replace(/<hr\s*\/?>/gi,
    '<div style="margin:28px 0;height:1px;background:var(--border)"></div>'
  );
}

// ── 7. 인용 블록 스타일링 ──
function enhanceBlockquotes(html: string): string {
  return html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (_, content) =>
    `<div style="margin:16px 0;padding:14px 16px;border-left:4px solid var(--accent-purple);background:var(--accent-purple-bg);border-radius:0 8px 8px 0"><div style="font-size:14px;color:var(--text-secondary);line-height:1.7;font-style:italic">${content}</div></div>`
  );
}

// ── 8. 숫자 컬러 뱃지 (단위별 색상) ──
function highlightStats(html: string): string {
  return html.replace(
    /(<[^>]+>)|([약]?\s*)([\d,.]+)\s*(조원?|억원?|만원?|만\s*세대|만\s*호|퍼센트)/g,
    (match, tag, prefix, num, unit) => {
      if (tag) return tag;
      if (!num || !unit) return match;
      const c = colorFor(unit);
      return `${prefix || ''}<span style="display:inline-flex;padding:2px 10px;border-radius:6px;background:var(--bg-hover);border:1px solid var(--border);font-weight:700;color:${c};font-size:inherit">${num}${unit}</span>`;
    }
  );
}

// ── 핵심 포인트 강조 박스 ──
function enhanceKeyPoints(html: string): string {
  const icons = ['✅', '⚡', '💡', '⚠️', '📌', '🔑', '💰', '📊', '🎯', '🏆'];
  const iconPattern = icons.map(i => i.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return html.replace(
    new RegExp(`<p>((?:${iconPattern})\\s*.+?)<\\/p>`, 'g'),
    (_, content) => `<div style="padding:14px 16px;border-radius:0 8px 8px 0;margin:16px 0;border-left:4px solid var(--brand);background:var(--bg-surface);border-top:1px solid var(--border);border-right:1px solid var(--border);border-bottom:1px solid var(--border);overflow-wrap:break-word">${content}</div>`
  );
}

// ── 요약 카드 ──
function insertSummaryCard(html: string, excerpt?: string | null): string {
  if (!excerpt || excerpt.length < 20) return html;
  const card = `<div style="padding:16px 18px;border-radius:12px;margin:16px 0 24px;background:linear-gradient(135deg,var(--bg-surface) 0%,var(--bg-elevated) 100%);border:1px solid var(--border)"><div style="font-size:11px;font-weight:700;color:var(--brand);margin-bottom:6px;letter-spacing:0.5px">📋 핵심 요약</div><div style="font-size:var(--fs-sm);color:var(--text-secondary);line-height:1.7">${excerpt}</div></div>`;
  const h2Idx = html.indexOf('<h2');
  if (h2Idx > 0) return html.slice(0, h2Idx) + card + html.slice(h2Idx);
  const pEnd = html.indexOf('</p>');
  return pEnd > 0 ? html.slice(0, pEnd + 4) + card + html.slice(pEnd + 4) : card + html;
}

// ── 지도 링크 수정 ──
function fixMapLinks(html: string): string {
  const kakaoRx = /<p>\s*👉\s*<a\s+href="([^"]*map\.kakao[^"]*)"[^>]*>[\s\S]*?<\/a>\s*<\/p>/gi;
  const naverRx = /<p>\s*👉\s*<a\s+href="([^"]*map\.naver[^"]*)"[^>]*>[\s\S]*?<\/a>\s*<\/p>/gi;
  let kakaoUrl = '', naverUrl = '';
  const km = kakaoRx.exec(html); if (km) kakaoUrl = decodeURIComponent(km[1]);
  const nm = naverRx.exec(html); if (nm) naverUrl = decodeURIComponent(nm[1]);
  let fixed = html.replace(/<p>\s*👉\s*<a\s+href="[^"]*map\.(kakao|naver)[^"]*"[^>]*>[\s\S]*?<\/a>\s*<\/p>/gi, '');
  if (kakaoUrl || naverUrl) {
    const bs = 'flex:1;text-align:center;padding:12px 0;border-radius:8px;background:var(--bg-hover);border:1px solid var(--border);color:var(--text-primary);text-decoration:none;font-size:var(--fs-sm);font-weight:600';
    let btns = '<div style="display:flex;gap:8px;margin:12px 0">';
    if (kakaoUrl) btns += `<a href="${kakaoUrl}" target="_blank" rel="noopener noreferrer" style="${bs}">🗺️ 카카오맵</a>`;
    if (naverUrl) btns += `<a href="${naverUrl}" target="_blank" rel="noopener noreferrer" style="${bs}">🗺️ 네이버지도</a>`;
    btns += '</div>';
    const loc = fixed.indexOf('위치 확인</h2>');
    if (loc > 0) { const ins = fixed.indexOf('</p>', loc); if (ins > 0) fixed = fixed.slice(0, ins + 4) + btns + fixed.slice(ins + 4); }
  }
  fixed = fixed.replace(/<p>\s*👉[^<]*(%[0-9A-Fa-f]{2}){3,}[\s\S]*?<\/p>/gi, '');
  return fixed;
}

function cleanLocationSection(html: string): string {
  return html.replace(
    /<h[23][^>]*>[\s\S]*?위치\s*확인[\s\S]*?<\/h[23]>\s*(?:<p>[^<]*지도[^<]*<\/p>\s*)?/gi,
    '<h2 id="위치-확인">📍 위치 확인</h2><p style="color:var(--text-tertiary);font-size:var(--fs-sm)">아래 버튼으로 정확한 위치를 확인하세요.</p>'
  );
}

// ── 메인 함수 ──
export function enhanceBlogVisuals(html: string, options?: EnhanceOptions): string {
  let e = html;
  const opts = options || {};

  e = cleanLocationSection(e);
  e = fixMapLinks(e);
  e = e.replace(/<table/g, '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin:12px 0;border-radius:8px;border:1px solid var(--border)"><table style="min-width:400px"');
  e = e.replace(/<\/table>/g, '</table></div>');
  e = enhanceDividers(e);        // #6
  e = enhanceBlockquotes(e);     // #7
  e = enhanceCheckpoints(e);     // #5
  e = highlightStats(e);         // #8
  e = enhanceKeyPoints(e);
  e = insertPriceRange(e);       // #4
  e = insertSummaryCard(e, opts.excerpt);
  e = insertHeroStats(e);        // #2
  // insertColorTags removed — empty function
  // insertCoverImage removed — handled by BlogHeroImage component

  return e;
}
