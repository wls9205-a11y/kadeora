import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { verifyCronAuth } from '@/lib/cron-auth';
import {
  autoApplicable,
  judgeField,
  queueStats,
  queueTier,
  type Claim,
  type OriginKind,
  type QueueSite,
} from '@/lib/verify/facts';

export const maxDuration = 300;
export const runtime = 'nodejs';

/** §6 중단점 B — 첫 배치는 20건이다. 그 뒤는 리뷰를 통과해야 늘린다. */
const DEFAULT_LIMIT = 20;
const TIME_BUDGET_MS = 250_000;
/** 네이버 검색 실측 여유: keyword_rank_daily 가 하루 ~160콜을 쓴다. 현장당 2콜이면 20건=40콜. */
const NAVER_THROTTLE_MS = 120;
const MODEL = 'claude-haiku-4-5-20251001';

/**
 * PV-5 — 후검증(V). 기존 데이터가 «맞는지» 되짚는다 (§6 · D4 · D6).
 *
 * ── 이 라우트가 «하지 않는» 것 ──────────────────────────────────────────────
 * ⛔ 블로그 본문을 건드리지 않는다(규칙).
 * ⛔ D4 밖 필드를 자동으로 쓰지 않는다 — 세대수·가격·stage·slug 는 verified 여도 검수 큐다.
 *    slug 는 색인 자산이라 어떤 경우에도 불변이다.
 * ⛔ 값이 갈리면 «고르지 않는다». conflicting 으로 남기고 사람에게 넘긴다.
 *
 * ── 판정의 핵심 (판정부는 src/lib/verify/facts.ts · Rule #116) ───────────────
 * 「독립 출처」는 매체 «수» 가 아니라 원출처 «수» 다. 같은 보도자료를 받아쓴 기사
 * 12건은 출처 1개이고, 그것만 있으면 verified 가 «될 수 없다»(rumor).
 *
 * ── 실행 ────────────────────────────────────────────────────────────────────
 *   ?dry=1      검색·추출·판정까지. DB 에 쓰지 않는다
 *   ?limit=20   이번 배치 크기 (중단점 B 전에는 20 고정 권장)
 *   ?slug=...   한 현장만 (디버깅)
 */
interface SiteRow {
  id: string; slug: string; name: string; display_name: string | null;
  builder: string | null; region: string | null; sigungu: string | null;
  lifecycle_stage: string | null; stage_source: string | null;
  source_ids: unknown; curated_copy: string | null;
}

