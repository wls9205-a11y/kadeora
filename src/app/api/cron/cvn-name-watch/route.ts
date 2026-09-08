/**
 * CV-N N-2 — 수주·명명 이벤트 워처 (일 1회 · 백필 모드 겸 · 2026-09-08).
 *
 * big-event-news-detect 의 형제다. 다른 것은 «무엇을 찾는가» 뿐이다 —
 * 그쪽은 등록된 대형 이벤트의 후속 기사를, 여기는 «이름이 태어나는 순간» 을 찾는다.
 *
 * ── 이 크론이 따로 있어야 하는 이유 ─────────────────────────────────────────
 * ① 합성명은 어느 브랜드관에도 없다. 「더 다이너스티 가야」는 HDC·대우 컨소시엄이
 *    그 사업을 위해 만든 이름이라 브랜드관 목록에 실리지 않는다 — 뉴스가 유일 소스다.
 * ② 비부울경 정비 164건 중 137건이 시공사 공란이다. 브랜드관은 그 구멍을 못 메운다.
 *
 * ── 백필 모드 ───────────────────────────────────────────────────────────────
 * 표적(브랜드 별칭 없는 정비 → 시공사 공란)을 일 상한만큼 소화한다. 큐가 스스로 마르고
 * 나면 상시 감시만 남는다.
 * ⚠️ 「검색해도 안 나온다」는 결함이 아니라 «아직 시공사가 안 정해졌다» 는 대기 상태다.
 *    이걸 실패로 세면 그 현장을 매일 다시 두드리게 된다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { classifyNewsBatch, type NewsInput } from '@/lib/cvn/extract';
import { applyCandidate, loadSites, readSwitch } from '@/lib/cvn/apply';
import type { NameCandidateInput, SiteLite } from '@/lib/cvn/decide';

export const maxDuration = 300;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

/** 질의 축 — 「시공사 선정」·「수주」·「단지명 확정」·「계약 해지」 */
const QUERY_SUFFIX = ['시공사 선정', '단지명', '수주', '계약 해지'];

/**
 * 제목 프리필터. AI 에 넣기 «전» 에 값싸게 거른다.
 * ⚠️ 여기서 너무 좁히면 합성명 기사를 놓친다 — 「단지명」·「브랜드」도 통과시킨다.
 */
const PRE_KEYWORDS = [
  '시공사', '수주', '선정', '단지명', '브랜드', '확정', '해지', '취소', '변경', '컨소시엄', '입찰', '총회',
];

interface NewsItem {
  title: string;
  link: string;
  description: string;
  originallink?: string;
}

