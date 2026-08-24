export const maxDuration = 60;
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * 마스터 §4 — 부산 정비사업 현황 (공공데이터포털).
 *
 * ⚠️ 이 크론은 **344건을 받아 0건을 저장하고 있었다.** 크론 등록·API 키 모두 정상이었고
 *    원인은 필드 매핑이 전부 틀린 것 하나였다. 추측한 키(`guynm`·`stepSe`·`totHshldCo`…)를
 *    찾다가 못 찾으면 폴백이 아무 문자열이나 집어 `부산 재개발 정비사업` 같은 이름을 지어냈다.
 *
 * ── 실제 응답 필드 (크론 로그 sampleRow 실측) ──
 *   areaName  step  contractor  generationJoo  guildMemNum  areaUnit  location
 *   viewImgPath  panoImgPath  loctImgPath  placeImgPath  aCode  engineer  architect  phone
 *
 * ⚠️ **이미지 URL 은 `http://` 로 온다.** 그 호스트는 http 로 **401** 을 준다(https 만 200).
 *    게다가 우리 CSP 는 `img-src … https:` 라 http 이미지는 어차피 차단된다. → https 로 올린다.
 *
 * ⚠️ **폴백으로 이름을 지어내지 않는다.** `areaName` 이 없으면 그 행을 건너뛴다.
 * ⚠️ **full refresh 를 하지 않는다.** 지우고 넣다가 insert 가 실패하면 데이터가 사라지는데
 *    카운트가 0 이라 조용하다. `external_code` 기준 upsert 로 바꾸고 실패를 세어 올린다.
 */

const BASE_URL = 'https://apis.data.go.kr/6260000/MaintenanceBusinessStatus1/getMaintenanceBusiness1';

/** API 가 '미정' 을 문자열로 준다. 값이 아니라 빈칸이다. */
const NOT_SET = new Set(['미정', '없음', '-', '해당없음']);
const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  return !s || NOT_SET.has(s) ? null : s;
};

