export const maxDuration = 60;
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * ADDENDUM §4-2 — 경기 정비사업.
 *
 * 이전 구현은 서비스명 4개(Ggcleanupbiz · UrbanMntncBizInfo · URBMNTNCBIZ · GgClnupBsnsSttus)를
 * **추측**해 전부 ERROR-310 을 받고 시드 35건으로 조용히 폴백하고 있었다.
 *
 * ■ 소스 — 확정 (DB 담당이 직접 호출해 INFO-000 확인, 2026-08-25)
 *   https://openapi.gg.go.kr/GenrlimprvBizpropls?KEY=...&Type=json&pIndex=1&pSize=N
 *   경기데이터드림 「일반 정비 사업 추진 현황」 (infId=S62GFEEN7JMLMA0PH6CF19108891)
 *   list_total_count = 533
 *
 * ■ ⚠️ 실측 응답 키 — 포털의 한글 라벨과 다르다. 아래가 진짜다.
 *   SIGUN_NM                     시군명        → sigungu
 *   BIZ_TYPE_NM                  재개발/재건축  → project_type
 *   IMPRV_ZONE_NM                구역명        → district_name  ("원당주공2단지" 같은 단지명이 온다)
 *   LOCPLC_ADDR                  주소          → address
 *   ZONE_AR                      구역면적       → area_sqm
 *   BIZ_STEP_NM                  사업단계       → stage
 *   EXISTNG_HOUSNG_HSHLD_CNT     기존 세대수    → existing_households
 *   EXISTNG_HOUSNG_COMPLTN_PERD  기존 준공연도  → ⚠️ 받을 컬럼이 없다 (아래)
 *   ASOCNTMB_CNT                 조합원 수      → guild_member_num
 *   BIZ_IMPLMNTR_NM              사업시행자     → developer  (조합이다. constructor 아님)
 *   CHRGPSN_TELNO                담당자 전화    → phone
 *   NWCNST_HUSNG_LTUTAR*_DESC    신축 평형별 세대수 4구간 → 합산해서 total_households
 *   날짜 8종  SAFE_DIAGNS_DE · ASSOCTN_FOUND_CONFMTN_DE · BIZ_IMPLMTN_CONFMTN_DE
 *            MANAGE_DISPOSIT_CONFMTN_DE · STRCONTR_DE · GENRL_LOTOUT_DE
 *            COMPLTN_DE · TRANSFR_NOTIFC_DE
 *
 * ■ ⚠️ 함정 3가지 (전부 실측으로 확인된 것)
 *   1. NOW_PROPLSN_MATR_DESC(포털 라벨 '현추진상황')는 **전부 null 이다.**
 *      단계는 BIZ_STEP_NM 을 쓴다. 라벨만 보고 매핑하면 단계가 통째로 빈다.
 *   2. 총세대수 단일 필드가 **없다.** NWCNST_HUSNG_LTUTAR* 4구간을 합산해야 한다.
 *      실측 표본 117 + 685 + 476 + 85 = 1,363.
 *   3. **위경도가 없다.** 앞서 매핑했던 REFINE_WGS84_LAT 계열은 이 응답에 존재하지 않는다.
 *      지어내지 않는다 — 좌표는 LOCPLC_ADDR 지오코딩(redev-geocode) 몫이다.
 *
 * ■ ⚠️ EXISTNG_HOUSNG_COMPLTN_PERD(기존 준공연도)는 넣을 곳이 없다.
 *   redevelopment_projects 에 built_year 컬럼이 없다(실측 51열 확인).
 *   notes 에 밀어넣지 않고 **버린다.** 재건축 연한 판단에 쓸모가 있으니
 *   컬럼이 생기면 이 줄 아래 한 줄만 추가하면 된다.
 *
 * ■ ⚠️ 533건에는 준공·이전고시된 기축이 섞여 있다.
 *   이 크론은 redevelopment_projects 에 담기만 한다. apt_sites 승격은 별도이며
 *   그때 stage='준공' 을 post_move_in 으로 보내거나 제외해야 한다.
 *
 * ■ ⚠️ 인천은 이 API 에 없다. 시·도가 다르다. 별도 소스가 필요하다.
 *   기존 incheon_seed 15건은 건드리지 않는다.
 */

