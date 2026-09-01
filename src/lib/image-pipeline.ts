/**
 * [CI-v1 Task 5] image-pipeline — 블로그 포스트 이미지 수집·점수·hydrate 공용 파이프라인
 *
 * blog-generate-images / issue-image-attach / big-event-news-attach 가 공유.
 *
 * 단계:
 *   1) collectCandidates(post, strategy)
 *        카테고리별 전략으로 후보 URL 수집 (네이버 이미지검색, apt_sites 위성, og 등)
 *   2) scoreAndFilter(candidates, post, threshold)
 *        image-relevance-v1 edge function 병렬 호출 → score >= threshold keep
 *   3) hydrateAndRecord(admin, post, scored)
 *        상위 N개 hydrateImage → Storage 업로드 → record_blog_image RPC (pos 0..5)
 *        position 7 infographic OG → hydrate → record (og_placeholder)
 *
 * cover_image 동기화: blog_post_images 의 AFTER INSERT 트리거(trg_bpi_cover_sync)가 자동 수행.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { hydrateImage, type HydrateResult } from '@/lib/image-hydrate';
import { cleanScrapedAlt } from '@/lib/clean-image-alt';
import { SITE_URL } from '@/lib/constants';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const IMG_BLOCK_DOMAINS = [
  // 스톡/위키/SNS
  'utoimage', 'freepik', 'shutterstock', 'pixabay', 'unsplash', 'istockphoto',
  'namu.wiki', 'wikipedia', 'youtube.com', 'pinimg.com', 'ohousecdn',
  // 부동산 경쟁/스크래핑
  'hogangnono', 'new.land.naver.com', 'landthumb', 'kbland', 'kbstar.com',
  'zigbang', 'dabang', 'dcinside', 'ruliweb.com', 'ppomppu.co.kr',
  // s261: 네이버/다음 뉴스 이미지 핫링크 (저작권 + 403)
  'imgnews.naver.net', 'mimgnews.pstatic.net', 'pstatic.net',
  'img.kakaocdn.net', 'i1.daumcdn.net',
  // s261: 한국 주요 매체 도메인 (저작권/링크 끊김)
  'hankyung.com', 'wowtv.co.kr', 'mk.co.kr', 'mkbn.mk.co.kr',
  'chosun.com', 'donga.com', 'joongang.co.kr', 'khan.co.kr',
  'mt.co.kr', 'moneys.co.kr', 'fnnews.com', 'sedaily.com',
  'news1.kr', 'yna.co.kr', 'newsis.com', 'etnews.com',
  'mbn.co.kr', 'sbs.co.kr', 'mbc.co.kr', 'kbs.co.kr',
  'jtbc.co.kr', 'tvchosun.com', 'channela.com', 'ytn.co.kr',
];

// ─────────── 타입 ───────────

export interface PostContext {
  id: number;
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  category: string;
  sub_category?: string | null;
  tags?: string[] | null;
  source_ref?: string | null;
  /** s268(가): apt_sites 를 이름 ilike 로 더듬지 않고 직행하기 위한 FK. 있으면 이름 검색보다 우선. */
  apt_site_id?: string | null;
}

export interface ImageCandidate {
  url: string;
  alt?: string;
  caption?: string;
  source: 'naver' | 'satellite' | 'apt_images' | 'og' | 'infographic';
}

export interface ScoredCandidate extends ImageCandidate {
  score: number;
  verdict: 'keep' | 'maybe' | 'reject';
  signals?: Record<string, unknown>;
}

export interface PipelineOptions {
  relevanceThreshold?: number;      // default 0.55 (maybe+)
  maxRealImages?: number;            // default 6
  includeInfographicPosition?: boolean; // default true (position 7)
  subdir?: string;                   // default 'blog'
  candidatePerQuery?: number;        // default 10
}

export interface PipelineResult {
  post_id: number;
  storage_real: number;
  og_placeholder: number;
  skipped: number;
  candidates_count: number;
  scored_keep: number;
  failures: string[];
  cover_url?: string;
}

// ─────────── 1) 후보 수집 ───────────

/**
 * s268(가-가드): 차단 도메인 판정을 한 곳으로 모은다.
 * s261 이 뉴스·스톡 도메인을 막았지만 그 검사는 searchNaverImages 안에만 있었고,
 * apt_sites.images 경로는 무필터로 후보에 들어갔다. apt_site_id 직행이 그 경로를
 * 실제로 열기 때문에, 후보를 만드는 모든 자리에서 같은 자를 쓴다.
 */
