// V16 E-3 — 이번 주 움직인 현장.
//
// apt_site_events 최근 7일 stage_change 를 /apt 상단에 낸다.
// 카더라가 남보다 빠르다는 걸 보여주는 자리다 — 어제 총회에서 시공사가 정해진 현장이
// 오늘 여기 올라와 있으면 그게 증거다.
//
// ⚠️ 0건이면 호출부가 섹션을 렌더하지 않는다. "이번 주 움직인 현장 없음" 을 내지 않는다.
// ⚠️ 등급(confidence)을 그대로 실어 보낸다. 추정·카더라를 확정처럼 보이게 하지 않는다.

import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { BUGYEONG, BUGYEONG_REGIONS } from '@/lib/apt/pipeline';

/** /apt 허브·파이프라인과 같은 900초. 단계 변경은 분 단위로 다투는 값이 아니다. */
export const RECENT_MOVES_REVALIDATE_SECONDS = 900;

/** 섹션에 낼 건수. 더 늘리면 상단에서 스크롤을 다 먹는다. */
export const RECENT_MOVES_LIMIT = 6;

export const RECENT_MOVES_WINDOW_DAYS = 7;

export interface AptRecentMove {
  id: string;
  site_slug: string | null;
  name: string;
  region: string | null;
  sigungu: string | null;
  builder: string | null;
  thumb_url: string | null;
  /** 바뀐 뒤 단계. 라벨은 lib/apt/lifecycle-label.ts 가 붙인다. */
  to_stage: string | null;
  from_stage: string | null;
  confidence: string | null;
  source: string | null;
  note: string | null;
  occurred_at: string;
}

function scopeRegions(region: string): string[] | null {
  if (region === '전국') return null;
  if (region === BUGYEONG) return [...BUGYEONG_REGIONS];
  return [region];
}

async function fetchRecentMovesUncached(region: string, limit: number): Promise<AptRecentMove[]> {
  try {
    const sb = getSupabaseAdmin();
    const since = new Date(Date.now() - RECENT_MOVES_WINDOW_DAYS * 86_400_000).toISOString();
    const regions = scopeRegions(region);

    // apt_site_events → apt_sites 임베드. FK(apt_site_events_site_id_fkey)가 있어 !inner 가 먹는다.
    // 지역 필터를 임베드 쪽에 걸어야 조인 후 거르지 않고 DB 에서 잘린다.
    let q = (sb as any)
      .from('apt_site_events')
      .select(
        'id, site_slug, to_value, from_value, confidence, source, note, occurred_at, ' +
          'apt_sites!inner(slug, name, region, sigungu, builder, hero_image_url, satellite_image_url, is_active)',
      )
      .eq('event_type', 'stage_change')
      .gte('occurred_at', since)
      .eq('apt_sites.is_active', true)
      .order('occurred_at', { ascending: false })
      // 같은 현장이 한 주에 두 번 움직이면 최신만 남긴다. 넉넉히 받아 코드에서 접는다.
      .limit(limit * 4);
    if (regions) q = q.in('apt_sites.region', regions);

    const { data, error } = await q;
    if (error) {
      console.error('[apt/recent-moves]', JSON.stringify(error));
      return [];
    }

    const seen = new Set<string>();
    const out: AptRecentMove[] = [];
    for (const r of (data ?? []) as any[]) {
      const s = r.apt_sites;
      if (!s) continue;
      const slug = s.slug ?? r.site_slug;
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push({
        id: r.id,
        site_slug: slug,
        name: s.name ?? '',
        region: s.region ?? null,
        sigungu: s.sigungu ?? null,
        builder: s.builder ?? null,
        thumb_url: s.hero_image_url ?? s.satellite_image_url ?? null,
        to_stage: r.to_value ?? null,
        from_stage: r.from_value ?? null,
        confidence: r.confidence ?? null,
        source: r.source ?? null,
        note: r.note ?? null,
        occurred_at: r.occurred_at,
      });
      if (out.length >= limit) break;
    }
    console.log(`[apt/recent-moves] region=${region} items=${out.length}`);
    return out;
  } catch (e: any) {
    console.error('[apt/recent-moves] caught:', e?.message ?? String(e));
    return [];
  }
}

const fetchRecentMovesCached = unstable_cache(fetchRecentMovesUncached, ['apt-recent-moves'], {
  revalidate: RECENT_MOVES_REVALIDATE_SECONDS,
  tags: ['apt-recent-moves'],
});

/** 빈 결과는 캐시에 굳히지 않는다 (Rule #66). */
export async function getAptRecentMoves(
  region: string,
  limit: number = RECENT_MOVES_LIMIT,
): Promise<AptRecentMove[]> {
  const cached = await fetchRecentMovesCached(region, limit);
  if (cached.length > 0) return cached;
  return fetchRecentMovesUncached(region, limit);
}