/* ═══════════ 값 유틸 ═══════════ */

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s && s !== '-' && s !== '해당없음' ? s : null;
}

function num(v: unknown): number | null {
  const s = clean(v);
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v: unknown, max = 1_000_000): number | null {
  const n = num(v);
  if (n === null) return null;
  const i = Math.round(n);
  return i > 0 && i < max ? i : null;
}

/** YYYY-MM-DD / YYYYMMDD / YYYY.MM.DD → date 문자열. 못 읽으면 null. */
function dateOrNull(v: unknown): string | null {
  const s = clean(v);
  if (!s) return null;
  const digits = s.replace(/[^0-9]/g, '');
  if (digits.length !== 8) return null;
  const y = +digits.slice(0, 4);
  if (y < 1960 || y > 2100) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/**
 * 키 이름을 추측하지 않고 **여러 후보를 훑는다.**
 * 경기 API 가 영문 대문자 키를 주든 한글 라벨을 주든 양쪽 다 잡는다.
 * 대소문자·언더스코어·공백을 무시하고 비교한다.
 */
function pick(row: Record<string, any>, candidates: string[]): any {
  const norm = (s: string) => s.replace(/[\s_()]/g, '').toUpperCase();
  const index = new Map<string, any>();
  for (const [k, v] of Object.entries(row)) index.set(norm(k), v);
  for (const c of candidates) {
    const hit = index.get(norm(c));
    if (hit !== undefined && hit !== null && String(hit).trim() !== '') return hit;
  }
  return null;
}

/**
 * 총세대수 — 응답에 단일 필드가 없다. 신축 평형별 세대수를 합산해야 한다.
 *
 * 키가 `NWCNST_HUSNG_LTUTAR4060M_DESC` 처럼 평형 구간을 이름에 담고 있고 구간이
 * 4개(40~60 · 60~85 · 85~135 · 135초과)다. **정확한 접미사를 외워 쓰지 않고 접두사로 훑는다** —
 * 구간이 하나 늘거나 이름이 바뀌어도 합계가 조용히 틀리지 않는다.
 * 실측 표본: 117 + 685 + 476 + 85 = 1,363.
 *
 * ⚠️ 이름이 `_DESC` 라 숫자가 아닌 설명이 들어올 수 있다. 순수 숫자로 읽히는 값만 더하고,
 *    하나도 못 읽으면 0 이 아니라 null 을 낸다 (0세대와 "모름"은 다르다).
 */
const NEWBUILD_KEY_PREFIX = 'NWCNST_HUSNG_LTUTAR';

function sumNewBuildUnits(row: Record<string, any>): number | null {
  let total = 0;
  let hit = 0;
  for (const [k, v] of Object.entries(row)) {
    if (!k.toUpperCase().startsWith(NEWBUILD_KEY_PREFIX)) continue;
    const s = clean(v);
    if (!s) continue;
    if (!/^[0-9,]+$/.test(s)) continue; // 설명 문자열은 버린다
    const n = Number(s.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) continue;
    total += n;
    hit++;
  }
  if (hit === 0) return null;
  return total > 0 && total < 1_000_000 ? total : null;
}

/* ═══════════ 구역명 정제 (§4-1 ⑤ 와 같은 규칙) ═══════════ */

const GENERIC_NAMES = new Set([
  '정비구역', '기타지구', '기타', '미상', '해당없음', '없음',
  '정비구역지정', '도시환경정비구역', '재개발', '재건축', '지구', '구역',
]);
const FRAGMENT_RE = /^제?\s*\d+\s*(구역|지구|블록|단지)$/;

/**
 * ⚠️ 서울(5자)보다 낮게 잡는다.
 * 서울 upisRebuild 의 짧은 이름은 '정비구역' 같은 **분류값**이었지만,
 * 경기 IMPRV_ZONE_NM 은 "원당주공2단지" 같은 **실제 단지명**이라 "장미마을"(4자)처럼
 * 짧아도 유효한 이름이 있다. 조각·분류값은 FRAGMENT_RE / GENERIC_NAMES 가 이미 잡는다.
 * 5자로 두면 멀쩡한 단지를 조용히 버린다.
 */
const MIN_NAME_LEN = 3;

function sanitizeName(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, ' ').trim();
  if (!s || GENERIC_NAMES.has(s) || FRAGMENT_RE.test(s) || s.length < MIN_NAME_LEN) return null;
  return s;
}

