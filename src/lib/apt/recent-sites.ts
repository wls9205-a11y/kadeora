// 「최근 본 현장」 로컬 저장소 — C-0 블록 3.
//
// ⚠️ 슬러그에서 이름을 되만들지 않는다. 상세 페이지가 DB 의 name 을 그대로 넘겨 주고
//    여기서는 받은 값만 쓴다. (`엄궁역-트라비스-하늘채` → `엄궁역 트라비스 하늘채` 로
//    푸는 코드를 넣으면 괄호·중점이 들어간 이름에서 곧바로 어긋난다.)
//
// ⚠️ 서버에서 부르지 않는다. localStorage 는 브라우저에만 있다 —
//    호출부는 전부 'use client' 다.

export const RECENT_SITES_KEY = 'kd_recent_sites';

/** 저장 상한. 홈은 3개만 쓰지만 지운 뒤 되돌아오는 경우를 위해 여유를 둔다. */
const MAX = 10;

export interface RecentSite {
  slug: string;
  name: string;
  /** epoch ms. 정렬용. */
  at: number;
}

function isRecentSite(v: unknown): v is RecentSite {
  if (!v || typeof v !== 'object') return false;
  const r = v as Partial<RecentSite>;
  return typeof r.slug === 'string' && r.slug.length > 0
    && typeof r.name === 'string' && r.name.length > 0
    && typeof r.at === 'number' && Number.isFinite(r.at);
}

/**
 * 저장된 목록. 깨진 값이 섞여 있으면 그 항목만 버린다.
 * 사생활 모드·저장소 차단 브라우저에서 getItem 자체가 던지므로 전부 감싼다.
 */
export function readRecentSites(limit = MAX): RecentSite[] {
  try {
    const raw = localStorage.getItem(RECENT_SITES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentSite).sort((a, b) => b.at - a.at).slice(0, limit);
  } catch {
    return [];
  }
}

/** 방문 기록. 같은 슬러그는 하나로 합치고 맨 앞으로 올린다. */
export function pushRecentSite(site: { slug: string; name: string }, now: number): void {
  const slug = (site.slug ?? '').trim();
  const name = (site.name ?? '').trim();
  if (!slug || !name) return;
  try {
    const next = [{ slug, name, at: now }, ...readRecentSites(MAX).filter((r) => r.slug !== slug)]
      .slice(0, MAX);
    localStorage.setItem(RECENT_SITES_KEY, JSON.stringify(next));
  } catch {
    /* 저장 실패는 조용히 넘긴다 — 이 기능 때문에 상세 페이지가 깨지면 안 된다. */
  }
}
