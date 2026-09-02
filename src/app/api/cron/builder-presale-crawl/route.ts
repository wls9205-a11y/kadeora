/**
 * CV-1 — 시공사 분양예정 목록 → presale_candidates → 매칭 또는 자동 시드 (2026-09-02).
 *
 * ── 이 크론이 «고치는» 것 ───────────────────────────────────────────────────
 * builder-site-sync 는 인리치 전용이라 «미매칭 카드를 기록 없이 버린다».
 * 태영 공식에 김해 외동(1,135세대)이 떠 있는데 DB 에 레코드가 없던 이유가 그것이다 —
 * 페이지가 없으니 키워드도 없고, 광고에 나갈 수가 없다.
 *
 * ── 이 크론이 «하지 않는» 것 ────────────────────────────────────────────────
 * ⛔ 광고 계정에 손대지 않는다. sa-sync 는 CV-5 이고 9/6 이후다.
 * ⛔ builder-site-sync 를 건드리지 않는다. 역할이 다르다(그쪽 이미지·별칭, 이쪽 스테이징).
 * ⛔ 기존 행의 name_variants·builder 를 «쓰지 않는다». 그 컬럼의 기록자는 builder-site-sync
 *    하나다. 같은 컬럼에 규칙이 둘이면 매일 뒤에 도는 쪽이 이긴다 — H7-2 가 그 사고다.
 * ⛔ expected_sale_period 도 쓰지 않는다. 실측상 이 소스가 주는 것은 «공사기간»
 *    (「2025년 09월 ~ 2030년 1월」)이고, 그 컬럼의 형식 제약은 `YYYY(-MM|H1|Q1)` 이다.
 *    형식에 억지로 맞추면 없는 분양시기를 지어내는 것이 된다.
 * ⛔ matched 행은 «기록만» 한다. 세대수·stage·slug 는 검수 큐 몫이다(D4 경계).
 *
 * ── 실행 ────────────────────────────────────────────────────────────────────
 *   ?dry=1                    추출·매칭·판정까지. DB 에 «아무것도 쓰지 않는다»
 *   ?source=desian:presale    소스 하나만
 *   ?model=claude-sonnet-5    섀도 평가 — «같은 입력» 을 다른 모델에 태워 판정 일치율을 잰다.
 *                             ⚠️ `dry=1` 과 함께 쓴다. 허용 목록 밖 값은 기본 모델로 접힌다
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { verifyCronAuth } from '@/lib/cron-auth';
import { PRESALE_SOURCES, type PresaleSource } from '@/lib/builder-sites/presale-registry';
import { extractCards, fetchListHtml, type ExtractedCard } from '@/lib/presale/extract';
import {
  adBlockedFor, isProvisional, judgeSupplyType, normName, provisionalSlug,
  isSameArea, isSameSiteHint, seedGate, similarKey, stripProvisional, type SupplyType,
} from '@/lib/presale/candidate';
import { tally } from '@/lib/net/outcome';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * 한 번에 만드는 새 현장 수의 상한.
 * ⚠️ 상한이 없으면 소스 하나가 잘못 읽힌 날 «수십 개의 빈 페이지» 가 한꺼번에 생긴다.
 *    되돌릴 일이 생겼을 때 사람이 감당할 수 있는 양이어야 한다(G-3 과 같은 결).
 */
const SEED_CAP = 5;
const TIME_BUDGET_MS = 250_000;

type Resolution = 'matched' | 'seeded' | 'queued';
type MatchMethod = 'name' | 'variants' | 'addr' | 'none';

interface SiteRow {
  id: string; slug: string; name: string; display_name: string | null;
  name_variants: unknown; address: string | null; sigungu: string | null; region: string | null;
}

/** 후보 하나의 처리 결과 — 응답·다이제스트에 그대로 실린다. */
interface Decision {
  source: string;
  rawName: string;
  region: string | null;
  units: number | null;
  supplyType: SupplyType;
  resolution: Resolution;
  matchMethod: MatchMethod;
  matchedSlug?: string;
  seededSlug?: string;
  note: string;
}

