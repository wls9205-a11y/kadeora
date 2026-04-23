/**
 * 세션 146 B4 — 블로그 markdown 의 H2 섹션 경계에 /api/og 인라인 이미지 자동 삽입.
 *
 * 규칙:
 * - 본문에 이미지 (`![` 또는 `<img`) 가 이미 있으면 skip
 * - H2 개수 만큼 최대 3개 삽입 (design 1~6 순환)
 * - alt="{지역} {키워드} {연도}"
 * - 순수 함수 (DB 호출 금지)
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
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

function buildImgMd(title: string, alt: string, design: number, category: string) {
  const t = encodeURIComponent(title.slice(0, 50));
  const c = category || 'blog';
  return `\n\n![${alt}](${SITE_URL}/api/og?title=${t}&category=${c}&design=${design})\n\n`;
}

export function injectInlineImages(input: InjectInput): InjectResult {
  const { title, category = 'blog', tags, region, markdown } = input;
  if (!markdown || markdown.length < 200) return { updated: false, markdown: markdown || '', inserted: 0 };
  // 이미 이미지 있으면 스킵
  if (/!\[[^\]]*\]\([^)]+\)|<img\s/i.test(markdown)) {
    return { updated: false, markdown, inserted: 0 };
  }

  // H2 위치 찾기
  const h2Regex = /^##\s+.+$/gm;
  const h2Matches = Array.from(markdown.matchAll(h2Regex));
  if (h2Matches.length === 0) return { updated: false, markdown, inserted: 0 };

  const year = new Date().getFullYear();
  const firstTag = (tags && tags[0]) || title.slice(0, 20);
  const alt = `${region || ''} ${firstTag} ${year}`.trim().slice(0, 120);

  const maxInserts = Math.min(h2Matches.length, 3);
  let offset = 0;
  let result = markdown;
  for (let i = 0; i < maxInserts; i++) {
    const m = h2Matches[i];
    const insertPos = m.index! + offset;
    const design = ((i) % 6) + 1;
    const img = buildImgMd(title, alt, design, category || 'blog');
    result = result.slice(0, insertPos) + img + result.slice(insertPos);
    offset += img.length;
  }

  return { updated: true, markdown: result, inserted: maxInserts };
}
