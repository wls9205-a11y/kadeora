'use client';

// V15 B — 접이식 점진 향상. 두 가지만 한다.
//
//   ① 데스크탑(≥1024px)에서 [data-open-desktop] 섹션을 기본 열림으로 바꾼다.
//      넓은 화면에 접힌 줄만 늘어서 있으면 허전하다. 모바일은 서버 렌더 그대로 둔다.
//   ② 점프바 칩(#id)으로 이동할 때 그 섹션을 열고 스크롤한다.
//      브라우저의 fragment 자동 확장은 지원이 갈려서 직접 처리한다.
//
// ⚠️ 콘텐츠를 만들거나 지우지 않는다. open 속성만 건드린다 —
//    DOM 에서 무언가 사라지면 색인이 흔들린다.
// ⚠️ 히어로(LCP) 근처에 두지 말 것. 페이지 하단에서 마운트한다.

import { useEffect } from 'react';

const DESKTOP = '(min-width: 1024px)';

export default function AccordionEnhancer() {
  useEffect(() => {
    // ① 데스크탑 기본 열림 — 최초 1회만. 이후 사용자가 닫은 걸 되돌리지 않는다.
    try {
      if (window.matchMedia(DESKTOP).matches) {
        document
          .querySelectorAll<HTMLDetailsElement>('details.kd-acc[data-open-desktop]')
          .forEach((el) => {
            el.open = true;
          });
      }
    } catch {
      // matchMedia 가 없는 환경 — 서버 렌더 상태 그대로 둔다.
    }

    // ② 해시 대상 열기
    const openHash = (smooth: boolean) => {
      const raw = window.location.hash.slice(1);
      if (!raw) return;
      let id = raw;
      try {
        id = decodeURIComponent(raw);
      } catch {
        /* 원문 그대로 */
      }
      const el = document.getElementById(id);
      if (!el) return;
      // 대상이 아코디언이면 열고, 아코디언 안이면 조상까지 전부 연다.
      const target = el instanceof HTMLDetailsElement ? el : el.closest('details');
      let node: Element | null = target;
      while (node) {
        if (node instanceof HTMLDetailsElement) node.open = true;
        node = node.parentElement?.closest('details') ?? null;
      }
      if (smooth) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // 첫 진입(딥링크)은 스크롤을 브라우저에 맡기고 열기만 한다 — 두 번 튀지 않게.
    openHash(false);
    const onHash = () => openHash(true);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return null;
}