export function isBlockedImageUrl(url: string): boolean {
  const u = String(url || '').toLowerCase();
  if (!u) return true;
  return IMG_BLOCK_DOMAINS.some((d) => u.includes(d));
}

interface NaverItem {
  url: string;
  alt: string;
  source: string;
}

async function searchNaverImages(query: string, display = 10): Promise<NaverItem[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${display}&sort=sim&filter=large`,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.items || [];
    return items
      .filter((it) => {
        const w = parseInt(it?.sizewidth || '0');
        const h = parseInt(it?.sizeheight || '0');
        if (w < 400 || h < 250) return false;
        const u = String(it?.link || '').toLowerCase();
        if (!u) return false;
        if (isBlockedImageUrl(u)) return false;
        return true;
      })
      .map((it) => ({
        url: String(it.link || '').replace(/^http:\/\//, 'https://'),
        alt: String(it.title || '').replace(/<[^>]*>/g, ''),
        source: 'naver',
      }));
  } catch {
    return [];
  }
}

/**
 * 카테고리별 ci_image_strategy + post 정보로 후보 수집.
 */
export async function collectCandidates(
  admin: SupabaseClient,
  post: PostContext,
  strategy: { priority_sources?: string[]; fallback_sources?: string[]; search_keyword_template?: string } | null,
  perQuery = 10,
): Promise<ImageCandidate[]> {
  const category = (post.category || 'general').toLowerCase();
  const candidates: ImageCandidate[] = [];

  // 카테고리별 전략 순회
  const sources = [
    ...(strategy?.priority_sources || []),
    ...(strategy?.fallback_sources || []),
  ];

  // ─── apt / unsold / redev: apt_sites.satellite/images 우선
  if (['apt', 'unsold', 'redev'].includes(category)) {
    const aptName = (post.tags || [])[0] || post.title.split(/[|:—]/)[0]?.trim();
    // s268(가): apt_site_id 가 있으면 그것으로 직행한다.
    // 기존 경로는 tags[0] 또는 제목 앞토막을 20자로 잘라 ilike 로 더듬었는데, 제목에 구분자가
    // 없으면 「일광 더에스 동일스위트 분양가, 주변」 같은 문장이 검색어가 되어 반드시 빗나간다
    // (112007·112008 이 apt_site_id 를 가진 채로 no_candidates 실패한 직접 원인).
    const aptLabel = (aptName || post.title).slice(0, 30);
    let site: any = null;
    if (post.apt_site_id) {
      const { data } = await (admin as any)
        .from('apt_sites')
        .select('satellite_image_url, images')
        .eq('id', post.apt_site_id)
        .maybeSingle();
      site = data ?? null;
    }
    if (!site && aptName) {
      const { data } = await (admin as any)
        .from('apt_sites')
        .select('satellite_image_url, images')
        .ilike('name', `%${aptName.slice(0, 20)}%`)
        .limit(1)
        .maybeSingle();
      site = data ?? null;
    }
    if (site?.satellite_image_url && !isBlockedImageUrl(site.satellite_image_url)) {
      candidates.push({
        url: String(site.satellite_image_url),
        alt: `${aptLabel} 위성사진`,
        caption: '출처: VWorld',
        source: 'satellite',
      });
    }
    if (Array.isArray(site?.images)) {
      for (const im of site.images.slice(0, 4)) {
        const u = typeof im === 'string' ? im : im?.url;
        if (!u || isBlockedImageUrl(u)) continue;
        candidates.push({
          url: String(u),
          alt: `${aptLabel} 단지 사진`,
          source: 'apt_images',
        });
      }
    }
  }

  // ─── 네이버 이미지 검색 (apt/stock/unsold/redev/finance/general 공통)
  if (sources.includes('naver_image_api') || candidates.length < 8) {
    const tpl = strategy?.search_keyword_template || '{topic}';
    const topic = buildSearchTopic(post, category);
    const query = tpl
      .replace(/\{apt_name\}|\{ticker\}|\{company_name\}|\{topic\}/g, topic)
      .replace(/\{region\}/g, (post.tags || []).find((t) => /구$|군$|시$/.test(t)) || '')
      .replace(/\{\w+\}/g, '')
      .replace(/\s+/g, ' ')
      .trim() || topic;
    const items = await searchNaverImages(query, perQuery);
    for (const it of items) {
      if (candidates.some((c) => c.url === it.url)) continue;
      candidates.push({
        url: it.url,
        // 스크랩 title(it.alt)이 KB부동산 등 깨진 alt(undefined/중복/빈 단지명)면 post.title 로 대체
        alt: cleanScrapedAlt(it.alt, post.title),
        source: 'naver',
      });
    }
  }

  return candidates.slice(0, 20);
}

function buildSearchTopic(post: PostContext, category: string): string {
  const tags = (post.tags || []).slice(0, 3).join(' ');
  const titleCore = post.title
    .replace(/[|—·()[\]"'|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 4)
    .join(' ');
  const catWord = ({
    apt: '아파트',
    stock: '주식 차트',
    unsold: '미분양',
    redev: '재개발',
    finance: '재테크',
    general: '데이터',
  } as Record<string, string>)[category] || category;
  return `${tags} ${titleCore} ${catWord}`.replace(/\s+/g, ' ').trim().slice(0, 60);
}

// ─────────── 2) 관련성 점수화 ───────────

export async function scoreAndFilter(
  candidates: ImageCandidate[],
  post: PostContext,
  opts: { threshold?: number; mode?: 'fast' | 'vision' } = {},
): Promise<ScoredCandidate[]> {
  const threshold = opts.threshold ?? 0.55;
  if (candidates.length === 0) return [];
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // edge fn 못 부르면 통과 (가용성 우선, blocked 도메인만 local 필터 끝)
    return candidates.map((c) => ({ ...c, score: 0.6, verdict: 'keep' as const }));
  }

  const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/image-relevance-v1`;
  const ctx = {
    title: post.title,
    keywords: (post.tags || []).slice(0, 10),
    entities: (post.tags || []).slice(0, 5),
    category: post.category,
    sub_category: post.sub_category || undefined,
  };

  async function scoreOne(c: ImageCandidate): Promise<ScoredCandidate> {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          image_url: c.url,
          image_alt: c.alt || '',
          context: ctx,
          mode: opts.mode ?? 'fast',
          skip_head: true, // hydrate 단계에서 GET 으로 다시 확인하므로 HEAD 절약
        }),
        signal: AbortSignal.timeout(12_000),
      });
      const data = await res.json().catch(() => null);
      if (!data || data.ok === false) {
        return { ...c, score: 0, verdict: 'reject', signals: { error: data?.error } };
      }
      return {
        ...c,
        score: Number(data.score || 0),
        verdict: (data.verdict as any) || 'reject',
        signals: data.signals || {},
      };
    } catch (e: any) {
      // 장애 시 보수적으로 maybe 로 통과 (hydrate 쪽에서 재필터)
      return { ...c, score: 0.5, verdict: 'maybe', signals: { error: e?.message || 'fetch' } };
    }
  }

  // 병렬 호출 (max 5)
  const BATCH = 5;
  const out: ScoredCandidate[] = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(scoreOne));
    out.push(...results);
  }

  // threshold 이상 + 점수 내림차순
  return out.filter((s) => s.score >= threshold).sort((a, b) => b.score - a.score);
}

