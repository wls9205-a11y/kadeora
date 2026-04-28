/**
 * internal-link-injector — 본문 첫 등장 entity (apt_sites/redev/unsold) 를
 *   마크다운 [name](url) 로 자동 변환 + blog_hub_mapping 에 upsert.
 *
 *  s189: 블로그 3,468건 중 단지페이지 링크 0.98%만 → link equity 가
 *  /apt 같은 탑페이지로만 흐르는 문제 해결 (Topic Cluster 모델).
 */

interface AptSite { slug: string; name: string }
interface RedevProject { id: string; district_name: string }
interface UnsoldApt { id: string; house_nm: string }

interface CacheState {
  apt: AptSite[];
  redev: RedevProject[];
  unsold: UnsoldApt[];
  loadedAt: number;
}

const TTL_MS = 5 * 60_000;
const MIN_NAME_LEN = 4;
let _cache: CacheState | null = null;

export function _resetCache() { _cache = null; }

async function loadCache(sb: any): Promise<CacheState> {
  if (_cache && Date.now() - _cache.loadedAt < TTL_MS) return _cache;

  const [aptRes, redevRes, unsoldRes] = await Promise.all([
    sb.from('apt_sites').select('slug, name').not('slug', 'is', null).limit(5000),
    sb.from('redevelopment_projects').select('id, district_name').not('district_name', 'is', null).limit(3000),
    sb.from('unsold_apts').select('id, house_nm').not('house_nm', 'is', null).limit(2000),
  ]);

  const apt: AptSite[] = (aptRes.data || []).filter((r: any) => r.name && r.name.length >= MIN_NAME_LEN);
  const redev: RedevProject[] = (redevRes.data || []).filter((r: any) => r.district_name && r.district_name.length >= MIN_NAME_LEN);
  const unsold: UnsoldApt[] = (unsoldRes.data || []).filter((r: any) => r.house_nm && r.house_nm.length >= MIN_NAME_LEN);

  _cache = { apt, redev, unsold, loadedAt: Date.now() };
  return _cache;
}

/**
 * 첫 등장 1회만 마크다운 링크로 변환.
 * - 이미 동일 URL 링크 있으면 skip
 * - 직전 문자가 '[' 면 (이미 마크다운 링크 텍스트의 일부) skip
 * - 직후 50자 이내 ']('가 보이면 (다른 마크다운 링크 텍스트의 일부) skip
 *
 * s195: lookbehind/lookahead 정규식이 한글 entity 에서 silent fail (브라우저별
 * 동작 다름 + V8 한글 경계 문제) → indexOf 기반 단순 매칭으로 교체.
 */
function replaceFirstOccurrence(content: string, name: string, url: string): { changed: boolean; out: string } {
  if (content.includes(`](${url})`)) return { changed: false, out: content };

  const idx = content.indexOf(name);
  if (idx === -1) return { changed: false, out: content };

  // 직전이 '[' 면 이미 링크 텍스트 안
  if (idx > 0 && content[idx - 1] === '[') return { changed: false, out: content };

  // 직후 50자 이내에 '](' 가 보이면 (그 사이 ]/[ 없을 때) 이미 다른 링크 텍스트
  const after = content.slice(idx + name.length, idx + name.length + 50);
  if (/^[^\[\]]*?\]\(/.test(after)) return { changed: false, out: content };

  const before = content.slice(0, idx);
  const tail = content.slice(idx + name.length);
  return { changed: true, out: `${before}[${name}](${url})${tail}` };
}

export interface InjectOptions {
  title?: string;
  category?: string;
  maxLinks?: number;
  postId?: number | null;
}

interface HubMappingRow {
  hub_type: 'apt' | 'redev' | 'unsold';
  hub_id: string;
}

/**
 * 본문에 내부 링크 자동 삽입.
 *  - apt_sites: name → /apt/{slug}
 *  - redevelopment_projects: district_name → /apt/redev/{id}
 *  - unsold_apts: house_nm → /apt/unsold/{id}
 *  postId 가 있으면 blog_hub_mapping 에 upsert (멱등).
 */
