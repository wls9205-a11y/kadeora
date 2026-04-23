/**
 * 세션 146 B4 / 세션 152 수정 — 블로그 markdown 에 인라인 이미지 자동 삽입.
 *
 * 세션 152 변경:
 * - 기존 이미지 개수 확인 → 부족분만 추가 (최소 4장, 최대 6장) — 네이버 이미지 캐러셀 조건
 * - H2 ≥ 4 면 H2 경계 사용, 부족하면 H3 경계 fallback
 * - H2+H3 도 부족하면 800자 블록마다 균등 삽입
 */

export interface InjectInput {
  title: string;
  category?: string | null;
  tags?: string[] | null;
  region?: string | null;
  markdown: string;
}

export interface InjectResult {
  updated: boolean;
  markdown: string;
  inserted: number;
  totalImages: number; // 삽입 후 총 이미지 개수
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
const TARGET_MIN = 4;
const TARGET_MAX = 6;

function buildImgMd(title: string, alt: string, design: number, category: string) {
  const t = encodeURIComponent(title.slice(0, 50));
  const c = category || 'blog';
  return `\n\n![${alt}](${SITE_URL}/api/og?title=${t}&category=${c}&design=${design})\n\n`;
}

function countExistingImages(md: string): number {
  const mdImgs = (md.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
  const htmlImgs = (md.match(/<img\s[^>]*>/gi) || []).length;
  return mdImgs + htmlImgs;
}

/**
 * H1~H4 헤더 위치 수집. H2 우선.
 * 세션 154: H1/H4 까지 확장해서 목차만 있는 short-content 포스트도 커버.
 */
function findHeaderPositions(md: string): number[] {
  const positions: Array<{ pos: number; level: number }> = [];
  const re = /^(#{1,4})\s+.+$/gm;
  for (const m of md.matchAll(re)) {
    positions.push({ pos: m.index!, level: m[1].length });
  }
  // H2 우선, 같은 level 내 순서
  positions.sort((a, b) => a.level - b.level || a.pos - b.pos);
  return positions.map((p) => p.pos);
}

/** 글자 수 기반 균등 분할점 (H 부족 시 fallback) */
function charBlockPositions(md: string, count: number): number[] {
  const positions: number[] = [];
  const step = Math.floor(md.length / (count + 1));
  for (let i = 1; i <= count; i++) {
    // 가장 가까운 줄바꿈 위치로 스냅
    const target = step * i;
    const nearby = md.indexOf('\n\n', target);
    positions.push(nearby >= 0 ? nearby : target);
  }
  return positions;
}

export function injectInlineImages(input: InjectInput): InjectResult {
  const { title, category = 'blog', tags, region, markdown } = input;
  if (!markdown || markdown.length < 200) {
    return { updated: false, markdown: markdown || '', inserted: 0, totalImages: 0 };
  }

  const existing = countExistingImages(markdown);
  if (existing >= TARGET_MIN) {
    return { updated: false, markdown, inserted: 0, totalImages: existing };
  }

  const needed = Math.min(TARGET_MAX - existing, TARGET_MIN - existing + 2);
  if (needed <= 0) {
    return { updated: false, markdown, inserted: 0, totalImages: existing };
  }

  // 삽입 위치 수집: H2/H3 우선, 부족하면 char block fallback
  let positions = findHeaderPositions(markdown);
  if (positions.length < needed) {
    const blockPositions = charBlockPositions(markdown, needed - positions.length);
    positions = [...positions, ...blockPositions].sort((a, b) => a - b);
  }
  positions = positions.slice(0, needed);
  if (positions.length === 0) {
    return { updated: false, markdown, inserted: 0, totalImages: existing };
  }

  const year = new Date().getFullYear();
  const firstTag = (tags && tags[0]) || title.slice(0, 20);
  const altBase = `${region || ''} ${firstTag} ${year}`.trim().slice(0, 120);

  // 뒤에서 앞으로 삽입해야 position 보존
  const sorted = [...positions].sort((a, b) => b - a);
  let result = markdown;
  let inserted = 0;
  for (let i = 0; i < sorted.length; i++) {
    const design = ((i + existing) % 6) + 1;
    const img = buildImgMd(title, altBase, design, category || 'blog');
    const pos = sorted[i];
    result = result.slice(0, pos) + img + result.slice(pos);
    inserted++;
  }

  return {
    updated: true,
    markdown: result,
    inserted,
    totalImages: existing + inserted,
  };
}
