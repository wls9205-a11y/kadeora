// 클라이언트 저장 / 17 시도 상수 — 클라이언트·서버 양쪽에서 import 가능.
// 서버 IP geolocation (next/headers) 은 region-detection.ts 에 분리.

export const KR_REGIONS_17 = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const;

export type KrRegion = (typeof KR_REGIONS_17)[number];

const STORAGE_KEY = 'kadeora_region_v1';

export interface StoredRegion {
  region: string;
  sigungu: string | null;
}

export function getStoredRegion(): StoredRegion | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.region || typeof parsed.region !== 'string') return null;
    return {
      region: parsed.region,
      sigungu: typeof parsed.sigungu === 'string' && parsed.sigungu ? parsed.sigungu : null,
    };
  } catch {
    return null;
  }
}

export function setStoredRegion(region: string, sigungu: string | null = null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ region, sigungu, ts: Date.now() }),
    );
  } catch {
    // localStorage 가 차단된 환경 (incognito 등) — 무시
  }
}

export function clearStoredRegion(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}
