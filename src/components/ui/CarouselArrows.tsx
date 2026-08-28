'use client';
/**
 * B7-0 — 가로 캐러셀의 «마우스로 넘길 수단».
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────────────────
 * 트랙이 `overflow-x: auto` + `scrollbar-width: none` 이라 스크롤바가 «보이지 않는다».
 * 터치는 스와이프로 넘기지만 마우스에는 넘길 방법이 남지 않았다 —
 * Shift+휠을 아는 사람만 볼 수 있는 목록이었다.
 *
 * ⚠️ 터치 기기에서는 «렌더하지 않는다»(CSS `pointer: coarse`). 스와이프가 되는데
 *    버튼까지 얹으면 카드 위에 손가락이 닿는 자리를 뺏는다.
 * ⚠️ 끝에 닿으면 그 방향 버튼을 숨긴다 — 눌러도 아무 일 없는 버튼을 두지 않는다.
 * ⚠️ 키보드로 닿는다(button + aria-label). 화살표가 유일한 수단인 화면에서
 *    포커스가 안 가면 키보드 사용자에게는 여전히 넘길 수단이 없다.
 */

import { useCallback, useEffect, useState } from 'react';

export default function CarouselArrows({
  trackRef,
  label,
}: {
  trackRef: React.RefObject<HTMLDivElement | null>;
  /** 스크린리더용 — 「최근 청약 공고 이전」처럼 읽힌다. */
  label: string;
}) {
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // ⚠️ 1px 여유를 둔다. 소수점 스크롤 위치 때문에 끝에 닿아도 끝으로 안 잡히는 일이 있다.
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, [trackRef]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    // 폭이 바뀌면 「끝인지」도 바뀐다. 창 크기와 내용 변화를 둘 다 본다.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    window.addEventListener('resize', sync);
    return () => {
      el.removeEventListener('scroll', sync);
      ro?.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [trackRef, sync]);

  const nudge = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    // 보이는 폭의 0.9 — 한 화면을 거의 넘기되 «직전 카드 한 조각» 을 남겨
    // 어디서 이어지는지 보이게 한다.
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  // 양쪽 다 끝이면 넘길 것이 없다 — 버튼 자체를 내지 않는다.
  if (atStart && atEnd) return null;

  return (
    <div className="kd-car-arrows" aria-hidden={false}>
      {!atStart && (
        <button type="button" className="kd-car-arrow kd-car-arrow--prev"
                aria-label={`${label} 이전`} onClick={() => nudge(-1)}>
          <span aria-hidden="true">‹</span>
        </button>
      )}
      {!atEnd && (
        <button type="button" className="kd-car-arrow kd-car-arrow--next"
                aria-label={`${label} 다음`} onClick={() => nudge(1)}>
          <span aria-hidden="true">›</span>
        </button>
      )}
    </div>
  );
}
