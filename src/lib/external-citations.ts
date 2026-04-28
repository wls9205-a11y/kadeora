/**
 * external-citations — EAT (Expertise/Authority/Trust) 보강용
 *  external_citations 테이블에서 카테고리별 권위 출처를 본문에 자동 삽입.
 *
 *  s189: Google E-E-A-T 평가 + AI 인용 가능성 강화. 모든 발행 글이 1개 이상의
 *  외부 권위 출처를 갖도록 안전장치 (warning 으로 통과, hard gate 는 아님).
 */

interface Citation {
  id: string;
  category: string;
  source_name: string;
  source_url: string;
  authority_score: number;
  keyword_pattern: string | null; // 정규식 문자열
}

const TTL_MS = 10 * 60_000;
const _cache = new Map<string, { rows: Citation[]; loadedAt: number }>();

async function loadCitations(sb: any, category: string): Promise<Citation[]> {
  const key = category;
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached.rows;

  try {
    const { data } = await (sb as any)
      .from('external_citations')
      .select('id, category, source_name, source_url, authority_score, keyword_pattern')
      .or(`category.eq.${category},category.eq.general`)
      .order('authority_score', { ascending: false })
      .limit(40);

    const rows: Citation[] = (data || []) as Citation[];
    _cache.set(key, { rows, loadedAt: Date.now() });
    return rows;
  } catch (e: any) {
    console.error('[external-citations] load failed:', e?.message);
    return [];
  }
}

function regexSafe(pattern: string): RegExp | null {
  try { return new RegExp(pattern, 'i'); } catch { return null; }
}

/**
 * 본문에 외부 권위 출처 인용 1~maxCitations 개 삽입.
 *  - "## 데이터 출처" 또는 "## 출처" 섹션 있으면 그 안에 추가
 *  - 없으면 면책 고지 위 또는 본문 끝에 새 섹션 추가
 */
export async function injectExternalCitations(
  sb: any,
  content: string,
  category: string,
  maxCitations = 3
): Promise<string> {
  const candidates = await loadCitations(sb, category);
  console.log(`[external-citations] cat=${category} candidates=${candidates.length}`);
  if (candidates.length === 0) return content;

  const picked: Citation[] = [];
  for (const c of candidates) {
    if (picked.length >= maxCitations) break;
    if (content.includes(c.source_url)) continue; // 이미 인용됨

    if (c.keyword_pattern) {
      const re = regexSafe(c.keyword_pattern);
      if (re && !re.test(content)) continue;
    }
    picked.push(c);
  }
  console.log(`[external-citations] picked=${picked.length} sources=${picked.map(p => p.source_name).join(', ')}`);
  if (picked.length === 0) return content;

  const bullets = picked.map(c => `- [${c.source_name}](${c.source_url})`).join('\n');

  // s195: 기존 섹션 매칭 분기 제거 — 14% 작동률의 원인. 무조건 본문 끝(또는
  // 면책 고지 위) 에 새 "## 데이터 출처" 섹션 append.
  const newSection = `\n\n---\n\n## 📊 데이터 출처\n\n${bullets}\n`;
  const reDisclaim = /(\n>\s*(?:⚠️|면책)|\n##?\s*면책)/;
  const md = content.match(reDisclaim);
  if (md && md.index !== undefined) {
    return content.slice(0, md.index) + newSection + content.slice(md.index);
  }
  return content + newSection;
}
