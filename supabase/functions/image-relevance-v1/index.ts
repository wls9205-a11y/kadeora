/**
 * [CI-v1 Task 4] image-relevance-v1 — Supabase Edge Function
 *
 * 이미지 URL 이 주어진 컨텐츠 context 와 얼마나 관련 있는지 점수화 (0..1) + verdict.
 * blog-generate-images / apt-image-crawl / big-event-news-attach 등에서 hotlink 후보를
 * DB 에 저장하기 전 필터링 용도.
 *
 * Fast mode (기본 — AI 호출 없음):
 *   - host_trust      (0..1) : 한국 뉴스/CDN 화이트리스트 vs 블랙리스트
 *   - keyword_alt     (0..1) : alt/title 텍스트 내 키워드·엔티티 매칭 비율
 *   - keyword_url     (0..1) : URL 경로/쿼리 내 키워드 매칭 (한글 encoded 포함)
 *   - entity_match    (0..1) : 엔티티(고유명사) 매칭 강도
 *   - mime_ok/dim_ok  (bool) : 가능하면 HEAD 요청으로 검증 (실패시 null)
 *
 * Vision mode (옵션, mode='vision' + ANTHROPIC_API_KEY 필요):
 *   Claude Haiku vision 호출 → 실제 이미지 내용이 context 와 일치하는지 0..1 추가 점수.
 *
 * 최종:
 *   score = host_trust*0.30 + keyword_alt*0.30 + keyword_url*0.15 + entity_match*0.25
 *           (+ vision_score 있으면 가중 반영)
 *   verdict: >=0.6 keep | >=0.4 maybe | <0.4 reject
 *   블랙리스트 / MIME 거부 시 score=0, verdict=reject 강제.
 *
 * 요청:
 *   POST /image-relevance-v1
 *   Headers: Authorization: Bearer <SUPABASE_ANON or SERVICE_ROLE>
 *   Body:
 *     {
 *       image_url: string,
 *       image_alt?: string,
 *       image_title?: string,
 *       context: {
 *         title?: string,
 *         keywords?: string[],
 *         entities?: string[],
 *         category?: string,
 *         sub_category?: string
 *       },
 *       mode?: 'fast' | 'vision',
 *       skip_head?: boolean   // HEAD 요청 생략 (이미 fetch 완료한 경우)
 *     }
 *
 * 응답: { ok:true, score, verdict, signals, reasons[] } | { ok:false, error }
 */

// @ts-ignore — Deno runtime import
const VERSION = 'image-relevance-v1';

// ─────────── 화이트/블랙리스트 (blog pipeline 과 동기화) ───────────

const TRUSTED_HOST_FRAGMENTS: { frag: string; score: number; tag: string }[] = [
  // 한국 주요 뉴스 CDN — 최고 신뢰
  { frag: 'imgnews.pstatic.net', score: 1.0, tag: 'naver_news_cdn' },
  { frag: 'mimgnews.pstatic.net', score: 1.0, tag: 'naver_m_news_cdn' },
  { frag: 'pstatic.net', score: 0.9, tag: 'naver_cdn' },
  { frag: 'daumcdn.net', score: 0.9, tag: 'daum_cdn' },
  { frag: 't1.daumcdn.net', score: 0.95, tag: 'daum_news_cdn' },
  { frag: 'kakaocdn.net', score: 0.85, tag: 'kakao_cdn' },
  { frag: 'news.kbs.co.kr', score: 0.95, tag: 'kbs_news' },
  { frag: 'news.sbs.co.kr', score: 0.95, tag: 'sbs_news' },
  { frag: 'imgmbn.mbn.co.kr', score: 0.9, tag: 'mbn' },
  { frag: 'image.munhwa.com', score: 0.9, tag: 'munhwa' },
  { frag: 'news.mt.co.kr', score: 0.9, tag: 'mt_news' },
  { frag: 'cdn.newstof.com', score: 0.85, tag: 'generic_news' },
  { frag: 'storage.googleapis.com', score: 0.7, tag: 'gcs' },
  { frag: 'amazonaws.com', score: 0.7, tag: 's3' },
  { frag: 'supabase.co', score: 0.95, tag: 'own_storage' },
  { frag: 'supabase.in', score: 0.95, tag: 'own_storage' },
];

const BLOCKED_HOST_FRAGMENTS: string[] = [
  'utoimage', 'freepik', 'shutterstock', 'pixabay', 'unsplash', 'istockphoto',
  'namu.wiki', 'wikipedia.', 'youtube.com', 'pinimg.com', 'ohousecdn',
  'hogangnono', 'new.land.naver.com', 'landthumb', 'kbland', 'kbstar.com',
  'zigbang', 'dabang', 'dcinside', 'ruliweb.com', 'ppomppu.co.kr',
];

// 보수적 기본값 — 알려진 블로그 플랫폼은 중간 점수
const GENERIC_HOST_FALLBACK = 0.3;

