export const maxDuration = 60;
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';

const SERVICE_NAME = 'upisRebuild';

/**
 * ADDENDUM §4-1 — 938건을 걸러놓고 0건 저장하던 원인.
 *
 * 이전 응답: processed 6587 · deduped 938 · created 0 · failed 11
 * `failed` 는 건수가 아니라 **배치 수**였다. 938/100 = 10 배치 + withoutExtId 1 배치 = 11.
 * 즉 전 배치가 통째로 실패했고, 무엇이 거부됐는지 알 방법이 없었다. 부산과 같은 증상이다.
 *
 * 실측한 원인 (2026-08-24):
 *   1. `ON CONFLICT (external_id)` 는 이제 추론된다 — DB 담당이 부분 인덱스를 전체 유니크로 교체했다.
 *      그런데 **redevelopment_projects 561행 전부 external_id 가 NULL 이다.**
 *      그래서 external_id 로 upsert 하면 938건이 전부 INSERT 로 흐르고,
 *   2. 그 INSERT 가 `idx_redev_district_region` UNIQUE (district_name, region) 를 때린다.
 *      이미 들어와 있는 seoul_opendata 105건과 구역명이 겹치기 때문이다.
 *      ON CONFLICT (external_id) 는 이 인덱스의 충돌을 처리하지 못한다 → 23505 → 배치 전체 사망.
 *
 * 그래서 upsert 기준을 **(district_name, region)** 으로 바꾼다.
 *   - 오늘의 데이터와 실제로 맞는 유일한 키다. 기존 105건은 UPDATE 되어 id·좌표·ai_summary 가 보존된다.
 *   - external_id 는 payload 에 계속 실어 보낸다. 다음 실행부터는 양쪽 키가 모두 채워진다.
 *   - ⚠️ 같은 district_name 이 payload 안에 2번 나오면 Postgres 가
 *     "ON CONFLICT DO UPDATE command cannot affect row a second time" 을 낸다.
 *     → 아래에서 district_name 기준으로 한 번 더 접는다.
 *
 * CHECK 두 개는 코드 대조로 배제됐다 (추측이 아니라 대조다):
 *   stage        허용 17종 ⊇ guessStage 반환 6종 (준공·착공·관리처분·사업시행인가·조합설립·정비구역지정)
 *   project_type 허용 2종  ⊇ TYPE_MAP 결과 2종 (재개발·재건축)
 * 그래도 분포를 metadata 에 남긴다 — 서울 API 가 값을 바꾸면 다음 사람은 이것만 보면 된다.
 */

const TYPE_MAP: Record<string, { project_type: string; sub_type: string }> = {
  '재개발사업지구': { project_type: '재개발', sub_type: '주택재개발' },
  '주택재개발사업지구': { project_type: '재개발', sub_type: '주택재개발' },
  '도시환경정비사업지구': { project_type: '재개발', sub_type: '도시환경정비' },
  '도시정비형 재개발': { project_type: '재개발', sub_type: '도시환경정비' },
  '주거환경개선사업지구': { project_type: '재개발', sub_type: '주택재개발' },
  '재건축사업지구': { project_type: '재건축', sub_type: '주택재건축' },
  '주택재건축사업지구': { project_type: '재건축', sub_type: '주택재건축' },
};

/** stage CHECK 허용 목록 중 이 크론이 쓰는 값. 목록 밖 값을 만들지 않는다. */
const ALLOWED_STAGES = new Set([
  '정비구역지정', '조합설립', '사업시행인가', '관리처분', '착공', '준공',
]);

/**
 * 서울 25개 자치구. 정확 일치만 인정한다.
 *
 * ⚠️ 이전 구현은 `/([가-힣]+구)/` 로 뽑아서 "금호1-4주택재개발정비지구" → **"지구"**,
 *    "서소문구역" → **"서소문구"** 같은 없는 구를 만들어 냈다 (DB 실측 확인).
 *    시군구를 모르면 만들지 않는다 — null 이 틀린 값보다 낫다.
 */
const SEOUL_GU = [
  '종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구',
  '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구',
  '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구',
];