// ─────────── 3) hydrate + record ───────────

export async function hydrateAndRecord(
  admin: SupabaseClient,
  post: PostContext,
  scored: ScoredCandidate[],
  opts: PipelineOptions = {},
): Promise<PipelineResult> {
  const maxReal = opts.maxRealImages ?? 6;
  const includeInfo = opts.includeInfographicPosition ?? true;
  const subdir = opts.subdir || `blog/${new Date().toISOString().slice(0, 7)}/${post.id}`;

  const result: PipelineResult = {
    post_id: post.id,
    storage_real: 0,
    og_placeholder: 0,
    skipped: 0,
    candidates_count: scored.length,
    scored_keep: scored.length,
    failures: [],
  };

  // 3a) top-N real hydrate 병렬
  const top = scored.slice(0, maxReal);
  const hydrations = await Promise.all(
    top.map((c) =>
      hydrateImage(admin, c.url, { subdir, maxWidth: 1200, maxHeight: 800, quality: 82 })
        .then((r) => ({ cand: c, res: r })),
    ),
  );

  // 3b) position 0..N-1 record
  let nextPos = 0;
  for (const { cand, res } of hydrations) {
    if (!res.ok) {
      result.skipped++;
      result.failures.push(`${cand.source}:${res.reason}:${res.detail || ''}`.slice(0, 120));
      continue;
    }
    const position = nextPos++;
    try {
      await (admin as any).rpc('record_blog_image', {
        p_post_id: post.id,
        p_position: position,
        p_image_url: res.url,
        p_image_kind: cand.source === 'infographic' ? 'infographic' : 'storage_real',
        p_alt_text: cleanScrapedAlt(cand.alt, post.title),
        p_caption: (cand.caption || `출처: ${cand.source}`).slice(0, 200),
        p_storage_path: res.storagePath,
      });
      if (cand.source === 'infographic') result.og_placeholder++; else result.storage_real++;
      if (position === 0) result.cover_url = res.url;
    } catch (err: any) {
      result.skipped++;
      result.failures.push(`record${position}:${err?.message || ''}`.slice(0, 120));
    }
  }

  // 3c) position 7: infographic OG — 세션 145 fix:
  //   1) real image 가 하나라도 성공했을 때만 infographic 부가 (단독 placeholder 금지)
  //   2) hydration 실패 시 raw /api/og URL 삽입 금지 — Storage 에 저장된 것만 기록
  // s268(나): storage_real > 0 전제 해제. 실사진이 0장일 때야말로 자체 생성 카드가 필요한데,
  // 기존 조건은 정확히 그 경우에 카드를 만들지 않아 결손이 결손을 부르는 고리를 만들었다.
  if (includeInfo) {
    const catWord = ({ apt: '부동산', stock: '주식', unsold: '미분양', redev: '재개발', finance: '재테크', general: '분석' } as Record<string, string>)[post.category] || '정보';
    const design = 1 + (Math.abs(hashString(post.title)) % 6);
    const ogUrl = `${SITE_URL.replace(/\/$/, '')}/api/og?title=${encodeURIComponent(post.title.slice(0, 50))}&category=${post.category}&author=${encodeURIComponent(`카더라 ${catWord}팀`)}&design=${design}`;
    try {
      const ogHydrate = await hydrateImage(admin, ogUrl, {
        subdir: `${subdir}/og`,
        maxWidth: 1200,
        maxHeight: 800,
        quality: 85,
      });
      if (ogHydrate.ok) {
        await (admin as any).rpc('record_blog_image', {
          p_post_id: post.id,
          p_position: 7,
          p_image_url: ogHydrate.url,
          p_image_kind: 'og_placeholder',
          p_alt_text: `${post.title} — 카더라 ${catWord} 인포그래픽`.slice(0, 200),
          p_caption: `카더라 ${catWord} 데이터 분석`.slice(0, 200),
          p_storage_path: ogHydrate.storagePath,
        });
        result.og_placeholder++;
      } else {
        // hydration 실패 — raw /api/og URL 은 DB 에 기록하지 않음 (오염 방지)
        result.failures.push('og7:hydrate_failed');
      }
    } catch (err: any) {
      result.failures.push(`og7:${err?.message || ''}`.slice(0, 120));
    }
  }

  return result;
}

