import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { verifyCronAuth } from '@/lib/cron-auth';
import { fetchAll } from '@/lib/db/fetchBatched';
import { extractDong, extractZoneTokens } from '@/lib/permits/match';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * PV2-B2 — 정비사업 현장의 «법정동» 백필.
 *
 * ── 왜 ────────────────────────────────────────────────────────────────────
 * 인허가 매칭의 후보는 법정동 색인으로 뽑는데, 부울경 공고 전 활성 현장 489 중
 * 402(82%)가 `dong` 결측이다. 부산시 정비사업 API 가 위치 필드를 안 주고, 그 현장의
 * address 는 「가마실로 19, 2층」 같은 조합 사무실 주소라 extractDong 도 실패한다.
 * 그 결과 「대연8 재개발」이 색인에 실리지 «못했다» — 미매칭 70건의 뿌리다.
 *
 * ── 채우는 순서 (근거가 강한 것부터) ───────────────────────────────────────
 *  ① `redev_address`  — 정비사업 원천이 준 주소. 「금정구 금사동 26-1번지」처럼
 *                       법정동이 들어 있는 경우가 있다. 이건 «추정이 아니라 원문» 이다.
 *  ② `zone_token`     — 구역명 앞 글자(「부곡2」→부곡)를 그 시군구의 법정동 목록과
 *                       대조해 **유일 매치일 때만** 채운다.
 *
 * ── 법정동 목록을 어디서 얻나 ──────────────────────────────────────────────
 * ⛔ StanReginCd(외부 API)를 새로 붙이지 않았다. 우리는 이미 같은 지역의 법정동을
 *    «권위 있게» 갖고 있다 — `apt_permits` 32,023행의 (sigungu, dong) 다. 매칭 상대가
 *    그 표이므로, 그 표의 어휘로 채우는 것이 목적에도 맞고 새 실패 지점도 안 만든다.
 *
 * ⛔ 조합 사무실 주소를 지오코딩하지 않는다(2026-08-26 실측: 엉뚱한 곳이 나온다).
 * ⛔ 이미 dong 이 있는 행은 건드리지 않는다. 원천이 준 값이 추정보다 세다.
 * ⚠️ 「다의」·「불일치」는 실패가 아니라 «모른다» 의 표기다. 비워 두는 것이 정답이다.
 *
 *   ?dry=1        판정만. 쓰지 않는다
 *   ?region=부산  지역 한정(기본 부산,울산,경남)
 */
interface Row {
  id: string; name: string | null; display_name: string | null; name_variants: unknown;
  region: string | null; sigungu: string | null; dong: string | null;
  address: string | null; source_ids: Record<string, unknown> | null;
}

/** 구역명 앞의 «동 이름 후보» — 「부곡2 재개발」→부곡 · 「서금사재정비촉진5구역」→서금사. */
function zonePrefixes(names: string[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    for (const t of extractZoneTokens(n)) {
      // 토큰은 `접두+식별자` 다. 뒤의 숫자·영문을 떼면 접두가 남는다.
      const p = t.replace(/(\d{1,2}(?:-\d{1,2})?|[A-Z])$/, '');
      if (p.length >= 2) out.add(p);
    }
  }
  return [...out];
}

