export interface TocItem {
  level: number;
  text: string;
  id: string;
}

const KOR = /[\w가-힣ㄱ-ㅎㅏ-ㅣ]+/g;

function slugify(raw: string): string {
  const stripped = raw.replace(/<[^>]+>/g, '').trim();
  const matched = stripped.match(KOR);
  if (!matched) return '';
  return matched.join('-').toLowerCase();
}

export function extractTocItems(html: string): TocItem[] {
  if (!html) return [];
  const items: TocItem[] = [];
  const re = /<h([23])(?:\s+[^>]*?)?(?:\s+id=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const level = parseInt(m[1], 10);
    const explicitId = m[2];
    const inner = m[3]
      .replace(/<[^>]+>/g, '')
      .replace(/\*\*/g, '')
      .trim();
    if (!inner) continue;
    const id = explicitId || slugify(inner);
    if (!id) continue;
    items.push({ level, text: inner, id });
  }
  return items;
}

export function extractTocFromMarkdown(md: string): TocItem[] {
  if (!md) return [];
  const items: TocItem[] = [];
  for (const line of md.split('\n')) {
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/\*\*/g, '').trim();
    if (!text) continue;
    items.push({ level, text, id: slugify(text) });
  }
  return items;
}