/** 지번 앞의 「동」 이름. 「… 외동 705번지 일원」 → 외동 */
function dongOf(addr: string | null | undefined): string | null {
  const m = String(addr ?? '').match(/([가-힣]+(?:동|리|가))\s+(?:산\s*)?\d/);
  return m ? m[1] : null;
}

/** 「705-1」「705」 — 지번. 없으면 null. */
function jibunOf(addr: string | null | undefined): string | null {
  const m = String(addr ?? '').match(/[가-힣]+(?:동|리|가)\s+(?:산\s*)?(\d+(?:-\d+)?)/);
  return m ? m[1] : null;
}

function namesOf(s: SiteRow): string[] {
  const vs = Array.isArray(s.name_variants) ? (s.name_variants as unknown[]) : [];
  return [s.name, s.display_name, ...vs.filter((v): v is string => typeof v === 'string')]
    .filter((v): v is string => !!v);
}

/**
 * 후보 ↔ 기존 현장 매칭.
 * ⛔ «부분 문자열로 붙이지 않는다» — 느슨한 이름 매칭이 「문수로대공원 에일린의 뜰」을
 *    「그랑라크」로 잡았던 것이 그 사고다. 정확 일치(정규화 후) 또는 「같은 동 + 같은 지번」만이다.
 * ⛔ 후보가 2건 이상이면 «고르지 않는다»(a5 의 「2건 이상이면 null」). 큐로 보낸다.
 *
 * ⚠️ 주소축의 «알려진 한계» — 같은 현장이 지번을 둘 쓴다.
 *    실측(2026-09-02 Node 교차검증): 「서면 어반센트 데시앙」은 공식 모델하우스
 *    사업개요가 «부암동 705-1», 언론·분양자료가 «부암동 690-8» 을 쓴다. 둘 다 실재하는
 *    표기다. 지번 정확일치는 이 쌍을 «못 붙인다» — 그래도 느슨하게 풀지 않는다.
 *    지번을 느슨히 보면 서로 다른 필지가 같은 현장으로 붙는다(택지지구가 특히 그렇다).
 *    이 형태는 이름축이 잡거나, 아니면 큐에서 사람이 본다. 그것이 옳은 실패다.
 */
function matchSite(card: ExtractedCard, pool: SiteRow[]): { site: SiteRow | null; method: MatchMethod } {
  const key = normName(stripProvisional(card.rawName));
  if (!key) return { site: null, method: 'none' };

  const exact = pool.filter((s) => normName(s.name) === key || normName(s.display_name ?? '') === key);
  if (exact.length === 1) return { site: exact[0], method: 'name' };
  if (exact.length > 1) return { site: null, method: 'none' };

  const viaVariants = pool.filter((s) => namesOf(s).some((n) => normName(n) === key));
  if (viaVariants.length === 1) return { site: viaVariants[0], method: 'variants' };
  if (viaVariants.length > 1) return { site: null, method: 'none' };

  const dong = dongOf(card.addrRaw), jibun = jibunOf(card.addrRaw);
  if (dong && jibun) {
    const viaAddr = pool.filter((s) => dongOf(s.address) === dong && jibunOf(s.address) === jibun);
    if (viaAddr.length === 1) return { site: viaAddr[0], method: 'addr' };
  }
  return { site: null, method: 'none' };
}