// ─────────── s268(나): 자체 생성 카드 (infographic_gen 실구현) ───────────

/**
 * 실데이터로만 카드를 만든다. 항목이 2개 미만이면 카드를 만들지 않는다 —
 * 게이트의 3장 요건을 빈 카드로 채우는 것은 자를 휘는 것과 같다.
 * 모든 카드에 기준일을 박고, 집계값에는 집계임을 밝힌다.
 */
export async function buildSelfMadeCards(
  admin: SupabaseClient,
  post: PostContext,
): Promise<ImageCandidate[]> {
  const cards: ImageCandidate[] = [];
  const base = SITE_URL.replace(/\/$/, '');
  const category = (post.category || 'general').toLowerCase();
  const clean = (v: string) => String(v).replace(/[,:]/g, ' ').replace(/[ ]+/g, ' ').trim();
  const mkUrl = (type: string, title: string, items: Array<[string, string]>) =>
    `${base}/api/og-infographic?type=${type}`
    + `&title=${encodeURIComponent(title.slice(0, 40))}`
    + `&category=${encodeURIComponent(category === 'apt' || category === 'unsold' || category === 'redev' ? 'apt' : category)}`
    + `&items=${encodeURIComponent(items.map(([k, v]) => `${clean(k)}:${clean(v)}`).join(','))}`;

  if (!['apt', 'unsold', 'redev'].includes(category) || !post.apt_site_id) return cards;

  const { data: site } = await (admin as any)
    .from('apt_sites')
    .select('name, region, sigungu, dong, builder, total_units, built_year, move_in_date, updated_at')
    .eq('id', post.apt_site_id)
    .maybeSingle();

  if (site) {
    const items: Array<[string, string]> = [];
    if (site.total_units) items.push(['총 세대수', `${Number(site.total_units)}세대`]);
    const loc = [site.region, site.sigungu, site.dong].filter(Boolean).join(' ');
    if (loc) items.push(['위치', loc]);
    if (site.builder) items.push(['시공', String(site.builder)]);
    if (site.built_year) items.push(['준공', `${site.built_year}년`]);
    if (site.move_in_date) items.push(['입주', String(site.move_in_date)]);
    if (site.updated_at) items.push(['기준일', String(site.updated_at).slice(0, 10)]);
    if (items.length >= 2) {
      cards.push({
        url: mkUrl('summary', `${site.name || post.title} 단지 개요`, items.slice(0, 5)),
        alt: `${site.name || post.title} 단지 개요 — 세대수·위치·시공 (기준일 ${String(site.updated_at || '').slice(0, 10)})`,
        caption: '카더라 자체 작성 — 단지 등록 정보',
        source: 'infographic',
      });
    }

    // 지역 실거래 집계 — 추정이 아니라 집계값이므로 「집계」와 기준일을 함께 밝힌다.
    if (site.sigungu) {
      const { data: rows } = await (admin as any)
        .from('apt_complex_profiles')
        .select('latest_sale_date, latest_sale_price')
        .eq('sigungu', site.sigungu)
        .not('latest_sale_date', 'is', null)
        .limit(1000);
      const arr: any[] = Array.isArray(rows) ? rows : [];
      if (arr.length >= 10) {
        const prices = arr.map((r) => Number(r.latest_sale_price) || 0).filter((n) => n > 0);
        const latest = arr.map((r) => String(r.latest_sale_date)).sort().at(-1) || '';
        const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
        const items2: Array<[string, string]> = [['집계 단지', `${arr.length}곳`]];
        if (avg) items2.push(['평균 실거래', `${(avg / 10000).toFixed(1)}억`]);
        if (latest) items2.push(['최근 거래일', latest]);
        if (items2.length >= 2) {
          cards.push({
            url: mkUrl('comparison', `${site.sigungu} 실거래 집계`, items2),
            alt: `${site.sigungu} 실거래 집계 — 단지 ${arr.length}곳 평균 (기준일 ${latest})`,
            caption: `카더라 자체 집계 — ${site.sigungu} 등록 단지 기준, ${latest} 기준일`,
            source: 'infographic',
          });
        }
      }
    }
  }
  return cards;
}

