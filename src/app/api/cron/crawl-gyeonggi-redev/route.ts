export const maxDuration = 60;
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * ADDENDUM §4-2 — 경기·인천 435건.
 *
 * 이전 구현은 서비스명 4개를 **추측**해서 전부 ERROR-310(해당하는 서비스를 찾을 수 없습니다)을
 * 받고 시드 35건으로 폴백하고 있었다. 추측을 한 번 더 하지 않는다.
 *
 * ■ 소스 (2026-08-25 확인)
 *   경기데이터드림 「일반 정비 사업 추진 현황」
 *   infId=S62GFEEN7JMLMA0PH6CF19108891
 *   운영: 경기도 도시재생과. 시군별 데이터셋(안양 15150142 · 하남 15150356 · 고양
 *   15085976/15085975)은 전부 이 도 단위 자료의 부분집합이다.
 *
 * ■ 필드 (안양 15150142 실측 42열 — 도 단위도 같은 스키마다)
 *   시군명 · 사업단계 · 사업유형 · 정비구역명 · 위치 · 위도 · 경도 · 구역면적
 *   기존주택(준공년도 · 동수 · 세대수)
 *   사업시행세대수총계 · 조합원분양세대수 · 일반분양세대수 · 임대세대수
 *   토지등소유자수 · 조합원수 · 사업시행자
 *   조합설립인가/사업시행인가/관리처분인가/착공/일반분양/준공 일자
 *   현추진상황 · 담당부서
 *
 *   부산보다 낫다 — **위경도**가 있어 지도에 바로 올라가고, **세대수가 3종으로 분리**돼 있다.
 *
 * ■ ⚠️ 서비스명(영문 식별자)은 아직 확정되지 않았다
 *   data.gg.go.kr 는 검색 URL 이 500 을 뱉고 상세 페이지는 JS 렌더라 외부에서 못 읽는다.
 *   그래서 **이름을 코드에 박지 않는다.**
 *     1순위  ?service=<이름>        — 한 번 태워보고 확정할 때 쓴다 (재배포 불필요)
 *     2순위  GYEONGGI_REDEV_SERVICE 환경변수
 *     3순위  없으면 **아무것도 시도하지 않고** 무엇이 필요한지 응답에 적어 돌려준다
 *   틀린 이름으로 조용히 폴백하지 않는다. 그게 435건을 반년 방치한 방식이다.
 *
 * ■ 응답 키도 추측하지 않는다
 *   포털에 보이는 것은 한글 컬럼 라벨이고 API 가 실제로 내려주는 키는 다르다.
 *   pick() 이 영문 후보와 한글 라벨을 모두 훑고, 첫 실행이 response_keys 와
 *   sample_row 를 metadata 에 실어 준다. 매핑은 그 값을 보고 확정한다.
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

/* ═══════════ 구역명 정제 (§4-1 ⑤ 와 같은 규칙) ═══════════ */