async function handler(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dry = sp.get('dry') === '1';
  const only = sp.get('source');
  // 섀도 평가(Node 판정 ②). 허용 목록 밖 값은 extract 쪽에서 기본 모델로 접힌다.
  const modelOverride = sp.get('model');
  const started = Date.now();
  const admin = getSupabaseAdmin() as any;
  const net = tally();

  const sources = PRESALE_SOURCES.filter((s) => !only || s.key === only);
  const decisions: Decision[] = [];
  const health: Array<Record<string, unknown>> = [];
  let seeded = 0;
  let stoppedBy: string | null = null;

  for (const src of sources) {
    if (Date.now() - started > TIME_BUDGET_MS) { stoppedBy = 'time_budget'; break; }

    // ⚠️ 소스 하나의 실패가 «크론 전체를 죽이지 않게» 격리한다. 그날 다른 소스의
    //    신규 현장이 통째로 사라지는 것이 이 트랙이 고치려는 병이다.
    let cards: ExtractedCard[] = [];
    let outcome = 'ok', detail = '';
    try {
      const page = net.add(await fetchListHtml(src), `${src.key} fetch`);
      if (page.kind !== 'ok' || !page.value) {
        outcome = page.kind; detail = page.detail;
      } else {
        const ex = net.add(await extractCards(src, page.value, { modelOverride }), `${src.key} extract`);
        if (ex.kind === 'ok' && ex.value) cards = ex.value;
        else { outcome = ex.kind; detail = ex.detail; }
      }
    } catch (e) {
      outcome = 'call_failed'; detail = String(e).slice(0, 120);
    }

    // ── R1 어댑터 부패 감시 ────────────────────────────────────────────────
    // ⛔ 0카드를 «성공» 으로 적지 않는다. 침묵 성공이 이 트랙의 구조 결함 ③이다.
    health.push({ source_key: src.key, cards: cards.length, outcome, detail });
    if (!dry) await bumpHealth(admin, src, cards.length, outcome, detail);
    if (cards.length === 0) continue;

    // 매칭 풀 — 시군구(없으면 시도)로 좁힌다. 전수 비교는 오매칭의 온상이다.
    const pool = await loadPool(admin, cards);

    const pending: Array<{
      card: ExtractedCard; supplyType: SupplyType; resolution: Resolution;
      method: MatchMethod; site: SiteRow | null; seededSlug?: string; note: string;
    }> = [];

    for (const card of cards) {
      const supplyType = judgeSupplyType(card.rawName, card.addrRaw, src.brand);
      const { site, method } = matchSite(card, pool);

      let resolution: Resolution = 'queued';
      let note = '';
      let seededSlug: string | undefined;

      if (site) {
        resolution = 'matched';
        note = `기존 현장에 붙음 (${method})`;
      } else {
        const gate = seedGate(card);
        if (!gate.seed) {
          note = gate.reason;
        } else if (seeded >= SEED_CAP) {
          note = `시드 상한 ${SEED_CAP} 도달 — 다음 실행으로 이월`;
        } else {
          // ⚠️ 시드 «직전» 유사명 검색. 대연3 ↔ 디아이엘 재발 방지 —
          //    비슷한 이름이 있으면 만들지 «않고» 병합 제안으로 큐에 남긴다.
          // ⚠️ 울타리는 «그 카드의 지역» 이다(CV-B ②). loadPool 은 소스의 모든 카드
          //    시군구·시도를 «합친» 풀이라, 울타리가 없으면 고창(전북) 카드에 창원(경남)
          //    2건이 유사 후보로 걸린다 — CV-A 본실행에서 실제로 그랬다.
          const near = pool.filter((s) => isSameArea(card, s) && namesOf(s).some((n) => {
            const a = normName(n), b = similarKey(card.rawName);
            return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
          }));
          if (near.length > 0) {
            note = `유사 현장 존재 — 병합 검토: ${near.map((n) => n.slug).slice(0, 3).join(', ')}`;
          } else if (dry) {
            resolution = 'seeded';
            seededSlug = provisionalSlug(card.rawName);
            note = '(dry) 시드 예정';
            seeded++;
          } else {
            const made = await seedSite(admin, src, card, supplyType);
            if (made.ok) {
              resolution = 'seeded'; seededSlug = made.slug; seeded++;
              note = `신규 시드 — ${supplyType}${adBlockedFor(supplyType) ? ' · 광고 부적격' : ''}`;
            } else {
              note = `시드 실패: ${made.error}`;
            }
          }
        }
      }

      pending.push({ card, supplyType, resolution, method, site, seededSlug, note });
    }

    // ⚠️ 소스 «안» 의 상호 대조(CV-B ③). 카드를 DB 풀하고만 맞추면 같은 목록에 사업명과
    //    브랜드명으로 두 번 올라온 현장을 못 본다 — 동탄 A78BL ↔ 자연&데시앙.
    //    붙이지는 않는다. 큐로 가는 카드에 «같은 소스 안의 짝» 을 적어 사람이 보게 한다.
    for (const p of pending) {
      if (p.resolution !== 'queued') continue;
      const twins = pending.filter((q) => q !== p && isSameSiteHint(p.card, q.card));
      if (twins.length === 0) continue;
      const label = twins
        .map((q) => `${q.card.rawName}${q.seededSlug ? ` → ${q.seededSlug}` : ''}(${q.resolution})`)
        .slice(0, 2).join(', ');
      p.note = `${p.note ? `${p.note} · ` : ''}같은 소스 안의 동일 현장 후보(세대수 ${p.card.totalUnits}): ${label}`;
    }

    for (const p of pending) {
      decisions.push({
        source: `crawl:${src.key}`, rawName: p.card.rawName, region: p.card.region ?? null,
        units: p.card.totalUnits ?? null, supplyType: p.supplyType, resolution: p.resolution,
        matchMethod: p.method, matchedSlug: p.site?.slug, seededSlug: p.seededSlug, note: p.note,
      });

      if (!dry) {
        await upsertCandidate(admin, src, p.card, {
          supplyType: p.supplyType, resolution: p.resolution, matchMethod: p.method,
          matchedSiteId: p.site?.id ?? null, seededSlug: p.seededSlug, note: p.note,
        });
      }
    }
  }

  return {
    success: true,
    processed: decisions.length,
    details: {
      dry,
      model_override: modelOverride,
      sources: sources.length,
      health,
      seeded,
      by_resolution: decisions.reduce<Record<string, number>>((a, d) => {
        a[d.resolution] = (a[d.resolution] ?? 0) + 1; return a;
      }, {}),
      by_supply_type: decisions.reduce<Record<string, number>>((a, d) => {
        a[d.supplyType] = (a[d.supplyType] ?? 0) + 1; return a;
      }, {}),
      decisions,
      net: net.counts,
      net_samples: net.samples,
      elapsed_ms: Date.now() - started,
      stopped_by: stoppedBy,
    },
  };
}