async function naverSearch(kind: 'news' | 'webkr', query: string): Promise<Array<Record<string, string>>> {
  const id = process.env.NAVER_CLIENT_ID, sec = process.env.NAVER_CLIENT_SECRET;
  if (!id || !sec) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/${kind}?query=${encodeURIComponent(query)}&display=10&sort=sim`,
      { headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': sec }, signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j?.items) ? j.items : [];
  } catch {
    return [];
  }
}

/**
 * ⛔ `.limit()` 은 PostgREST 의 «서버 캡» 을 넘지 못한다(기본 1,000행).
 *    2026-08-29 에 이 실수를 하루 «세 번» 했다 — ad_keywords slug 캐리(4,273건 증발),
 *    그리고 이 파일의 초판이 두 번째·세 번째였다. limit 을 크게 적는 것은 «확인이 아니다».
 *    큐를 1,000행으로 자르면 파워링크 착지 578 이 그 안에 있는지조차 알 수 없다.
 */
async function fetchAll<T>(
  sb: any, table: string, columns: string, tune?: (q: any) => any, page = 1000, max = 50_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += page) {
    let q = sb.from(table).select(columns).range(from, from + page - 1);
    if (tune) q = tune(q);
    const { data, error } = await q;
    if (error) break;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

const strip = (s: string) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim();

/**
 * 검색 결과에서 «주장» 을 뽑는다. 추출만 시키고 판정은 시키지 않는다 —
 * 판정을 모델에 맡기면 「독립 출처」 규칙이 프롬프트 안에서 조용히 흐려진다.
 */
/** 추출 단계에서만 쓰는 형태 — 어느 «필드» 에 대한 주장인지를 달고 다닌다. */
type ExtractedClaim = Claim & { field: string };

async function extractClaims(site: SiteRow, snippets: string[]): Promise<ExtractedClaim[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || snippets.length === 0) return null;

  const system = `당신은 한국 부동산 기사에서 «사실 주장» 만 뽑는 추출기입니다.
판정하지 마세요. 점수도 매기지 마세요. 오직 «누가 무엇을 말했는가» 만 뽑습니다.

대상 필드 3개만:
  display_name  단지 브랜드명(펫네임). 예: "래미안 마크 더 스위트"
  builder       시공사. 예: "삼성물산"
  total_units   총 세대수(숫자만)

각 주장마다 원출처 종류를 고르세요:
  disclosure   전자공시·공시자료를 인용
  union        조합 공고·총회 자료를 인용
  builder      시공사 공식 발표·분양 페이지를 인용
  announcement 입주자모집공고(청약홈)를 인용
  press        위 어느 것도 인용하지 않은 «언론 보도»

⚠️ 기사가 「~로 알려졌다」 「업계에 따르면」 이면 press 입니다.
⚠️ 확실하지 않으면 그 주장을 «빼세요». 지어내지 마세요.

JSON 배열만 반환:
[{"field":"builder","value":"삼성물산","kind":"disclosure","originKey":"2021-06 수주공시","publishedAt":"2021-06-15"}]
없으면 []`;

  const user = `현장: ${site.name}${site.display_name ? ` (${site.display_name})` : ''}
지역: ${site.region ?? ''} ${site.sigungu ?? ''}

검색 결과:
${snippets.slice(0, 12).map((s, i) => `[${i + 1}] ${s}`).join('\n')}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system, messages: [{ role: 'user', content: user }] }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text = j?.content?.[0]?.text ?? '';
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return null;
    const arr = JSON.parse(m[0]) as Array<Record<string, unknown>>;
    const KINDS: OriginKind[] = ['disclosure', 'union', 'builder', 'announcement', 'permit', 'press'];
    return arr
      .filter((x) => typeof x.field === 'string' && KINDS.includes(x.kind as OriginKind))
      .map((x) => ({
        field: x.field as string,
        value: (x.value as string | number) ?? null,
        kind: x.kind as OriginKind,
        originKey: (x.originKey as string) ?? null,
        publishedAt: (x.publishedAt as string) ?? null,
      }));
  } catch {
    return null;
  }
}

