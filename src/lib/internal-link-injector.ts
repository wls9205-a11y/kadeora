/**
 * internal-link-injector — 본문 첫 등장 entity (apt_sites/redev/unsold) 를
 *   마크다운 [name](url) 로 자동 변환 + blog_hub_mapping 에 upsert.
 *
 *  s189: 블로그 3,468건 중 단지페이지 링크 0.98%만 → link equity 가
 *  /apt 같은 탑페이지로만 흐르는 문제 해결 (Topic Cluster 모델).
 */

import { extractAptSiteSlugs } from '@/lib/blog-safe-insert';

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

/** 현장이 없는 글의 푸터 — 카테고리 랜딩만. `/apt/<슬러그>` 가 아니라 §2-2 게이트·blog_site_links 에 잡히지 않는다. */
const LANDING_FOOTER: Record<string, { label: string; url: string }[]> = {
  apt: [
    { label: '카더라 청약 일정', url: '/apt' },
    { label: '카더라 부동산 블로그', url: '/blog?category=apt' },
  ],
  stock: [
    { label: '카더라 주식 시세', url: '/stock' },
    { label: '카더라 주식 블로그', url: '/blog?category=stock' },
  ],
  finance: [{ label: '카더라 재테크 블로그', url: '/blog?category=finance' }],
  general: [{ label: '카더라 블로그', url: '/blog' }],
};

export interface FooterSite { slug: string; label: string }

/**
 * 푸터 본문 조립(순수). 현장은 **호출자가 넘긴 것만** 싣는다.
 *
 * BN §3-A — 이전 구현은 `apt_sites` 를 정렬 없이 받아 `slice(0, 2)` 를 모든 글에 붙였다.
 *   물리 저장 순서의 첫 행 = 글과 무관한 현장. 2026-09-18 실측:
 *   issue-draft/issue_preempt 푸터 링크 2,667행(주식 782·재테크 184 포함) 전부 이 경로,
 *   푸터 현장이 hub_apt_slug 로 승격된 글 184편, 현장 링크를 푸터에서만 얻어
 *   §2-2 게이트를 통과한 apt 글 381편(60일).
 * ⚠️ 여기서 현장을 «찾아 붙이지» 말 것. 모르면 랜딩만 단다.
 */
export function buildRelatedFooter(category: string | undefined, sites: FooterSite[]): string {
  const picks: { label: string; url: string }[] = sites.slice(0, 3)
    .map((s) => ({ label: s.label, url: `/apt/${s.slug}` }));
  if (picks.length === 0) picks.push(...(LANDING_FOOTER[category ?? 'general'] ?? LANDING_FOOTER.general));
  const lines = ['', '---', '', '## 관련 정보', ''];
  for (const p of picks) lines.push(`- [${p.label} →](${p.url})`);
  lines.push('');
  return lines.join('\n');
}

/**
 * 본문에 "## 관련 정보" 또는 "## 관련 페이지" 섹션이 없으면 footer 추가.
 *
 * 싣는 현장 = ① 글감 현장(`siteSlug`) ② 본문에 이미 걸린 `/apt/<슬러그>` — 둘 다 활성 실존만.
 * 둘 다 없으면 현장 링크 없이 카테고리 랜딩만 단다(BN §3-A).
 */
export async function appendRelatedHubFooter(
  sb: any,
  content: string,
  opts: { category?: string; postId?: number | null; siteSlug?: string | null } = {}
): Promise<string> {
  if (content.includes('## 관련 정보') || content.includes('## 관련 페이지')) return content;

  const wanted = [...new Set([opts.siteSlug, ...extractAptSiteSlugs(content)].filter((s): s is string => !!s))].slice(0, 20);
  let sites: FooterSite[] = [];
  if (wanted.length > 0) {
    const { data } = await sb.from('apt_sites').select('slug, name, display_name').in('slug', wanted).eq('is_active', true);
    const bySlug = new Map<string, any>((data ?? []).map((r: any) => [r.slug, r]));
    sites = wanted.filter((s) => bySlug.has(s)).map((s) => {
      const r = bySlug.get(s);
      // display 규격 「{예정명} — {구역명}」 — 앞쪽만(issue-context buildSiteContext 와 같은 규칙)
      const disp = String(r.display_name ?? '').split(' — ')[0].trim();
      return { slug: s, label: disp || r.name || s };
    });
  }
  return content + '\n' + buildRelatedFooter(opts.category, sites);
}
