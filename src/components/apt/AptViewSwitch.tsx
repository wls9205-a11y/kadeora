'use client';
// H4-4 — `/apt` 의 [목록 | 지도] 뷰 전환.
//
// ⚠️ **지도는 목록의 «대체» 가 아니라 뷰 전환이다.**
//    기본값이 목록이고, 서버가 렌더한 목록(children)이 그대로 HTML 에 실린다.
//    크롤러는 지도 토글을 누르지 않으므로 «항상 목록을 본다» — `/apt` 색인이 깨지지 않는다.
//    children 을 조건부로 «언마운트하지 않는» 이유가 그것이다: 지도를 보는 동안에도
//    목록은 DOM 에 남기고 CSS 로만 감춘다. 토글이 색인 자산을 지우면 안 된다.
//
// ⚠️ `/apt/map` 라우트는 그대로 둔다(robots noindex 포함). 여기는 같은 MapClient 를
//    빌려 쓸 뿐이고, 그 라우트를 대체하지 않는다.
//
// ⚠️ 지도는 «클라이언트에서» 자기 데이터를 가져온다. `/apt` 의 서버 Promise.all 에
//    조회를 더하지 않는다 (Rule #49 — /apt/[id] 의 8개 뭉치가 504 를 낸 전례).
//    그래서 목록만 보는 사용자는 지도 비용을 한 푼도 내지 않는다.

import { useState } from 'react';
import dynamic from 'next/dynamic';

const MapClient = dynamic(() => import('@/app/(main)/apt/map/MapClient'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
      지도를 불러오는 중…
    </div>
  ),
});

type View = 'list' | 'map';

export default function AptViewSwitch({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<View>('list');

  const btn = (v: View, label: string) => {
    const on = view === v;
    return (
      <button
        key={v}
        type="button"
        onClick={() => setView(v)}
        aria-pressed={on}
        style={{
          flex: 1,
          minHeight: 34,
          padding: '0 12px',
          border: 0,
          borderRadius: 'var(--radius-pill)',
          background: on ? 'var(--bg-surface)' : 'transparent',
          boxShadow: on ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
          color: on ? 'var(--text-primary)' : 'var(--text-tertiary)',
          // 라벨 500 — TY1 사다리(라벨·배지·칩). 자간은 14px 이하라 0.
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: 0,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <>
      <div
        role="group"
        aria-label="보기 전환"
        style={{
          display: 'flex',
          gap: 3,
          margin: '0 6px var(--sp-sm)',
          padding: 3,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--bg-hover)',
          border: '1px solid var(--border)',
        }}
      >
        {btn('list', '목록')}
        {btn('map', '지도')}
      </div>

      {/* ⚠️ `display:none` 이지 언마운트가 아니다 — 위 주석의 색인 이유. */}
      <div hidden={view !== 'list'}>{children}</div>
      {view === 'map' && (
        <div style={{ margin: '0 0 var(--sp-md)' }}>
          <MapClient />
        </div>
      )}
    </>
  );
}