export async function injectInternalLinks(
  sb: any,
  content: string,
  opts: InjectOptions = {}
): Promise<string> {
  const maxLinks = opts.maxLinks ?? 5;
  const cache = await loadCache(sb);
  console.log(`[link-injector] cache size apt=${cache.apt.length} redev=${cache.redev.length} unsold=${cache.unsold.length}`);

  let out = content;
  let injected = 0;
  const matched: string[] = [];
  const mappings: HubMappingRow[] = [];

  // 우선순위: apt → redev → unsold (apt 사이트 링크가 가장 가치 큼)
  for (const site of cache.apt) {
    if (injected >= maxLinks) break;
    const url = `/apt/${site.slug}`;
    const { changed, out: next } = replaceFirstOccurrence(out, site.name, url);
    if (changed) {
      out = next;
      injected++;
      matched.push(`apt:${site.name}`);
      mappings.push({ hub_type: 'apt', hub_id: site.slug });
    }
  }
  for (const r of cache.redev) {
    if (injected >= maxLinks) break;
    const url = `/apt/redev/${r.id}`;
    const { changed, out: next } = replaceFirstOccurrence(out, r.district_name, url);
    if (changed) {
      out = next;
      injected++;
      matched.push(`redev:${r.district_name}`);
      mappings.push({ hub_type: 'redev', hub_id: String(r.id) });
    }
  }
  for (const u of cache.unsold) {
    if (injected >= maxLinks) break;
    const url = `/apt/unsold/${u.id}`;
    const { changed, out: next } = replaceFirstOccurrence(out, u.house_nm, url);
    if (changed) {
      out = next;
      injected++;
      matched.push(`unsold:${u.house_nm}`);
      mappings.push({ hub_type: 'unsold', hub_id: String(u.id) });
    }
  }

  console.log(`[link-injector] injected=${injected} matched=${matched.slice(0, 3).join(', ')} postId=${opts.postId ?? 'none'}`);

  if (opts.postId && mappings.length > 0) {
    try {
      const rows = mappings.map(m => ({
        blog_post_id: opts.postId,
        hub_type: m.hub_type,
        hub_id: m.hub_id,
      }));
      const { error: upErr } = await (sb as any).from('blog_hub_mapping').upsert(rows, {
        onConflict: 'blog_post_id,hub_type,hub_id',
        ignoreDuplicates: true,
      });
      if (upErr) {
        console.error('[link-injector] hub_mapping upsert err:', upErr.message);
      } else {
        console.log(`[link-injector] hub_mapping upserted rows=${rows.length} postId=${opts.postId}`);
      }
    } catch (e: any) {
      console.error('[link-injector] hub_mapping upsert exception:', e?.message);
    }
  }

  return out;
}

/**
 * 본문에 "## 관련 정보" 또는 "## 관련 페이지" 섹션이 없으면
 * resolve_hub_url RPC 로 hub 3개 추출해 footer 추가.
 */
export async function appendRelatedHubFooter(
  sb: any,
  content: string,
  opts: { category?: string; postId?: number | null } = {}
): Promise<string> {
  if (content.includes('## 관련 정보') || content.includes('## 관련 페이지')) return content;

  const cache = await loadCache(sb);
  const picks: { label: string; url: string }[] = [];

  // 카테고리에 따라 hub 우선순위 다르게
  if (opts.category === 'apt' || opts.category === 'unsold') {
    for (const s of cache.apt.slice(0, 3)) picks.push({ label: s.name, url: `/apt/${s.slug}` });
  } else {
    for (const s of cache.apt.slice(0, 2)) picks.push({ label: s.name, url: `/apt/${s.slug}` });
    if (cache.redev[0]) picks.push({ label: cache.redev[0].district_name, url: `/apt/redev/${cache.redev[0].id}` });
  }

  if (picks.length === 0) return content;

  const lines = ['', '---', '', '## 관련 정보', ''];
  for (const p of picks.slice(0, 3)) lines.push(`- [${p.label} →](${p.url})`);
  lines.push('');
  return content + '\n' + lines.join('\n');
}
