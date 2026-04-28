// 서버 전용 — Vercel edge IP 로 기본 region 추론.
// 클라이언트에서 import 금지 (next/headers 가 server-only).
// 17 시도 상수 / localStorage helper 는 region-storage.ts.

import { headers } from 'next/headers';

const IP_REGION_MAP: Record<string, string> = {
  'KR-11': '서울', 'KR-26': '부산', 'KR-27': '대구', 'KR-28': '인천',
  'KR-29': '광주', 'KR-30': '대전', 'KR-31': '울산', 'KR-50': '세종',
  'KR-41': '경기', 'KR-42': '강원', 'KR-43': '충북', 'KR-44': '충남',
  'KR-45': '전북', 'KR-46': '전남', 'KR-47': '경북', 'KR-48': '경남',
  'KR-49': '제주',
};

export async function detectDefaultRegion(): Promise<string> {
  try {
    const h = await headers();
    // Vercel 은 x-vercel-ip-country-region 에 ISO 3166-2 두 자리 코드 만 (앞에 KR- 없이) 보낸다.
    const ipRegion = h.get('x-vercel-ip-country-region');
    if (ipRegion) {
      const mapped = IP_REGION_MAP[`KR-${ipRegion}`];
      if (mapped) return mapped;
    }
  } catch {
    // headers() 가 사용 불가능한 컨텍스트 (정적 prerender 등) — fallback
  }
  return '서울';
}
