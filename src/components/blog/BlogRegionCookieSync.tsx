'use client';
/**
 * H5-3 — 블로그에서 고른 지역을 부동산 탭과 «같은 쿠키» 에 남긴다.
 *
 * ⚠️ 서버 컴포넌트는 쿠키를 못 쓴다(Route Handler / Server Action 에서만 가능).
 *    그리고 세그먼트가 서버 렌더 <Link> 라 클릭 핸들러도 못 단다.
 *    그래서 「지금 보고 있는 지역」을 렌더 뒤에 한 번 쓴다.
 *
 * ⚠️ 두 탭이 다른 지역을 말하면 그건 고장으로 읽힌다. 쿠키 이름·수명·SameSite 는
 *    lib/region/cookie.ts 한 곳에서만 정한다.
 *
 * ⚠️ `region` 이 빈 문자열이면(=전체 보기) «아무것도 하지 않는다».
 *    「전체」를 골랐다고 부동산 탭의 지역 선택까지 지우면 안 된다 —
 *    블로그의 「전체」는 지역 해제가 아니라 «지역을 안 건 상태» 다.
 */

import { useEffect } from 'react';
import { readRegionCookie, writeRegionCookie } from '@/lib/region/cookie';

export default function BlogRegionCookieSync({ region }: { region: string }) {
  useEffect(() => {
    if (!region) return;
    if (readRegionCookie() === region) return;
    writeRegionCookie(region);
  }, [region]);
  return null;
}