const stripHtml = (s: string): string =>
  (s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

async function searchNews(query: string, display = 10): Promise<NewsItem[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

/** 오늘 이미 쓴 AI 콜 수. 상한은 app_config(cvn.daily_ai_budget) 가 쥔다. */
async function spentToday(admin: any): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await admin
    .from('llm_usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('cron_name', 'cvn-name-watch')
    .gte('created_at', since);
  return count ?? 0;
}

const REDEV = /(재개발|재건축|촉진|정비사업|지구단위)/;

/** 정비형 현장 중 «브랜드 별칭이 없는» 것 → 시공사 공란 순으로 표적을 고른다. */
function pickTargets(sites: SiteLite[], brands: string[], limit: number): SiteLite[] {
  const hasBrand = (s: SiteLite) => {
    const hay = [s.display_name ?? '', s.name, ...(s.name_variants ?? [])].join(' ').replace(/\s/g, '');
    return brands.some((b) => hay.includes(b.replace(/\s/g, '')));
  };
  const redev = sites.filter((s) => REDEV.test(s.name));
  const noBrand = redev.filter((s) => !hasBrand(s));
  const builderBlank = noBrand.filter((s) => !s.builder || !s.builder.trim());
  const builderSet = noBrand.filter((s) => s.builder && s.builder.trim());
  // ⚠️ 시공사가 «있는데» 브랜드 별칭이 없는 쪽을 먼저 본다 — 이름이 이미 존재할 가능성이 높다.
  return [...builderSet, ...builderBlank].slice(0, limit);
}

async function handler(req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('cvn-name-watch', async () => {
      const admin = getSupabaseAdmin() as any;
      const sp = req.nextUrl.searchParams;
      const dry = sp.get('dry') === '1';

      if (!(await readSwitch(admin, 'watcher_enabled', true))) {
        return { processed: 0, metadata: { skipped: 'cvn.watcher_enabled = false' } };
      }
      if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
        return { processed: 0, metadata: { error: 'NAVER keys missing' } };
      }
      const autoApply = await readSwitch(admin, 'autoapply_enabled', false);

      const { data: budgetRow } = await admin
        .from('app_config').select('value').eq('namespace', 'cvn').eq('key', 'daily_ai_budget').maybeSingle();
      const budget = Number(budgetRow?.value ?? 40);
      const spent = await spentToday(admin);
      if (spent >= budget) {
        return { processed: 0, metadata: { skipped: `일 AI 상한 소진 ${spent}/${budget}` } };
      }

      const { data: brandRows } = await admin.from('brand_tokens').select('brand').eq('is_active', true);
      const brands = ((brandRows ?? []) as Array<{ brand: string }>).map((b) => b.brand);

      const sites = await loadSites(admin);
      const targetCount = Math.max(1, Math.min(30, Number(sp.get('targets') ?? '12')));
      const targets = pickTargets(sites, brands, targetCount);

      // 이미 본 URL — issue 계열과 «교차» 로 dedup 한다. 같은 기사를 두 번 사지 않는다.
      const { data: seenCand } = await admin
        .from('site_name_candidates').select('source_url').not('source_url', 'is', null).limit(4000);
      const seen = new Set(((seenCand ?? []) as Array<{ source_url: string }>).map((r) => r.source_url));
      const { data: seenIssue } = await admin
        .from('issue_alerts').select('source_urls').eq('source_type', 'cvn_name_event').limit(2000);
      for (const r of (seenIssue ?? []) as Array<{ source_urls: string[] | null }>) {
        for (const u of r.source_urls ?? []) seen.add(u);
      }

      const pool: Array<NewsInput & { site: SiteLite }> = [];
      let queries = 0;
      for (const site of targets) {
        const base = site.name.replace(/\s*(재개발|재건축|정비사업)\s*$/, '').trim();
        for (const suffix of QUERY_SUFFIX.slice(0, 2)) {
          queries += 1;
          const items = await searchNews(`${base} ${suffix}`, 8);
          for (const it of items) {
            const url = it.originallink || it.link;
            if (!url || seen.has(url)) continue;
            const title = stripHtml(it.title);
            if (!PRE_KEYWORDS.some((k) => title.includes(k))) continue;
            seen.add(url);
            pool.push({ title, description: stripHtml(it.description).slice(0, 300), url, site });
          }
        }
      }

      if (!pool.length) {
        return {
          processed: 0,
          metadata: {
            targets: targets.length, queries, pool: 0,
            message: '프리필터 통과 기사 없음 — 결함이 아니라 «아직 선정 전» 인 대기 상태다',
          },
        };
      }

      // ⚠️ 한 콜에 묶는다. 건당으로 쪼개면 일 상한이 순식간에 마른다.
      const batch = pool.slice(0, 40);
      const got = await classifyNewsBatch(batch.map(({ title, description, url }) => ({ title, description, url })));
      if (got.kind !== 'ok' || !got.value) {
        return { processed: 0, metadata: { error: `${got.kind} ${got.detail}`, pool: pool.length } };
      }

      const runId = `cvn-n2-${new Date().toISOString().slice(0, 10)}`;
      const byUrl = new Map(batch.map((b) => [b.url, b]));
      let applied = 0;
      let held = 0;
      const outcomes: any[] = [];

      for (const card of got.value) {
        const seed = byUrl.get(card.url);
        const input: NameCandidateInput = {
          proposedName: card.proposedName,
          eventType: card.eventType,
          source: 'news:naver',
          sourceUrl: card.url,
          projectName: card.projectName ?? seed?.site.name ?? null,
          sigungu: card.region ?? seed?.site.sigungu ?? null,
          region: card.region,
          builderRaw: card.builder,
          totalUnits: card.units,
          // 같은 회전에서 같은 (사업명, 예정명)을 말한 «다른» 기사 수.
          crossRefs: got.value.filter(
            (o) => o.url !== card.url && o.proposedName === card.proposedName,
          ).length,
        };

        if (dry) {
          outcomes.push({ name: card.proposedName, event: card.eventType, dry: true });
          continue;
        }

        const out = await applyCandidate(input, sites, { admin, runId, autoApply });
        if (out.wrote) applied += 1;
        if (out.resolution === 'held') held += 1;
        outcomes.push({ name: card.proposedName, event: card.eventType, tier: out.tier, res: out.resolution });

        // C 트랙 — 글감. ⛔ 초안은 여기서 쓰지 않는다. 기존 issue-draft 가 그 몫이다.
        await admin.from('issue_alerts').insert({
          title: `${input.projectName ?? card.proposedName} — ${card.proposedName}`.slice(0, 200),
          summary: seed?.description ?? null,
          category: 'apt',
          source_type: 'cvn_name_event',
          sub_category: card.eventType,
          source_urls: [card.url],
          detected_keywords: [card.proposedName, input.projectName ?? ''].filter(Boolean),
          apt_site_id: out.siteId,
          region_sigungu: card.region,
          // ⚠️ 점수를 «준다». 기본값 0 이면 issue-draft 의 문턱(≥25)에 걸려 P1 글감이
          //    한 건도 안 뽑힌다. 45 는 문턱(25)과 발행 임계(35) 위이면서, 사람이 만든
          //    고득점 이슈를 밀어낼 만큼 높지는 않은 자리다.
          base_score: 45,
          final_score: 45,
          raw_data: { tier: out.tier, resolution: out.resolution, builder: card.builder, units: card.units },
        });
      }

      return {
        processed: got.value.length,
        metadata: {
          targets: targets.length, queries, pool: pool.length, classified: got.value.length,
          applied, held, auto_apply: autoApply, shadow: !autoApply,
          budget: `${spent + 1}/${budget}`,
          outcomes: outcomes.slice(0, 30),
        },
      };
    }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
