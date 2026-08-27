/**
 * A5 — 현장 엔티티 한 곳.
 *
 * ── 왜 함수 하나인가 ────────────────────────────────────────────────────────
 * /apt/[id] · /blog/[slug] · /apt/region/* 세 화면이 같은 현장을 «각자» JSON-LD 로
 * 그리고 있었다. 그러면 같은 현장이 검색엔진에 서로 다른 노드로 보인다.
 * `@id` 를 한 곳에서 만들어야 세 화면이 «같은 것을 말하고 있다» 고 인식된다.
 *
 * ⛔ 여기서 새 필드를 지어내지 않는다. DB 에 있는 값만 옮긴다.
 *    값이 없으면 «키를 넣지 않는다» — 빈 문자열을 넣으면 구조화 데이터 오류가 된다.
 */

import { SITE_URL } from '@/lib/constants';

export interface SiteEntityInput {
  id: string;                 // apt_sites.id (uuid)
  slug?: string | null;
  name?: string | null;
  display_name?: string | null;
  region?: string | null;
  sigungu?: string | null;
}

export interface SiteEntity {
  '@type': 'Place';
  '@id': string;
  name: string;
  url: string;
  address?: {
    '@type': 'PostalAddress';
    addressRegion?: string;
    addressLocality?: string;
    addressCountry: 'KR';
  };
}

/** 현장 하나의 정본 `@id`. 화면이 달라도 이 문자열은 같아야 한다. */
export function siteEntityId(idOrSlug: string): string {
  return `${SITE_URL}/apt/${idOrSlug}#site`;
}

/**
 * 현장 → Place 노드.
 *
 * ⚠️ URL 은 slug 를 쓴다. `/apt/[id]` 라우트가 실제로 받는 것이 slug 다
 *    (uuid 로는 열리지 않는다). @id 도 같은 값으로 맞춘다 — 둘이 갈리면
 *    검색엔진이 서로 다른 두 개로 본다.
 */
export function siteEntity(site: SiteEntityInput | null | undefined): SiteEntity | null {
  if (!site) return null;
  const key = site.slug || site.id;
  const name = (site.display_name || site.name || '').trim();
  if (!key || !name) return null;      // 이름 없는 노드는 만들지 않는다

  const node: SiteEntity = {
    '@type': 'Place',
    '@id': siteEntityId(key),
    name,
    url: `${SITE_URL}/apt/${key}`,
  };

  if (site.region || site.sigungu) {
    node.address = {
      '@type': 'PostalAddress',
      ...(site.region ? { addressRegion: site.region } : {}),
      ...(site.sigungu ? { addressLocality: site.sigungu } : {}),
      addressCountry: 'KR',
    };
  }
  return node;
}

/** 여러 현장 → Place 배열. null 은 버린다. */
export function siteEntities(sites: (SiteEntityInput | null | undefined)[]): SiteEntity[] {
  return sites.map(siteEntity).filter((x): x is SiteEntity => x !== null);
}
