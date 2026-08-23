'use client';

// v3 커밋5 — 목록 상단 큐레이션 캐러셀 (3건).
//
// 모바일: 가로 스냅 1장씩. 데스크탑(≥768px): 3열 그리드 — 3장뿐이라 넘길 것이 없다.
// 진행 점과 `01 / 03` 은 모바일에서만 의미가 있어 데스크탑에서는 숨는다.
//
// ⚠️ 이 캐러셀에 올린 항목을 아래 목록에서 빼지 않는다 (중복 허용).
//    프론트만으로는 불가능하다 — AptHubItem 에 큐레이션 플래그도 apt_sites 조인 키도 없다.
//    이름 문자열 매칭으로 빼는 우회는 쓰지 말 것. get_apt_subscription_hub RPC 수정이 선행돼야 한다.

import { useCallback, useRef, useState } from 'react';

export type CurationCarouselProps = {
  title: string;
  items: React.ReactNode[];
};

export default function CurationCarousel({ title, items }: CurationCarouselProps) {
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const total = items.length;

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !el.clientWidth) return;
    setIdx(Math.min(total - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }, [total]);

  const goTo = useCallback((i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }, []);

  if (total === 0) return null;

  return (
    <section className="kd-cur" aria-label={title}>
      <div className="kd-cur-head">
        <h2 className="kd-cur-title">{title}</h2>
        <span className="kd-cur-count" aria-hidden="true">
          {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="kd-cur-track">
        {items.map((it, i) => (
          <div key={i} className="kd-cur-cell">{it}</div>
        ))}
      </div>

      {total > 1 && (
        <div className="kd-cur-dots">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}번째 항목 보기`}
              aria-current={i === idx}
              onClick={() => goTo(i)}
              className={i === idx ? 'kd-cur-dot is-on' : 'kd-cur-dot'}
            />
          ))}
        </div>
      )}
    </section>
  );
}