function extractGu(...candidates: (string | null | undefined)[]): string | null {
  for (const text of candidates) {
    if (!text) continue;
    for (const gu of SEOUL_GU) {
      if (text.includes(gu)) return gu;
    }
  }
  return null;
}

function clean(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
}

function guessStage(row: Record<string, any>): string {
  const text = [
    row.STEP_SE_NM, row.STTUS_NM, row.BSNS_STEP_NM, row.PRGRS_STTUS,
    row.STEP_SE, row.BSNS_STTUS, row.RPTT_STTUS,
  ].filter(Boolean).join(' ');

  if (!text) {
    if (row.COMPT_DE || row.USE_APRV_DE) return '준공';
    if (row.CNSTRN_BGN_DE || row.CONSRT_BGNDE) return '착공';
    if (row.DSPSL_PLANPSS_DE || row.MGT_DSPSL_DE) return '관리처분';
    if (row.BSNS_ATHZ_DE || row.BSNS_PMS_DE) return '사업시행인가';
    if (row.UNION_FNDTN_DE || row.ASSTN_APRVL_DE) return '조합설립';
    return '정비구역지정';
  }

  if (/준공|완료|입주|사용승인/.test(text)) return '준공';
  if (/착공|공사|시공/.test(text)) return '착공';
  if (/관리처분/.test(text)) return '관리처분';
  if (/사업시행|시행인가/.test(text)) return '사업시행인가';
  if (/조합설립|조합인가/.test(text)) return '조합설립';
  if (/구역지정|정비구역|안전진단/.test(text)) return '정비구역지정';
  return '정비구역지정';
}

function getProjectType(sclsf: string): { project_type: string; sub_type: string } | null {
  for (const [key, val] of Object.entries(TYPE_MAP)) {
    if (sclsf.includes(key)) return val;
  }
  if (/도시환경|도시정비/.test(sclsf)) return { project_type: '재개발', sub_type: '도시환경정비' };
  return null;
}

/**
 * §4-1 ⑥ — 서울 API 응답에 조감도 경로가 있는지 **다음 실행이 스스로 답하게 한다.**
 * 부산은 viewImgPath 를 줬다. 서울 필드명은 문서로 확인되지 않아 추측하지 않고,
 * 이미지처럼 보이는 키와 표본값 1개를 metadata 에 남긴다. 실제 매핑은 그 값을 보고 붙인다.
 */