const num = (v: unknown): number | null => {
  const n = Number(String(v ?? '').replace(/[,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * 이미지 URL 정리.
 * ⚠️ 실측에서 `panoImgPath` 가 `http://…/busi_ara/` 처럼 **디렉터리만** 오는 경우가 있다.
 *    파일명이 없으면 이미지가 아니다.
 */
function imgUrl(v: unknown): string | null {
  const s = clean(v);
  if (!s) return null;
  if (!/\.(jpe?g|png|webp|gif)$/i.test(s)) return null;
  return s.replace(/^http:\/\//i, 'https://');
}

/**
 * 단계 정규화. 화면의 STAGES 축(정비구역지정·조합설립·사업시행인가·관리처분·착공·준공)에 맞춘다.
 * ⚠️ 모르는 값은 '기타' 로 뭉개지 않고 **원문을 그대로 둔다.** 고시 단계명은 그 자체가 정보다.
 *    대신 metadata 에 미매핑 값을 남겨 다음 실행 때 맵을 늘릴 수 있게 한다.
 */
const STAGE_MAP: Record<string, string> = {
  '정비구역지정': '정비구역지정',
  '추진위원회 구성': '추진위원회', '추진위원회구성': '추진위원회', '추진위원회승인': '추진위원회',
  '조합설립인가': '조합설립', '조합설립': '조합설립',
  '사업시행인가': '사업시행인가',
  '관리처분계획인가': '관리처분', '관리처분인가': '관리처분',
  '착공': '착공', '준공': '준공', '이전고시': '준공',
};

/**
 * `generationJoo` 판정 — 세대수인가 조합원 수인가.
 *
 * 실측 3개 구역 대조:
 *   명서1 재개발   generationJoo 785  · guildMemNum 785 · 조합설립인가
 *   금사1 재개발   generationJoo 2635 · guildMemNum 0   · 추진위원회 구성   ← 결정적
 *   괘법1 재개발   generationJoo 1    · guildMemNum 1   · 추진위원회 구성
 *
 * 금사1 은 조합이 아직 없어 `guildMemNum` 이 0 인데 `generationJoo` 는 2635 다.
 * **조합원 수라면 0 이어야 한다.** 즉 이 필드는 세대수다 (generation = 세대).
 *
 * ⚠️ 다만 괘법1 의 `1` 처럼 채워지지 않은 값이 섞인다. 정비구역 세대수가 1일 수는 없다.
 *    그래서 하한을 둔다 — 실제 세대수로 보기 어려운 값은 **넣지 않는다.**
 *    지어내지 않는 것과 같은 원칙이다.
 */
const MIN_PLAUSIBLE_HOUSEHOLDS = 30;
function households(v: unknown): number | null {
  const n = num(v);
  return n != null && n >= MIN_PLAUSIBLE_HOUSEHOLDS && n < 100000 ? n : null;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.BUSAN_DATA_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'BUSAN_DATA_API_KEY not set' }, { status: 200 });

    const supabase = getSupabaseAdmin() as any;

    const result = await withCronLogging('crawl-busan-redev', async () => {
      const fetchPage = async (page: number, rows: number) => {
        const res = await fetch(
          `${BASE_URL}?serviceKey=${encodeURIComponent(apiKey)}&pageNo=${page}&numOfRows=${rows}&resultType=json`,
          { signal: AbortSignal.timeout(20_000) },
        );
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          throw new Error(`API 응답 파싱 실패: ${text.slice(0, 120)}`);
        }
      };

      const first = await fetchPage(1, 1);
      const totalCount =
        first?.response?.body?.totalCount ?? first?.getMaintenanceBusiness1?.body?.totalCount ?? 0;
      if (!totalCount) {
        return {
          processed: 0, created: 0, failed: 1,
          metadata: { api_name: 'busan_opendata', error: 'totalCount 0', raw: JSON.stringify(first).slice(0, 400) },
        };
      }

      const allRows: Record<string, any>[] = [];
      const totalPages = Math.ceil(totalCount / 100);
      for (let page = 1; page <= totalPages && page <= 50; page++) {
        const data = await fetchPage(page, 100);
        const items =
          data?.response?.body?.items?.item ?? data?.getMaintenanceBusiness1?.body?.items?.item ?? [];
        allRows.push(...(Array.isArray(items) ? items : items ? [items] : []));
      }

      /* ── 매핑 ── */
      const unmappedStages = new Set<string>();
      let skippedNoName = 0;
      // generationJoo 판정 근거를 매 실행 기록한다 — 다음 사람이 다시 추측하지 않게.
      let genEqGuild = 0, genGtGuildWithZero = 0, genImplausible = 0;

      const mapped: Record<string, any>[] = [];
      for (const r of allRows) {
        if (!r || typeof r !== 'object') continue;

        // ⚠️ 이름이 없으면 건너뛴다. 지어내지 않는다.
        const districtName = clean(r.areaName);
        if (!districtName) { skippedNoName++; continue; }

        const rawStage = clean(r.step);
        const stage = rawStage ? (STAGE_MAP[rawStage] ?? rawStage) : null;
        if (rawStage && !STAGE_MAP[rawStage]) unmappedStages.add(rawStage);

        const gen = num(r.generationJoo);
        const guild = num(r.guildMemNum);
        if (gen != null && guild != null && gen === guild) genEqGuild++;
        if (gen != null && (guild == null || guild === 0)) genGtGuildWithZero++;
        if (gen != null && gen < MIN_PLAUSIBLE_HOUSEHOLDS) genImplausible++;

        mapped.push({
          external_code: clean(r.aCode),
          district_name: districtName,
          region: '부산',
          sigungu: null, // API 가 구·군을 따로 주지 않는다. 지어내지 않는다.
          project_type: districtName.includes('재건축') ? '재건축' : '재개발',
          stage,
          total_households: households(r.generationJoo),
          guild_member_num: num(r.guildMemNum) ?? 0,
          area_sqm: num(r.areaUnit),
          constructor: clean(r.contractor),
          engineer: clean(r.engineer),
          architect: clean(r.architect),
          phone: clean(r.phone) ?? clean(r.telNo),
          address: clean(r.location),
          view_img_url: imgUrl(r.viewImgPath),
          pano_img_url: imgUrl(r.panoImgPath),
          loct_img_url: imgUrl(r.loctImgPath),
          place_img_url: imgUrl(r.placeImgPath),
          source: 'busan_opendata',
          is_active: true,
          updated_at: new Date().toISOString(),
        });
      }

      /* ── upsert (full refresh 아님) ── */
      // external_code 가 없는 행은 upsert 기준이 없다. 이름+출처로도 유일성을 보장할 수 없어
      // 넣지 않는다 — 매 실행 중복이 쌓이는 것보다 낫다.
      const withCode = mapped.filter((m) => m.external_code);
      const skippedNoCode = mapped.length - withCode.length;

      let upserted = 0;
      let failed = 0;
      const errors: string[] = [];
      for (let i = 0; i < withCode.length; i += 100) {
        const batch = withCode.slice(i, i + 100);
        const { error } = await supabase
          .from('redevelopment_projects')
          .upsert(batch, { onConflict: 'external_code' });
        if (error) {
          // ⚠️ 실패를 세어 올린다. 예전에는 실패해도 created 0 으로만 보여 조용했다.
          failed += batch.length;
          if (errors.length < 3) errors.push(error.message.slice(0, 200));
        } else {
          upserted += batch.length;
        }
      }

      return {
        processed: allRows.length,
        created: upserted,
        failed,
        metadata: {
          api_name: 'busan_opendata',
          api_calls: totalPages + 1,
          total_count: totalCount,
          mapped: mapped.length,
          skipped_no_name: skippedNoName,
          skipped_no_code: skippedNoCode,
          unmapped_stages: [...unmappedStages],
          // generationJoo 판정 근거 — 전 행 기준
          gen_eq_guild: genEqGuild,
          gen_with_zero_guild: genGtGuildWithZero,
          gen_below_threshold: genImplausible,
          households_threshold: MIN_PLAUSIBLE_HOUSEHOLDS,
          with_view_img: mapped.filter((m) => m.view_img_url).length,
          errors,
        },
      };
    });

    if (!result.success) return NextResponse.json({ error: result.error }, { status: 200 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    console.error('[cron/crawl-busan-redev]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 200 });
  }
}