async function handler(req: NextRequest) {
  const admin = getSupabaseAdmin() as any;
  const sp = req.nextUrl.searchParams;
  const dry = sp.get('dry') === '1';
  const regions = (sp.get('region') || '부산,울산,경남').split(',').filter(Boolean);
  const started = Date.now();

  // ── 법정동 사전: (시군구 → 동 집합). 매칭 상대인 apt_permits 의 어휘를 그대로 쓴다.
  const permitRows = (await fetchAll(admin, 'apt_permits', 'sigungu, dong',
    (q: any) => q.in('sido', regions))) as Array<{ sigungu: string | null; dong: string | null }>;
  const dongsBy = new Map<string, Set<string>>();
  for (const r of permitRows) {
    if (!r.sigungu || !r.dong) continue;
    const set = dongsBy.get(r.sigungu) ?? new Set<string>();
    set.add(r.dong);
    dongsBy.set(r.sigungu, set);
  }

  // ⚠️ sigungu 결측 행도 함께 본다. 그 행은 구역 토큰 색인에 «실리지도» 못하므로
  //    dong 만 채워서는 매칭에 오르지 못한다(실측: 부산 활성 정비사업 36건).
  const sites = (await fetchAll(admin, 'apt_sites',
    'id, name, display_name, name_variants, region, sigungu, dong, address, source_ids',
    (q: any) => q.eq('is_active', true).in('region', regions)
      .or('dong.is.null,sigungu.is.null'))) as Row[];

  // 정비사업 원천 주소 — source_ids.redev_id 로 잇는다.
  const redevIds = [...new Set(sites.map((s) => String((s.source_ids as any)?.redev_id ?? '')).filter(Boolean))];
  const redevAddr = new Map<string, string>();
  for (let i = 0; i < redevIds.length; i += 300) {
    const { data } = await admin.from('redevelopment_projects')
      .select('id, address').in('id', redevIds.slice(i, i + 300));
    for (const r of (data ?? []) as Array<{ id: number | string; address: string | null }>) {
      if (r.address) redevAddr.set(String(r.id), r.address);
    }
  }

  const sigunguNames = [...dongsBy.keys()];
  /** 주소 문자열에서 «우리 사전에 있는» 시군구를 찾는다. 유일할 때만 쓴다. */
  const sigunguFrom = (...texts: Array<string | null | undefined>): string | null => {
    const hits = new Set<string>();
    for (const t of texts) {
      if (!t) continue;
      for (const g of sigunguNames) if (t.includes(g)) hits.add(g);
    }
    return hits.size === 1 ? [...hits][0] : null;
  };

  const stat = { scanned: 0, filled_redev: 0, filled_token: 0, filled_sigungu: 0, ambiguous: 0, no_dict: 0, unresolved: 0 };
  const samples: Array<Record<string, unknown>> = [];
  const ambiguousSamples: Array<Record<string, unknown>> = [];
  let writeFails = 0;
  let firstWriteError: string | null = null;

  for (const s of sites) {
    stat.scanned++;
    const ra = redevAddr.get(String((s.source_ids as any)?.redev_id ?? ''));

    // ⓪ 시군구부터. 이게 없으면 구역 토큰 축이 통째로 안 열린다.
    let sigungu = s.sigungu;
    let sigunguFilled = false;
    if (!sigungu) {
      const g = sigunguFrom(ra, s.address);
      if (g) { sigungu = g; sigunguFilled = true; }
    }
    const dict = sigungu ? dongsBy.get(sigungu) : undefined;

    if (s.dong) {
      // dong 은 이미 있고 sigungu 만 비어 있던 행 — 그것만 채우고 넘어간다.
      if (sigunguFilled) {
        stat.filled_sigungu++;
        if (samples.length < 15) samples.push({ name: s.name, sigungu, dong: s.dong, source: 'sigungu_only' });
        if (!dry) {
          const { error } = await admin.from('apt_sites').update({ sigungu }).eq('id', s.id);
          if (error) { writeFails++; if (firstWriteError == null) firstWriteError = String(error.message ?? error).slice(0, 200); }
        }
      }
      continue;
    }

    // ① 원천 주소
    let dong = extractDong(ra) ?? extractDong(s.address);
    let source: 'redev_address' | 'zone_token' | null = dong ? 'redev_address' : null;

    // ② 구역 토큰 → 그 시군구 법정동과 유일 매치
    if (!dong) {
      if (!dict) { stat.no_dict++; continue; }
      const names = [s.name, s.display_name, ...(Array.isArray(s.name_variants) ? s.name_variants : [])]
        .filter((v): v is string => typeof v === 'string' && v.length > 0);
      const hits = new Set<string>();
      for (const p of zonePrefixes(names)) {
        for (const d of dict) if (d.startsWith(p)) hits.add(d);
      }
      if (hits.size === 1) { dong = [...hits][0]; source = 'zone_token'; }
      else if (hits.size > 1) {
        stat.ambiguous++;
        if (ambiguousSamples.length < 10) ambiguousSamples.push({ name: s.name, sigungu, hits: [...hits] });
        continue;
      } else { stat.unresolved++; continue; }
    }

    // ⚠️ 사전에 없는 동을 채우지 않는다 — 원천 주소가 인접 시군구를 가리키는 경우가 있다.
    if (dict && !dict.has(dong)) { stat.unresolved++; continue; }

    if (source === 'redev_address') stat.filled_redev++; else stat.filled_token++;
    if (samples.length < 15) samples.push({ name: s.name, sigungu, dong, source });

    if (sigunguFilled) stat.filled_sigungu++;
    if (!dry) {
      const patch: Record<string, unknown> = { dong, dong_source: source };
      if (sigunguFilled) patch.sigungu = sigungu;
      const { error } = await admin.from('apt_sites')
        .update(patch).eq('id', s.id);
      if (error) {
        writeFails++;
        if (firstWriteError == null) firstWriteError = String(error.message ?? error).slice(0, 200);
      }
    }
  }

  return {
    processed: stat.filled_redev + stat.filled_token,
    metadata: {
      dry, regions, ...stat,
      dict_sigungu: dongsBy.size,
      // ⚠️ 0 이 아니면 그 실행은 판정만 하고 아무것도 못 바꾼 것이다(R1).
      write_fails: writeFails, first_write_error: firstWriteError,
      samples, ambiguous_samples: ambiguousSamples,
      elapsed_ms: Date.now() - started,
    },
  };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await withCronLogging('site-dong-backfill', () => handler(req));
  return NextResponse.json(result);
}