function hostTrust(host: string): { score: number; tag: string } {
  const h = host.toLowerCase();
  for (const b of BLOCKED_HOST_FRAGMENTS) {
    if (h.includes(b)) return { score: 0, tag: `blocked:${b}` };
  }
  for (const t of TRUSTED_HOST_FRAGMENTS) {
    if (h.includes(t.frag)) return { score: t.score, tag: t.tag };
  }
  // 한국 .co.kr / .go.kr 가산
  if (h.endsWith('.go.kr')) return { score: 0.6, tag: 'korea_gov' };
  if (h.endsWith('.or.kr')) return { score: 0.45, tag: 'korea_org' };
  if (h.endsWith('.co.kr')) return { score: 0.4, tag: 'korea_co' };
  return { score: GENERIC_HOST_FALLBACK, tag: 'unknown_host' };
}

// ─────────── 텍스트 매칭 유틸 ───────────

function normalizeText(s: string): string {
  return (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z]+;/g, ' ')
    .replace(/[\s\-_·,.()\[\]【】「」『』'"／\/|]/g, ' ')
    .toLowerCase()
    .trim();
}

function tokenize(s: string): string[] {
  return normalizeText(s).split(/\s+/).filter((t) => t.length >= 2);
}

function decodeUrlParts(url: string): string {
  try {
    // path + query, 한글 %xx 디코딩
    const u = new URL(url);
    const raw = u.pathname + ' ' + u.search;
    return decodeURIComponent(raw);
  } catch {
    return url;
  }
}

/**
 * 후보 토큰이 타겟 문자열에 포함될 때 그 비율 계산 (0..1).
 * 엔티티(길이 2+ 한글/영문 단어)가 포함되면 가중치 높게.
 */
function matchRatio(targets: string[], haystack: string): { ratio: number; matched: string[] } {
  if (targets.length === 0 || !haystack) return { ratio: 0, matched: [] };
  const hay = normalizeText(haystack);
  const matched: string[] = [];
  for (const t of targets) {
    const nt = normalizeText(t);
    if (nt.length < 2) continue;
    if (hay.includes(nt)) matched.push(t);
  }
  return { ratio: Math.min(1, matched.length / Math.max(1, targets.length)), matched };
}

// ─────────── HEAD 요청 (선택) ───────────

async function probeImage(url: string, timeoutMs = 4000): Promise<{
  status?: number;
  mime?: string;
  bytes?: number;
  error?: string;
}> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: ctl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KadeoraImageRelevance/1.0)',
          Accept: 'image/*',
        },
      });
      const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const bytes = Number(res.headers.get('content-length') || 0) || undefined;
      return { status: res.status, mime, bytes };
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    return { error: (e as Error)?.message || 'head_failed' };
  }
}

// ─────────── Vision mode (옵션) ───────────

async function visionScore(
  imageUrl: string,
  context: { title?: string; keywords?: string[]; entities?: string[]; category?: string },
): Promise<{ score: number | null; notes?: string; error?: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return { score: null, error: 'no_api_key' };

  const system = `당신은 한국 금융·부동산 콘텐츠 편집자입니다. 주어진 이미지가 다음 기사 맥락과 얼마나 관련 있는지 0~1 점수로 판정합니다.

응답 형식 (JSON 만):
{
  "score": 0~1 소수 (2자리),
  "notes": "한 줄 근거"
}

판단 기준:
- 0.8+: 이미지가 기사 주제(단지·종목·지역)와 직접 일치
- 0.5-0.79: 카테고리는 맞으나 특정 주제는 불분명
- 0.2-0.49: 카테고리만 맞음 (일반 stock photo)
- 0-0.19: 무관 / 낚시 / 저품질`;

  const ctxLines = [
    `제목: ${context.title || '(없음)'}`,
    `카테고리: ${context.category || '(없음)'}`,
    `키워드: ${(context.keywords || []).slice(0, 8).join(', ')}`,
    `대상: ${(context.entities || []).slice(0, 5).join(', ')}`,
  ].join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'url', url: imageUrl },
              },
              { type: 'text', text: `맥락:\n${ctxLines}\n\nJSON 만 응답하세요.` },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { score: null, error: `claude_${res.status}` };
    const data = await res.json();
    const text: string = data?.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const sc = Number(parsed?.score);
    if (!Number.isFinite(sc)) return { score: null, error: 'parse' };
    return { score: Math.max(0, Math.min(1, sc)), notes: String(parsed?.notes || '').slice(0, 140) };
  } catch (e) {
    return { score: null, error: (e as Error)?.message || 'vision_exc' };
  }
}

// ─────────── CORS ───────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ─────────── 핵심 스코어링 ───────────

interface RelevanceInput {
  image_url: string;
  image_alt?: string;
  image_title?: string;
  context: {
    title?: string;
    keywords?: string[];
    entities?: string[];
    category?: string;
    sub_category?: string;
  };
  mode?: 'fast' | 'vision';
  skip_head?: boolean;
}

