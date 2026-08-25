'use client';

// 상세 페이지에서 「최근 본 현장」을 기록한다. 화면에는 아무것도 그리지 않는다.
//
// ⚠️ 상세 페이지의 `Promise.allSettled` 뭉치에 넣지 않는다 — 서버 데이터가 아니다.
//    JSX 어디든 한 줄로 매달아 두면 된다.

import { useEffect } from 'react';
import { pushRecentSite } from '@/lib/apt/recent-sites';

export default function RecordRecentView({ slug, name }: { slug: string; name: string }) {
  useEffect(() => {
    pushRecentSite({ slug, name }, Date.now());
  }, [slug, name]);

  return null;
}