// ─────────── 최상위 runPipeline ───────────

export async function runImagePipeline(
  admin: SupabaseClient,
  post: PostContext,
  opts: PipelineOptions = {},
): Promise<PipelineResult> {
  const { data: strategy } = await (admin as any)
    .from('ci_image_strategy')
    .select('*')
    .eq('category', (post.category || 'general'))
    .maybeSingle();
  const candidates = await collectCandidates(admin, post, strategy, opts.candidatePerQuery ?? 10);
  // s268(나): 자체 생성 카드는 관련성 점수를 매기지 않는다 — 우리가 만든 사실 카드라
  // 외부 후보와 같은 자로 잴 대상이 아니다. 실사진이 모자랄 때 바닥을 받친다.
  const selfMade = (await buildSelfMadeCards(admin, post))
    .map((c) => ({ ...c, score: 1, verdict: 'keep' as const }));
  if (candidates.length === 0) {
    if (selfMade.length === 0) {
      return {
        post_id: post.id,
        storage_real: 0,
        og_placeholder: 0,
        skipped: 0,
        candidates_count: 0,
        scored_keep: 0,
        failures: ['no_candidates'],
      };
    }
    return hydrateAndRecord(admin, post, selfMade, opts);
  }
  const scored = await scoreAndFilter(candidates, post, { threshold: opts.relevanceThreshold ?? 0.55 });
  if (scored.length === 0) {
    // threshold 아래면 fallback: host_trust 있는 naver 후보 top-N 강제 keep
    const fallback = candidates
      .filter((c) => c.source === 'satellite' || c.source === 'naver' || c.source === 'apt_images')
      .slice(0, 3)
      .map((c) => ({ ...c, score: 0.5, verdict: 'maybe' as const }));
    if (fallback.length === 0 && selfMade.length === 0) {
      return {
        post_id: post.id,
        storage_real: 0,
        og_placeholder: 0,
        skipped: candidates.length,
        candidates_count: candidates.length,
        scored_keep: 0,
        failures: ['all_below_threshold'],
      };
    }
    return hydrateAndRecord(admin, post, [...fallback, ...selfMade], opts);
  }
  return hydrateAndRecord(admin, post, [...scored, ...selfMade], opts);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