/**
 * ⚠️ (district_name, region) 이 UNIQUE 다. region 은 경기 전체가 '경기' 하나이므로
 *    시군이 다른 같은 이름의 구역이 서로를 조용히 덮어쓴다 — 실제로 있는 상황이다
 *    (`중앙동 재개발` 은 여러 시에 있다).
 *    그래서 이름이 시군명을 포함하지 않으면 앞에 붙여 **경기 안에서 유일**하게 만든다.
 *    매 실행 같은 규칙이라 upsert 키가 흔들리지 않는다.
 */
function qualifyName(name: string, sigungu: string | null): string {
  if (!sigungu) return name;
  const stem = sigungu.replace(/[시군구]$/, '');
  if (name.includes(sigungu) || (stem.length >= 2 && name.includes(stem))) return name;
  return `${sigungu} ${name}`;
}

/* ═══════════ 단계 정규화 ═══════════ */

/**
 * redevelopment_projects.stage CHECK 허용 17종 중 이 크론이 쓰는 값만 낸다.
 * ⚠️ 목록 밖 값을 만들면 CHECK 위반으로 행이 통째로 거부된다 — 부산에서 `추진위원회` 로 겪었다.
 */
const ALLOWED_STAGES = new Set([
  '정비구역지정', '조합설립', '사업시행인가', '관리처분', '착공', '준공', '해제', '기타',
]);

function normalizeStage(raw: string | null): { value: string; unknown?: string } {
  const s = clean(raw);
  if (!s) return { value: '정비구역지정' };
  if (/준공|완료|입주|사용승인|이전고시/.test(s)) return { value: '준공' };
  if (/착공|공사|시공/.test(s)) return { value: '착공' };
  if (/관리처분/.test(s)) return { value: '관리처분' };
  if (/사업시행|시행인가/.test(s)) return { value: '사업시행인가' };
  if (/조합설립|조합인가|추진위/.test(s)) return { value: '조합설립' };
  if (/해제|취소|중단/.test(s)) return { value: '해제' };
  if (/구역지정|정비구역|정비계획|안전진단|예비평가/.test(s)) return { value: '정비구역지정' };
  // 모르는 값은 '기타' 로 보내고 **원문을 기록한다.** 조용히 기본값으로 흡수하지 않는다.
  return { value: '기타', unknown: s };
}

function projectTypeOf(rawType: string | null, name: string): string {
  const s = `${rawType ?? ''} ${name}`;
  if (/재건축/.test(s)) return '재건축';
  return '재개발'; // CHECK 는 재개발·재건축 둘만 허용한다
}