async function handler(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dryRun = sp.get('dry') === '1';
  const slug = sp.get('slug');
  const limit = Math.max(1, Math.min(100, Number(sp.get('limit')) || DEFAULT_LIMIT));

  if (!process.env.NAVER_CLIENT_ID || !process.env.ANTHROPIC_API_KEY) {
    // ⚠️ 「자격이 없다」와 「돌았는데 0건」은 다른 사실이다.
    return { processed: 0, metadata: { skipped: 'NAVER_CLIENT_ID or ANTHROPIC_API_KEY not set' } };
  }

  const sb = getSupabaseAdmin();
  const started = Date.now();

  // ── 큐 구성 ── 파워링크 착지·리드는 «다른 표» 에 있으므로 먼저 모아 온다.
  const adSlugs = new Set<string>();
  const leadSlugs = new Set<string>();
  {
    const ad = await fetchAll<{ site_slug: string }>(sb, 'ad_keywords', 'site_slug',
      (q) => q.not('site_slug', 'is', null));
    for (const r of ad) adSlugs.add(r.site_slug);
    const ld = await fetchAll<{ site_slug: string }>(sb, 'leads', 'site_slug',
      (q) => q.not('site_slug', 'is', null));
    for (const r of ld) leadSlugs.add(r.site_slug);
  }

  const SITE_COLS = 'id,slug,name,display_name,builder,region,sigungu,lifecycle_stage,stage_source,source_ids,curated_copy';
  const sites = await fetchAll<SiteRow>(sb, 'apt_sites', SITE_COLS,
    (q) => (slug ? q.eq('is_active', true).eq('slug', slug) : q.eq('is_active', true)));

  const toQueueSite = (s: SiteRow): QueueSite => ({
    slug: s.slug,
    adLanding: adSlugs.has(s.slug),
    curated: Boolean(s.curated_copy),
    lifecycleStage: s.lifecycle_stage,
    stageSource: s.stage_source,
    noSourceIds: !s.source_ids || JSON.stringify(s.source_ids) === '{}',
    hasLead: leadSlugs.has(s.slug),
  });

  const stats = queueStats(sites.map(toQueueSite), limit);
  // ⚠️ 이미 본 현장을 다시 보지 않는다 — 큐가 앞머리에서 맴돌면 뒤 층은 영원히 안 온다.
  const done = await fetchAll<{ site_id: string }>(sb, 'apt_fact_checks', 'site_id',
    (q) => q.gte('checked_at', new Date(Date.now() - 30 * 86400_000).toISOString()));
  const seen = new Set(done.map((r) => r.site_id));

  const queue = sites
    .filter((s) => slug || !seen.has(s.id))
    .map((s) => ({ s, rank: queueTier(toQueueSite(s)) }))
    .sort((a, b) => {
      const order = ['ad_landing', 'curated', 'pre_ann_urgent', 'pre_ann', 'lead', 'rest'];
      return order.indexOf(a.rank) - order.indexOf(b.rank);
    })
    .slice(0, limit);

  const FIELDS = ['display_name', 'builder', 'total_units'] as const;
  let naverCalls = 0, claimsFound = 0, recorded = 0, applied = 0, extractFails = 0;
  const verdictCount: Record<string, number> = {};
  const rows: Array<Record<string, unknown>> = [];
  const applyOps: Array<{ id: string; field: string; value: string }> = [];
  let stoppedBy: 'plan' | 'time' = 'plan';

  for (const { s } of queue) {
    if (Date.now() - started > TIME_BUDGET_MS) { stoppedBy = 'time'; break; }

    // §6: "{구역명} 시공사/단지명" 축으로 묻는다.
    const base = s.display_name || s.name;
    const news = await naverSearch('news', `${base} 시공사`); naverCalls++;
    await new Promise((r) => setTimeout(r, NAVER_THROTTLE_MS));
    const web = await naverSearch('webkr', `${base} 단지명 세대수`); naverCalls++;
    await new Promise((r) => setTimeout(r, NAVER_THROTTLE_MS));

    const snippets = [...news, ...web]
      .map((it) => `${strip(it.title)} — ${strip(it.description)}`)
      .filter((t) => t.length > 10);

    const claims = await extractClaims(s, snippets);
    if (claims === null) { extractFails++; continue; }
    claimsFound += claims.length;

    for (const field of FIELDS) {
      const fieldClaims: Claim[] = claims.filter((c) => c.field === field);
      if (fieldClaims.length === 0) continue;
      const v = judgeField(fieldClaims);
      verdictCount[v.confidence] = (verdictCount[v.confidence] ?? 0) + 1;

      rows.push({
        site_id: s.id, field, verdict: v.confidence,
        value: v.value === null ? null : String(v.value),
        independent_sources: v.independentSources,
        note: v.note,
        claims: fieldClaims,
      });

      // ⛔ D4 경계 — 이름·변형·시공사만, 그것도 verified 일 때만.
      if (autoApplicable(field, v) && v.value !== null) {
        applyOps.push({ id: s.id, field, value: String(v.value) });
      }
    }
  }

  if (!dryRun && rows.length > 0) {
    const { error } = await (sb as any).from('apt_fact_checks').insert(rows);
    if (!error) recorded = rows.length;
    for (const op of applyOps) {
      const { error: e2 } = await (sb as any).from('apt_sites').update({ [op.field]: op.value }).eq('id', op.id);
      if (!e2) applied++;
    }
  }

  return {
    processed: queue.length,
    created: recorded,
    failed: extractFails,
    metadata: {
      dry_run: dryRun,
      // ⚠️ 모집단을 «함께» 낸다. 1,000 이면 서버 캡을 본 것이다(오늘의 공리).
      queue_size: sites.length,
      ad_landing_slugs: adSlugs.size,
      already_checked_30d: seen.size,
      batch: queue.length,
      // ⚠️ 앞 층이 두꺼우면 뒤 층이 굶는다 — 그 사실을 매 실행마다 낸다.
      queue_tiers: stats,
      naver_calls: naverCalls,
      claims_found: claimsFound,
      extract_fails: extractFails,
      verdicts: verdictCount,
      // D4 자동 반영은 «세어서» 남긴다. 조용히 쓰지 않는다.
      auto_applied: dryRun ? 0 : applied,
      auto_apply_planned: applyOps.length,
      elapsed_ms: Date.now() - started,
      stopped_by: stoppedBy,
    },
  };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await withCronLogging('verify-facts', () => handler(req));
  return NextResponse.json(result);
}