async function scoreImage(body: RelevanceInput) {
  const reasons: string[] = [];
  const signals: Record<string, unknown> = {};

  const { image_url, image_alt = '', image_title = '', context = {}, mode = 'fast', skip_head = false } = body;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(image_url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { ok: false, error: 'invalid_protocol', image_url };
    }
  } catch {
    return { ok: false, error: 'invalid_url', image_url };
  }

  // 1) host trust
  const { score: host_trust, tag: host_tag } = hostTrust(parsedUrl.host);
  signals.host = parsedUrl.host;
  signals.host_tag = host_tag;
  signals.host_trust = host_trust;
  reasons.push(`host=${host_tag}(${host_trust.toFixed(2)})`);

  if (host_trust === 0) {
    return {
      ok: true,
      score: 0,
      verdict: 'reject' as const,
      signals,
      reasons: [...reasons, 'blocked_domain_override'],
      mode,
    };
  }

  // 2) keyword / entity pools
  const keywords = Array.isArray(context.keywords) ? context.keywords.filter(Boolean).slice(0, 12) : [];
  const entities = Array.isArray(context.entities) ? context.entities.filter(Boolean).slice(0, 8) : [];
  const titleTokens = context.title ? tokenize(context.title).slice(0, 12) : [];
  const pool = Array.from(new Set([...keywords, ...entities, ...titleTokens])).slice(0, 20);

  if (pool.length === 0) {
    // 컨텍스트가 비었으면 host_trust 만 가중
    const score = Math.min(1, host_trust * 0.8);
    const verdict = score >= 0.6 ? 'keep' : score >= 0.4 ? 'maybe' : 'reject';
    return {
      ok: true,
      score: Number(score.toFixed(3)),
      verdict,
      signals,
      reasons: [...reasons, 'no_context_pool'],
      mode,
    };
  }

  // 3) alt/title match
  const altText = `${image_alt} ${image_title}`.trim();
  const altMatch = matchRatio(pool, altText);
  signals.keyword_alt = altMatch.ratio;
  signals.keyword_alt_hits = altMatch.matched;
  if (altMatch.matched.length > 0) reasons.push(`alt_match=${altMatch.matched.slice(0, 3).join(',')}`);

  // 4) url match (pathname + query, decoded)
  const urlText = decodeUrlParts(image_url);
  const urlMatch = matchRatio(pool, urlText);
  signals.keyword_url = urlMatch.ratio;
  signals.keyword_url_hits = urlMatch.matched;
  if (urlMatch.matched.length > 0) reasons.push(`url_match=${urlMatch.matched.slice(0, 3).join(',')}`);

  // 5) entity match (엔티티 전용)
  const entityMatch = entities.length > 0
    ? matchRatio(entities, `${altText} ${urlText}`)
    : { ratio: 0, matched: [] };
  signals.entity_match = entityMatch.ratio;
  signals.entity_hits = entityMatch.matched;
  if (entityMatch.matched.length > 0) reasons.push(`entity=${entityMatch.matched.slice(0, 3).join(',')}`);

  // 6) HEAD probe (선택)
  if (!skip_head) {
    const head = await probeImage(image_url, 4000);
    signals.head = head;
    if (head.mime && !head.mime.startsWith('image/')) {
      return {
        ok: true,
        score: 0,
        verdict: 'reject' as const,
        signals,
        reasons: [...reasons, `mime_rejected:${head.mime}`],
        mode,
      };
    }
    if (head.bytes && head.bytes < 5_000) {
      reasons.push(`tiny_bytes:${head.bytes}`);
    }
  }

  // 7) fast score
  const fastScore =
    host_trust * 0.30
    + altMatch.ratio * 0.30
    + urlMatch.ratio * 0.15
    + entityMatch.ratio * 0.25;

  let finalScore = Math.max(0, Math.min(1, fastScore));

  // 8) vision (옵션)
  if (mode === 'vision') {
    const vis = await visionScore(image_url, context);
    signals.vision_score = vis.score;
    signals.vision_notes = vis.notes;
    signals.vision_error = vis.error;
    if (vis.score !== null) {
      // vision 은 최종 점수의 60% 가중, fast 40%
      finalScore = Math.max(0, Math.min(1, fastScore * 0.4 + vis.score * 0.6));
      reasons.push(`vision=${vis.score.toFixed(2)}`);
    } else if (vis.error) {
      reasons.push(`vision_fallback:${vis.error}`);
    }
  }

  finalScore = Number(finalScore.toFixed(3));
  const verdict: 'keep' | 'maybe' | 'reject' =
    finalScore >= 0.6 ? 'keep' : finalScore >= 0.4 ? 'maybe' : 'reject';

  return {
    ok: true as const,
    version: VERSION,
    score: finalScore,
    verdict,
    signals,
    reasons,
    mode,
  };
}

// ─────────── Deno.serve ───────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed', hint: 'use POST' }, 405);
  }

  let body: RelevanceInput;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  if (!body?.image_url) {
    return jsonResponse({ ok: false, error: 'image_url_required' }, 400);
  }
  if (!body.context || typeof body.context !== 'object') {
    body.context = {};
  }

  try {
    const result = await scoreImage(body);
    return jsonResponse(result, 200);
  } catch (e) {
    return jsonResponse({ ok: false, error: 'internal', detail: (e as Error)?.message || 'unknown' }, 500);
  }
});