/* ═══════════ 라우트 ═══════════ */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GYEONGGI_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GYEONGGI_DATA_API_KEY not set' }, { status: 200 });

  // 서비스명 확정 — DB 담당이 직접 호출해 INFO-000 · list_total_count 533 을 확인했다.
  // 재정의는 여전히 가능하게 둔다(스키마가 바뀌면 ?service= 로 바로 갈아끼운다).
  const service =
    req.nextUrl.searchParams.get('service')?.trim() ||
    process.env.GYEONGGI_REDEV_SERVICE?.trim() ||
    'GenrlimprvBizpropls';

  const supabase = getSupabaseAdmin();

  const result = await withCronLogging('crawl-gyeonggi-redev', async () => {
    /* ── 1) 수집 ── */
    const allRows: Record<string, any>[] = [];
    let totalCount = 0;
    let firstBody = '';

    const pageUrl = (page: number, size: number) =>
      `https://openapi.gg.go.kr/${service}?KEY=${apiKey}&Type=json&pIndex=${page}&pSize=${size}`;

    const probeRes = await fetch(pageUrl(1, 5));
    firstBody = await probeRes.text();

    let probe: any;
    try { probe = JSON.parse(firstBody); } catch {
      // 경기 API 는 실패해도 200 + XML/HTML 을 준다. 본문을 그대로 올려 원인을 보이게 한다.
      throw new Error(`GYEONGGI_NON_JSON service=${service} body=${firstBody.slice(0, 400)}`);
    }

    const svcData = probe?.[service];
    if (!Array.isArray(svcData)) {
      // ERROR-310 등은 여기로 온다. 코드/메시지를 그대로 실어 올린다.
      throw new Error(
        `GYEONGGI_SERVICE_ERROR service=${service} keys=${Object.keys(probe).join(',')} ` +
        `body=${firstBody.slice(0, 400)}`,
      );
    }

    totalCount = Number(svcData[0]?.head?.[0]?.list_total_count ?? 0);
    allRows.push(...(svcData[1]?.row ?? []));

    const PAGE = 100;
    for (let page = 1; allRows.length < totalCount && page <= 60; page++) {
      const res = await fetch(pageUrl(page, PAGE));
      const data = await res.json().catch(() => null);
      const rows = data?.[service]?.[1]?.row ?? [];
      if (rows.length === 0) break;
      // pIndex=1 은 위에서 5건만 받았으므로 다시 받아 합친다. 중복은 아래 dedupe 가 접는다.
      allRows.push(...rows);
    }

    /* ── 2) 응답 형태 실측 — 매핑 확정용 ── */
    const responseKeys = allRows.length > 0 ? Object.keys(allRows[0]).sort() : [];
    const sampleRow: Record<string, string> = {};
    if (allRows[0]) {
      for (const [k, v] of Object.entries(allRows[0])) sampleRow[k] = String(v ?? '').slice(0, 60);
    }

    /* ── 3) 매핑 ── */
    let skippedNoName = 0;
    let skippedBadName = 0;
    let qualified = 0;
    let missingNewBuild = 0;
    const badNameSamples: string[] = [];
    const unmappedStages = new Set<string>();

    const mapped: Record<string, any>[] = [];

    for (const r of allRows) {
      if (!r || typeof r !== 'object') continue;

      const sigungu = clean(pick(r, ['SIGUN_NM']));
      const rawName = clean(pick(r, ['IMPRV_ZONE_NM']));
      const name = sanitizeName(rawName);

      if (!name) {
        if (rawName) { skippedBadName++; if (badNameSamples.length < 10) badNameSamples.push(rawName.slice(0, 60)); }
        else skippedNoName++;
        continue;
      }

      const districtName = qualifyName(name, sigungu);
      if (districtName !== name) qualified++;

      // ⚠️ 포털 라벨은 '현추진상황'이지만 그 키(NOW_PROPLSN_MATR_DESC)는 실측에서 전부 null 이다.
      //    단계는 BIZ_STEP_NM 을 쓴다. 라벨과 키가 다른 대표 사례라 이 줄을 바꾸지 말 것.
      const rawStage = clean(pick(r, ['BIZ_STEP_NM']));
      const { value: rawMapped, unknown } = normalizeStage(rawStage);
      if (unknown) unmappedStages.add(unknown);
      // 최종 가드 — 정규화가 어떤 이유로든 목록 밖 값을 내면 여기서 막는다.
      // CHECK 위반은 행을 통째로 날리므로 '기타'로 흡수하는 편이 낫다(원문은 unmapped_stages 에 남는다).
      const stage = ALLOWED_STAGES.has(rawMapped) ? rawMapped : '기타';

      const newBuild = sumNewBuildUnits(r);
      if (newBuild === null) missingNewBuild++;

      mapped.push({
        district_name: districtName,
        region: '경기',
        sigungu,
        project_type: projectTypeOf(clean(pick(r, ['BIZ_TYPE_NM'])), districtName),
        stage,
        address: clean(pick(r, ['LOCPLC_ADDR'])),
        area_sqm: num(pick(r, ['ZONE_AR'])),
        // ⚠️ 총세대수 필드가 응답에 없다. 신축 평형별 4개를 합산한다 (실측 117+685+476+85=1,363).
        total_households: newBuild,
        existing_households: intOrNull(pick(r, ['EXISTNG_HOUSNG_HSHLD_CNT'])),
        guild_member_num: intOrNull(pick(r, ['ASOCNTMB_CNT']), 100_000),
        // ⚠️ 사업시행자는 조합이지 시공사가 아니다. constructor 에 넣지 않는다.
        developer: clean(pick(r, ['BIZ_IMPLMNTR_NM'])),
        phone: clean(pick(r, ['CHRGPSN_TELNO'])),
        approval_date: dateOrNull(pick(r, ['BIZ_IMPLMTN_CONFMTN_DE'])),
        // ⚠️ 위경도가 응답에 없다. 지어내지 않는다 — LOCPLC_ADDR 지오코딩은 별도 크론(redev-geocode)의 몫이다.
        source: 'gyeonggi_opendata',
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    }

    /* ── 4) (district_name, region) 유니크에 맞춰 접기 ── */
    const byName = new Map<string, Record<string, any>>();
    for (const m of mapped) byName.set(m.district_name, m);
    const collapsedByName = mapped.length - byName.size;

    // 손으로 넣은 경기 건은 덮지 않는다 (서울에서 쓴 규칙과 동일).
    const { data: curated } = await (supabase as any)
      .from('redevelopment_projects')
      .select('district_name')
      .eq('region', '경기')
      .neq('source', 'gyeonggi_opendata');
    const curatedNames = new Set<string>((curated ?? []).map((c: any) => c.district_name));

    const payload = Array.from(byName.values()).filter((m) => !curatedNames.has(m.district_name));
    const skippedCurated = byName.size - payload.length;

    const stageCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    for (const m of payload) {
      stageCounts[m.stage] = (stageCounts[m.stage] ?? 0) + 1;
      typeCounts[m.project_type] = (typeCounts[m.project_type] ?? 0) + 1;
    }

    /* ── 5) upsert — 배치 실패 시 한 건씩 재시도해 실패한 행만 센다 ── */
    const upsertOpts = { onConflict: 'district_name,region', ignoreDuplicates: false } as const;
    let upserted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < payload.length; i += 100) {
      const batch = payload.slice(i, i + 100);
      const { error } = await (supabase as any).from('redevelopment_projects').upsert(batch, upsertOpts);
      if (!error) { upserted += batch.length; continue; }

      for (const row of batch) {
        const { error: rowErr } = await (supabase as any)
          .from('redevelopment_projects').upsert(row, upsertOpts);
        if (!rowErr) { upserted++; continue; }
        failed++;
        if (errors.length < 8) {
          errors.push(
            `${rowErr.message.slice(0, 160)} | stage=${JSON.stringify(row.stage)} ` +
            `type=${JSON.stringify(row.project_type)} name=${JSON.stringify(row.district_name)} ` +
            `sigungu=${JSON.stringify(row.sigungu)}`,
          );
        }
      }
    }

    return {
      processed: allRows.length,
      created: upserted,
      updated: upserted,
      failed,
      metadata: {
        api_name: 'gyeonggi_opendata',
        service,
        total_count: totalCount,
        mapped: mapped.length,
        payload: payload.length,
        collapsed_by_name: collapsedByName,
        qualified_with_sigungu: qualified,
        skipped_curated: skippedCurated,
        skipped_no_name: skippedNoName,
        skipped_bad_name: skippedBadName,
        bad_name_samples: badNameSamples,
        unmapped_stages: [...unmappedStages],
        stage_values: stageCounts,
        project_type_values: typeCounts,
        missing_new_build: missingNewBuild,
        with_guild_member: payload.filter((m) => m.guild_member_num).length,
        with_phone: payload.filter((m) => m.phone).length,
        with_households: payload.filter((m) => m.total_households).length,
        with_developer: payload.filter((m) => m.developer).length,
        upsert_on: 'district_name,region',
        // 매핑 확정용 — 키가 예상과 다르면 이 두 줄만 보면 된다
        response_keys: responseKeys,
        sample_row: sampleRow,
        errors,
      },
    };
  });

  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result });
}
