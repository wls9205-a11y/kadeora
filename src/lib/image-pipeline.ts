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
import { SITE_URL } from '@/lib/constants';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const IMG_BLOCK_DOMAINS = [
  'utoimage', 'freepik', 'shutterstock', 'pixabay', 'unsplash', 'istockphoto',
  'namu.wiki', 'wikipedia', 'youtube.com', 'pinimg.com', 'ohousecdn',
  'hogangnono', 'new.land.naver.com', 'landthumb', 'kbland', 'kbstar.com',
  'zigbang', 'dabang', 'dcinside', 'ruliweb.com', 'ppomppu.co.kr',
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
        if (IMG_BLOCK_DOMAINS.some((d) => u.includes(d))) return false;
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
    if (aptName) {
      const { data: site } = await (admin as any)
        .from('apt_sites')
        .select('satellite_image_url, images')
        .ilike('name', `%${aptName.slice(0, 20)}%`)
        .limit(1)
        .maybeSingle();
      if (site?.satellite_image_url) {
        candidates.push({
          url: String(site.satellite_image_url),
          alt: `${aptName} 위성사진`,
          caption: '출처: VWorld',
          source: 'satellite',
        });
      }
      if (Array.isArray(site?.images)) {
        for (const im of site.images.slice(0, 4)) {
          const u = typeof im === 'string' ? im : im?.url;
          if (!u) continue;
          candidates.push({
            url: String(u),
            alt: `${aptName} 단지 사진`,
            source: 'apt_images',
          });
        }
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
        alt: it.alt || post.title,
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
        p_image_kind: 'storage_real',
        p_alt_text: (cand.alt || post.title).slice(0, 200),
        p_caption: (cand.caption || `출처: ${cand.source}`).slice(0, 200),
        p_storage_path: res.storagePath,
      });
      result.storage_real++;
      if (position === 0) result.cover_url = res.url;
    } catch (err: any) {
      result.skipped++;
      result.failures.push(`record${position}:${err?.message || ''}`.slice(0, 120));
    }
  }

  // 3c) position 7: infographic OG — 세션 145 fix:
  //   1) real image 가 하나라도 성공했을 때만 infographic 부가 (단독 placeholder 금지)
  //   2) hydration 실패 시 raw /api/og URL 삽입 금지 — Storage 에 저장된 것만 기록
  if (includeInfo && result.storage_real > 0) {
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
  if (candidates.length === 0) {
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
  const scored = await scoreAndFilter(candidates, post, { threshold: opts.relevanceThreshold ?? 0.55 });
  if (scored.length === 0) {
    // threshold 아래면 fallback: host_trust 있는 naver 후보 top-N 강제 keep
    const fallback = candidates
      .filter((c) => c.source === 'satellite' || c.source === 'naver' || c.source === 'apt_images')
      .slice(0, 3)
      .map((c) => ({ ...c, score: 0.5, verdict: 'maybe' as const }));
    if (fallback.length === 0) {
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
    return hydrateAndRecord(admin, post, fallback, opts);
  }
  return hydrateAndRecord(admin, post, scored, opts);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