const GENERIC_NAMES = new Set([
  '정비구역', '기타지구', '기타', '미상', '해당없음', '없음',
  '정비구역지정', '도시환경정비구역', '재개발', '재건축', '지구', '구역',
]);
const FRAGMENT_RE = /^제?\s*\d+\s*(구역|지구|블록|단지)$/;
const MIN_NAME_LEN = 5;

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

  // ⚠️ 서비스명은 추측하지 않는다. 위 주석 참고.
  const service =
    req.nextUrl.searchParams.get('service')?.trim() ||
    process.env.GYEONGGI_REDEV_SERVICE?.trim() ||
    '';

  if (!service) {
    return NextResponse.json({
      ok: false,
      error: 'SERVICE_NAME_REQUIRED',
      how: '?service=<영문서비스명> 로 한 번 태우거나 GYEONGGI_REDEV_SERVICE 환경변수를 설정하세요.',
      where: 'data.gg.go.kr 「일반 정비 사업 추진 현황」 infId=S62GFEEN7JMLMA0PH6CF19108891 의 오픈API 탭',
      note: '이전 후보 4개(Ggcleanupbiz · UrbanMntncBizInfo · URBMNTNCBIZ · GgClnupBsnsSttus)는 전부 ERROR-310 이었습니다. 추측으로 재시도하지 않습니다.',
    }, { status: 200 });
  }

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
    const badNameSamples: string[] = [];
    const unmappedStages = new Set<string>();

    const mapped: Record<string, any>[] = [];

    for (const r of allRows) {
      if (!r || typeof r !== 'object') continue;

      const sigungu = clean(pick(r, ['SIGUN_NM', 'SIGUNGU_NM', 'CITY_NM', '시군명', '시군구명']));
      const rawName = clean(pick(r, ['MNTNC_ZONE_NM', 'RGN_NM', 'ZONE_NM', 'BIZ_NM', '정비구역명', '구역명']));
      const name = sanitizeName(rawName);

      if (!name) {
        if (rawName) { skippedBadName++; if (badNameSamples.length < 10) badNameSamples.push(rawName.slice(0, 60)); }
        else skippedNoName++;
        continue;
      }

      const districtName = qualifyName(name, sigungu);
      if (districtName !== name) qualified++;

      const rawStage = clean(pick(r, ['PRSNT_PRGRS_STTUS', 'BIZ_STEP', 'STEP_NM', '현추진상황', '사업단계']));
      const { value: rawMapped, unknown } = normalizeStage(rawStage);
      if (unknown) unmappedStages.add(unknown);
      // 최종 가드 — 정규화가 어떤 이유로든 목록 밖 값을 내면 여기서 막는다.
      // CHECK 위반은 행을 통째로 날리므로 '기타'로 흡수하는 편이 낫다(원문은 unmapped_stages 에 남는다).
      const stage = ALLOWED_STAGES.has(rawMapped) ? rawMapped : '기타';

      const lat = num(pick(r, ['REFINE_WGS84_LAT', 'LAT', 'Y_COORD', '위도']));
      const lng = num(pick(r, ['REFINE_WGS84_LOGT', 'LOGT', 'LNG', 'X_COORD', '경도']));

      mapped.push({
        district_name: districtName,
        region: '경기',
        sigungu,
        project_type: projectTypeOf(clean(pick(r, ['BIZ_TYPE', 'MNTNC_BIZ_TYPE', '사업유형'])), districtName),
        stage,
        address: clean(pick(r, ['LOCPLC', 'LOC', 'ADRES', '위치', '소재지'])),
        area_sqm: num(pick(r, ['ZONE_AR', 'AREA', '구역면적', '구역면적제곱미터'])),
        // 세대수는 3종이 분리돼 있다. 총계를 total, 기존을 existing 으로.
        total_households: intOrNull(pick(r, ['BIZ_IMPLMT_HSHLD_SUM', 'TOT_HSHLD_CO', '사업시행세대수총계'])),
        existing_households: intOrNull(pick(r, ['EXSTNG_HOUSE_HSHLD_CO', '기존주택세대수'])),
        total_dong: intOrNull(pick(r, ['EXSTNG_HOUSE_DONG_CO', '기존주택동수']), 1000),
        // ⚠️ 사업시행자는 조합·시행자이지 시공사가 아니다. constructor 에 넣지 않는다.
        developer: clean(pick(r, ['BIZ_IMPLMTR', 'IMPLMTR_NM', '사업시행자'])),
        approval_date: dateOrNull(pick(r, ['BIZ_IMPLMT_ATHZ_DE', '사업시행인가일자'])),
        latitude: lat !== null && lat > 33 && lat < 39 ? lat : null,
        longitude: lng !== null && lng > 124 && lng < 132 ? lng : null,
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
        with_latlng: payload.filter((m) => m.latitude && m.longitude).length,
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
