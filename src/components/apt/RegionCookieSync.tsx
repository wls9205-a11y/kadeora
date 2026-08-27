'use client';
/**
 * H5-2 — 지금 보고 있는 지역을 쿠키에 남긴다.
 *
 * ── 왜 별도 조각인가 ────────────────────────────────────────────────────────
 * 서버 컴포넌트는 «쿠키를 쓸 수 없다»(Route Handler / Server Action 에서만 가능).
 * 그리고 타일 클릭만으로는 부족하다 — `?region=서울` 링크로 «바로 들어온» 사용자는
 * 타일을 누른 적이 없어서 쿠키가 안 남고, 다음 방문에 다시 1단을 본다.
 *
 * 그래서 2단이 열린 «모든» 경로에서 이 조각이 한 번 쓴다.
 *
 * ⚠️ 렌더는 아무것도 하지 않는다(null). 화면에 흔적을 남기지 않는다.
 * ⚠️ 값이 이미 같으면 다시 쓰지 않는다 — max-age 를 매 방문 갱신할 이유는 있지만,
 *    document.cookie 쓰기를 렌더마다 반복할 이유는 없다.
 */

import { useEffect } from 'react';
import { readRegionCookie, writeRegionCookie } from '@/lib/region/cookie';

export default function RegionCookieSync({ region }: { region: string }) {
  useEffect(() => {
    if (!region) return;
    if (readRegionCookie() === region) return;
    writeRegionCookie(region);
  }, [region]);
  return null;
}