const IMAGE_KEY_RE = /(IMG|IMAGE|PHOTO|PICT|FILE|URL|PATH)/i;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.SEOUL_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'SEOUL_DATA_API_KEY not set' }, { status: 200 });

  const supabase = getSupabaseAdmin();

  const result = await withCronLogging('crawl-seoul-redev', async () => {
    const baseUrl = `http://openapi.seoul.go.kr:8088/${apiKey}/json/${SERVICE_NAME}`;

    const countRes = await fetch(`${baseUrl}/1/1/`);
    const countText = await countRes.text();
    let countData: any;
    try { countData = JSON.parse(countText); } catch {
      throw new Error('Invalid JSON from Seoul API: ' + countText.slice(0, 300));
    }

    const totalCount = countData?.[SERVICE_NAME]?.list_total_count || 0;
    if (totalCount === 0) {
      return { processed: 0, created: 0, failed: 0, metadata: { api_name: 'seoul_opendata', api_calls: 1, filtered: 0, deduped: 0 } };
    }

    const allRows: Record<string, any>[] = [];
    for (let start = 1; start <= totalCount; start += 1000) {
      const end = Math.min(start + 999, totalCount);
      const res = await fetch(`${baseUrl}/${start}/${end}/`);
      const data = await res.json();
      const rows = data?.[SERVICE_NAME]?.row || [];
      allRows.push(...rows);
    }

    /* ── ⑥ 응답 필드 실측 — 조감도 경로 존재 여부를 이 실행이 답한다 ── */
    const allKeys = new Set<string>();
    const imageKeySamples: Record<string, string> = {};
    for (const r of allRows.slice(0, 500)) {
      if (!r || typeof r !== 'object') continue;
      for (const [k, v] of Object.entries(r)) {
        allKeys.add(k);
        if (IMAGE_KEY_RE.test(k) && !imageKeySamples[k]) {
          const s = clean(v);
          if (s) imageKeySamples[k] = s.slice(0, 120);
        }
      }
    }

    /* ── 필터 + PRJC_CD 중복 제거 ── */
    const filtered = allRows.filter(r => getProjectType(r.SCLSF || '') !== null);

    const deduped = new Map<string, any>();
    for (const r of filtered) {
      const key = r.PRJC_CD || r.RGN_NM || r.PSTN_NM || Math.random().toString();
      deduped.set(key, r);
    }
    const unique = Array.from(deduped.values());

    /* ── 매핑 ── */
    let skippedNoName = 0;
    let skippedBadStage = 0;
    const mapped: Record<string, any>[] = [];

    for (const r of unique) {
      // ⚠️ 이름이 없으면 건너뛴다. '미상' 을 만들지 않는다 —
      //    (district_name, region) 이 유니크라 '미상' 이 서울 전체에서 1건만 살아남고
      //    나머지는 조용히 서로를 덮어쓴다.
      const districtName = clean(r.RGN_NM) || clean(r.PSTN_NM);
      if (!districtName) { skippedNoName++; continue; }

      const typeInfo = getProjectType(r.SCLSF || '') || { project_type: '재개발', sub_type: '주택재개발' };

      const stage = guessStage(r);
      if (!ALLOWED_STAGES.has(stage)) { skippedBadStage++; continue; }

      const households = (() => {
        const v = r.TOT_HSHLD_CO || r.HSHLD_CO || r.PLAN_HSHLD_CO || r.HO_CNT || null;
        const n = v ? parseInt(v) : null;
        return n && n > 0 && n < 100000 ? n : null;
      })();

      mapped.push({
        district_name: districtName,
        region: '서울',
        sigungu: extractGu(r.PSTN_NM, r.RGN_NM, r.ADRES, r.SGG_NM),
        project_type: typeInfo.project_type,
        sub_type: typeInfo.sub_type,
        stage,
        total_households: households,
        area_sqm: parseFloat(r.AREA_CHG_AFTR || r.AREA_EXS || '0') || null,
        constructor: clean(r.CNSTRTR_NM) || clean(r.CONSRT_CO_NM),
        address: clean(r.PSTN_NM),
        notes: clean(r.SCLSF),
        source: 'seoul_opendata',
        is_active: true,
        external_id: r.PRJC_CD ? `seoul_${r.PRJC_CD}` : null,
        updated_at: new Date().toISOString(),
      });
    }

    /* ── (district_name, region) 유니크에 맞춰 한 번 더 접는다 ──
       같은 구역명이 payload 안에 2번 있으면 upsert 자체가 21000 으로 죽는다.
       뒤에 오는 건(=API 순서상 최신)을 남긴다. 접힌 수를 metadata 에 남겨
       "938 넣었는데 900 들어감" 이 조용한 손실로 보이지 않게 한다. */
    const byName = new Map<string, Record<string, any>>();
    for (const m of mapped) byName.set(m.district_name, m);
    const collapsedByName = mapped.length - byName.size;

    /* ── 손으로 넣은 서울 건은 덮지 않는다 ──
       (district_name, region) 로 upsert 하므로, 수기 등록분과 이름이 정확히 겹치면
       API 의 추정값이 사람이 확인한 값을 덮어쓴다. 실측상 수기 10건은 전부 ai_summary 를
       갖고 있고 stage 도 손으로 넣은 값이다(관리처분·착공 등). guessStage 의 기본값은
       '정비구역지정' 이라 겹치는 순간 단계가 조용히 후퇴한다. 그래서 건너뛴다. */
    const { data: curated } = await (supabase as any)
      .from('redevelopment_projects')
      .select('district_name')
      .eq('region', '서울')
      .neq('source', 'seoul_opendata');
    const curatedNames = new Set<string>((curated ?? []).map((c: any) => c.district_name));

    const payload = Array.from(byName.values()).filter((m) => !curatedNames.has(m.district_name));
    const skippedCurated = byName.size - payload.length;

    /* ── 실제로 넣는 값의 분포. CHECK 위반 시 어떤 문자열이 거부됐는지 이것만 보면 된다 ── */
    const stageCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    for (const m of payload) {
      stageCounts[m.stage ?? '(null)'] = (stageCounts[m.stage ?? '(null)'] ?? 0) + 1;
      typeCounts[m.project_type] = (typeCounts[m.project_type] ?? 0) + 1;
    }

    /* ── UPSERT — 배치 실패 시 한 건씩 재시도해 **실패한 행만** 센다 ── */
    let upserted = 0;
    let failed = 0;
    const errors: string[] = [];

    const upsertOpts = { onConflict: 'district_name,region', ignoreDuplicates: false } as const;

    for (let i = 0; i < payload.length; i += 100) {
      const batch = payload.slice(i, i + 100);
      const { error } = await (supabase as any)
        .from('redevelopment_projects')
        .upsert(batch, upsertOpts);
      if (!error) { upserted += batch.length; continue; }

      // ⚠️ 배치가 통째로 실패하면 어느 행이 문제인지 모른다.
      //    한 건씩 다시 넣어 실패한 행만 세고, 그 행의 값을 오류 문자열에 실어 올린다.
      //    938건이 조용히 0건이 되던 상황을 두 번 만들지 않는다.
      for (const row of batch) {
        const { error: rowErr } = await (supabase as any)
          .from('redevelopment_projects')
          .upsert(row, upsertOpts);
        if (!rowErr) { upserted++; continue; }
        failed++;
        if (errors.length < 8) {
          errors.push(
            `${rowErr.message.slice(0, 160)} | stage=${JSON.stringify(row.stage)} ` +
              `type=${JSON.stringify(row.project_type)} name=${JSON.stringify(row.district_name)} ` +
              `sigungu=${JSON.stringify(row.sigungu)} ext=${JSON.stringify(row.external_id)}`,
          );
        }
      }
    }

    /* ── API 에 없는 기존 건: is_active=false (삭제 대신) ──
       ⚠️ 이름 목록으로 판정한다. external_id 는 아직 대부분 NULL 이라 기준이 되지 못한다.
       또한 이번 실행에서 한 건도 못 넣었으면(=전면 실패) 마킹하지 않는다 —
       API 장애로 0건이 온 날 서울 전체가 비활성화되는 사고를 막는다. */
    if (upserted > 0 && payload.length > 0) {
      const liveNames = payload.map((m) => m.district_name);
      const CHUNK = 300;
      const stale = new Set<string>();
      const { data: existing } = await (supabase as any)
        .from('redevelopment_projects')
        .select('district_name')
        .eq('source', 'seoul_opendata')
        .eq('region', '서울')
        .eq('is_active', true);
      const liveSet = new Set(liveNames);
      for (const e of existing ?? []) {
        if (!liveSet.has(e.district_name)) stale.add(e.district_name);
      }
      const staleList = [...stale];
      for (let i = 0; i < staleList.length; i += CHUNK) {
        await (supabase as any)
          .from('redevelopment_projects')
          .update({ is_active: false })
          .eq('source', 'seoul_opendata')
          .eq('region', '서울')
          .in('district_name', staleList.slice(i, i + CHUNK));
      }
    }

    return {
      processed: allRows.length,
      created: upserted,
      updated: upserted,
      failed,
      metadata: {
        api_name: 'seoul_opendata',
        api_calls: Math.ceil(totalCount / 1000) + 1,
        total_count: totalCount,
        filtered: filtered.length,
        deduped: unique.length,
        mapped: mapped.length,
        payload: payload.length,
        collapsed_by_name: collapsedByName,
        skipped_curated: skippedCurated,
        skipped_no_name: skippedNoName,
        skipped_bad_stage: skippedBadStage,
        with_ext_id: payload.filter((m) => m.external_id).length,
        without_ext_id: payload.filter((m) => !m.external_id).length,
        with_sigungu: payload.filter((m) => m.sigungu).length,
        upsert_on: 'district_name,region',
        stage_values: stageCounts,
        project_type_values: typeCounts,
        // ⑥ 조감도 — 다음 실행 로그에서 이 두 줄만 보면 된다
        response_keys: [...allKeys].sort(),
        image_key_samples: imageKeySamples,
        errors,
      },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result });
}
