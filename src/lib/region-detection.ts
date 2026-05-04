// Edge-runtime safe — no next/headers, no fs, no process.cwd().
// Used by middleware (Edge) for IP geolocation → region resolution.

import { KR_REGIONS_17 } from './region-storage';

export { KR_REGIONS_17 };

const VALID_SET: ReadonlySet<string> = new Set<string>([...KR_REGIONS_17, '전국']);

export function isValidKrRegion(s: string | null | undefined): boolean {
  if (!s) return false;
  return VALID_SET.has(s);
}

// ISO 3166-2:KR 2-digit suffix → 한글 시도명.
// Vercel `x-vercel-ip-country-region` 은 'KR-' prefix 없이 bare suffix 만 보냄.
const ISO_TO_REGION: Record<string, string> = {
  '11': '서울',
  '26': '부산',
  '27': '대구',
  '28': '인천',
  '29': '광주',
  '30': '대전',
  '31': '울산',
  '41': '경기',
  '42': '강원',
  '43': '충북',
  '44': '충남',
  '45': '전북',
  '46': '전남',
  '47': '경북',
  '48': '경남',
  '49': '제주',
  '50': '세종',
};

export function isoToKrRegion(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return ISO_TO_REGION[iso] ?? null;
}
