/**
 * [CI-v1 Session D] blog-gated-split — markdown 을 H2 섹션 단위로 분할 + gated_sections 매칭
 *
 * 로그인/프리미엄 게이트가 설정된 섹션에 한해 preview + wall 렌더.
 * 나머지는 기존대로 통째 marked → sanitizeHtml 파이프.
 */

export interface GatedSectionMeta {
  h2: string;
  gate: 'login' | 'premium';
  preview_lines?: number;
  cta_text?: string;
}

export type Chunk =
  | { kind: 'free'; h2: string | null; md: string }
  | { kind: 'gated'; h2: string; md: string; previewMd: string; gate: 'login' | 'premium'; ctaText?: string };

/** md 를 ## H2 단위로 분할. 첫 H2 이전 프리앰블은 h2=null. */
export function splitMarkdownByH2(md: string): Array<{ h2: string | null; md: string }> {
  const src = md || '';
  const lines = src.split('\n');
  const out: Array<{ h2: string | null; md: string }> = [];
  let currentH2: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (buf.length > 0 || currentH2 !== null) {
      out.push({ h2: currentH2, md: buf.join('\n') });
    }
    buf = [];
  };
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      flush();
      currentH2 = m[1].replace(/[#*]/g, '').trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

function normalizeH2(s: string): string {
  return (s || '').replace(/[\s#*·…]+/g, '').toLowerCase();
}

/** chunks 에 대해 gated_sections 매칭. */
export function classifyChunks(
  chunks: Array<{ h2: string | null; md: string }>,
  gated: GatedSectionMeta[] | null | undefined,
): Chunk[] {
  if (!gated || gated.length === 0) {
    return chunks.map((c) => ({ kind: 'free' as const, h2: c.h2, md: c.md }));
  }
  const map = new Map<string, GatedSectionMeta>();
  for (const g of gated) map.set(normalizeH2(g.h2 || ''), g);

  return chunks.map((c) => {
    const key = c.h2 ? normalizeH2(c.h2) : '';
    const g = key ? map.get(key) : undefined;
    if (!g || !c.h2) return { kind: 'free' as const, h2: c.h2, md: c.md };
    const previewLines = Math.max(1, Math.min(20, g.preview_lines || 3));
    const mdLines = c.md.split('\n').filter((l) => l.trim().length > 0);
    const previewMd = mdLines.slice(0, previewLines).join('\n');
    return {
      kind: 'gated' as const,
      h2: c.h2,
      md: c.md,
      previewMd,
      gate: g.gate === 'premium' ? 'premium' : 'login',
      ctaText: g.cta_text,
    };
  });
}
