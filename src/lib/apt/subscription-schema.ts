// src/lib/apt/subscription-schema.ts — s273
// /apt 구조화 데이터. 접수중/예정 단지 Event JSON-LD + ItemList.
//
// Event 를 쓰는 이유: 청약은 "시작·마감이 있는 참여 기간" 이라 Event 가 가장 정확한 타입이다.
// (CLAUDE.md PART 3-B 의 "청약: Event schema (접수 시작/마감일)" 방침과 일치)
//
// startDate/endDate 는 접수 시작/마감. 둘 다 없는 건 Event 로 내보내지 않는다 —
// 날짜 없는 Event 는 구글이 무효 항목으로 처리한다.

import { SITE_URL } from '@/lib/constants';
import { aptHref, type AptHubItem } from '@/lib/apt/hub';
import { formatComplexName } from '@/lib/apt/subscription-status';

type JsonLd = Record<string, unknown>;

/** 접수 기간이 유효해서 Event 로 내보낼 수 있는 상태만. */
const EVENT_STATUSES = new Set(['open', 'upcoming', 'scheduled']);

export function buildSubscriptionEvents(items: AptHubItem[]): JsonLd[] {
  return items
    .filter((it) => EVENT_STATUSES.has(it.status) && it.rcept_bgnde && it.rcept_endde)
    .map((it) => {
      const name = formatComplexName(it.region_nm, it.house_nm);
      const url = `${SITE_URL}${aptHref(it)}`;
      return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: `${name} 아파트 청약 접수`,
        description:
          `${name} 청약 1순위 접수 기간 안내.` +
          (it.households ? ` 총 ${it.households.toLocaleString('ko-KR')}세대 공급.` : ''),
        startDate: it.rcept_bgnde,
        endDate: it.rcept_endde,
        // 접수 예정/접수중 모두 '예정대로 진행' — 취소/연기 신호는 원천 데이터에 없다.
        eventStatus: 'https://schema.org/EventScheduled',
        // 청약 접수는 청약홈에서 온라인으로 이뤄진다.
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        url,
        location: {
          '@type': 'VirtualLocation',
          url: it.pblanc_url || url,
        },
        ...(it.supply_addr
          ? {
              about: {
                '@type': 'Place',
                name,
                address: {
                  '@type': 'PostalAddress',
                  addressCountry: 'KR',
                  addressRegion: it.region_nm ?? undefined,
                  streetAddress: it.supply_addr,
                },
              },
            }
          : {}),
        organizer: {
          '@type': 'Organization',
          name: '카더라',
          url: SITE_URL,
        },
      };
    });
}

/** 카드 리스트 순서를 그대로 반영하는 ItemList. */
export function buildSubscriptionItemList(items: AptHubItem[], region: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${region} 아파트 청약 일정`,
    numberOfItems: items.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: formatComplexName(it.region_nm, it.house_nm),
      url: `${SITE_URL}${aptHref(it)}`,
    })),
  };
}