/** 매칭 풀 — 후보들의 시군구·시도로 좁혀 한 번에 읽는다. */
async function loadPool(admin: any, cards: ExtractedCard[]): Promise<SiteRow[]> {
  const sigungus = [...new Set(cards.map((c) => c.sigungu).filter((v): v is string => !!v))];
  const regions = [...new Set(cards.map((c) => c.region).filter((v): v is string => !!v))];
  const COLS = 'id, slug, name, display_name, name_variants, address, sigungu, region';
  const rows: SiteRow[] = [];

  if (sigungus.length) {
    const { data } = await admin.from('apt_sites').select(COLS)
      .in('sigungu', sigungus).eq('is_active', true).limit(2000);
    rows.push(...((data ?? []) as SiteRow[]));
  }
  // ⚠️ 시군구를 못 읽은 카드가 있으면 시도 단위로 한 번 더 받는다.
  //    좁히지 못했다고 «매칭을 포기하면» 이미 있는 현장 옆에 새 페이지를 또 만든다.
  if (cards.some((c) => !c.sigungu) && regions.length) {
    const { data } = await admin.from('apt_sites').select(COLS)
      .in('region', regions).eq('is_active', true).limit(4000);
    rows.push(...((data ?? []) as SiteRow[]));
  }
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

async function bumpHealth(admin: any, src: PresaleSource, cards: number, outcome: string, detail: string) {
  const { data: prev } = await admin.from('presale_source_health')
    .select('zero_streak').eq('source_key', src.key).maybeSingle();
  const now = new Date().toISOString();
  await admin.from('presale_source_health').upsert({
    source_key: src.key,
    last_run_at: now,
    // ⚠️ ok 는 «카드를 실제로 얻은» 실행만이다. 200 응답은 ok 가 아니다.
    ...(cards > 0 ? { last_ok_at: now } : {}),
    last_card_count: cards,
    zero_streak: cards > 0 ? 0 : ((prev?.zero_streak ?? 0) + 1),
    last_outcome: outcome,
    last_detail: detail.slice(0, 200),
    updated_at: now,
  }, { onConflict: 'source_key' });
}

async function upsertCandidate(
  admin: any, src: PresaleSource, card: ExtractedCard,
  v: {
    supplyType: SupplyType; resolution: Resolution; matchMethod: MatchMethod;
    matchedSiteId: string | null; seededSlug?: string; note: string;
  },
) {
  const now = new Date().toISOString();
  let seededSiteId: string | null = null;
  if (v.seededSlug) {
    const { data } = await admin.from('apt_sites').select('id').eq('slug', v.seededSlug).maybeSingle();
    seededSiteId = data?.id ?? null;
  }
  await admin.from('presale_candidates').upsert({
    source: `crawl:${src.key}`,
    source_url: card.sourceUrl,
    raw_name: card.rawName,
    norm_name: normName(stripProvisional(card.rawName)),
    region: card.region,
    sigungu: card.sigungu,
    addr_raw: card.addrRaw,
    builder_raw: src.builder,
    builder_canonical: card.builderRaw,
    total_units: card.totalUnits,
    expected_period_raw: card.expectedPeriodRaw,
    supply_type: v.supplyType,
    matched_site_id: v.matchedSiteId,
    match_method: v.matchMethod,
    seeded_site_id: seededSiteId,
    resolution: v.resolution,
    resolution_note: v.note.slice(0, 300),
    last_seen_at: now,
    updated_at: now,
  }, { onConflict: 'source,norm_name' });
}

/**
 * 새 현장 한 줄.
 * ⚠️ 기존 시드 21건과 «같은 형태» 로 앉힌다 — site_type='subscription' ·
 *    lifecycle_stage='pre_announcement' · confidence='estimated'. 형태를 새로 만들면
 *    화면·집계가 갈린다(「괴정3구역 재건축」도 subscription 으로 앉아 있다).
 * ⚠️ stage-derive 는 `stage_source is null` 인 행만 본다. 여기서 소스를 «명시» 하므로
 *    유도 크론이 이 행의 단계를 덮지 않는다 — H7-2 규약을 우회하지 않고 준수한다.
 */
async function seedSite(
  admin: any, src: PresaleSource, card: ExtractedCard, supplyType: SupplyType,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  // R6 — slug 는 «가칭·괄호 제거형». 확정명이 나오면 display_name 승격 + 구 slug 리다이렉트.
  const cleanName = stripProvisional(card.rawName);
  const slug = provisionalSlug(card.rawName);
  if (!slug) return { ok: false, error: 'slug 생성 불가' };

  const { data: dup } = await admin.from('apt_sites').select('id').eq('slug', slug).maybeSingle();
  if (dup) return { ok: false, error: `slug 중복: ${slug}` };

  const { error } = await admin.from('apt_sites').insert({
    slug,
    name: cleanName,
    // 「(가칭)」은 «화면 이름» 에만 남긴다. slug 에서는 뗀다.
    display_name: isProvisional(card.rawName) ? card.rawName : null,
    site_type: 'subscription',
    region: card.region,
    sigungu: card.sigungu,
    dong: dongOf(card.addrRaw),
    address: card.addrRaw,
    builder: card.builderRaw,
    total_units: card.totalUnits,
    lifecycle_stage: 'pre_announcement',
    // D2 — 소스 유래 자동 시드다. 사람이 옮겨 적은 것과 구분되는 축이 이 값이다.
    stage_source: `crawl:${src.key}`,
    // 독립 원출처 «1곳»(시공사 공식)이다. D6 상 estimated 이고 verified 가 아니다.
    confidence: 'estimated',
    confidence_note: `${src.label} — ${card.sourceUrl}`,
    supply_type: supplyType,
    // R2 — 민영이 아니면 페이지는 살리고 광고에서만 뺀다.
    ad_blocked: adBlockedFor(supplyType),
    ad_blocked_reason: adBlockedFor(supplyType) ? `공급유형 ${supplyType}` : null,
    is_active: true,
  });
  return error ? { ok: false, error: error.message } : { ok: true, slug };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await withCronLogging('builder-presale-crawl', () => handler(req));
  return NextResponse.json(result);
}
