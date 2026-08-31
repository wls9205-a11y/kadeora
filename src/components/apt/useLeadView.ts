'use client';

// §5-3 보완 — 리드폼 «진입점» 노출을 뷰포트 기준으로 센다 (P0-A′).
//
// ── 왜 따로 두나 ──
// useTalkView 와 형태는 같지만 «분모의 조건» 이 다르다. 카톡 노출은 폼 유무와 무관하고,
// 리드 노출은 «폼이 있는 현장에서만» 세야 한다 — 없는 현장까지 세면 분모가 부푼다.
// (SiteActionBar 가 이미 `if (hasForm)` 로 그렇게 하고 있다. 두 벌의 판정을 만들지 않는다.)
// 그 조건은 호출자가 `enabled` 로 주고, 이 훅은 «화면에 들어왔는가» 만 책임진다.
//
// ⚠️ 마운트 시점에 세지 않는다. 레일은 <1024px 에서 `display:none` 이라(components.css:367)
//    «마운트는 되고 화면에는 없다» — 마운트로 세면 모바일 전량이 레일 노출로 잡힌다.
//    IntersectionObserver 는 display:none 요소의 교차를 보고하지 않으므로 이 훅은
//    그 착시를 «구조적으로» 막는다. 폴백 경로도 같은 이유로 상자 유무를 먼저 본다.

import { useEffect, useRef } from 'react';
import { trackLeadView, type LeadSlot, type LeadTrackProps } from '@/lib/apt/lead-track';

/**
 * 반환한 ref 를 진입점 루트에 걸면 뷰포트 진입 시 1회 노출을 기록한다.
 * @param enabled 폼이 실제로 그 페이지에 렌더되는가 (분모 조건)
 */
export function useLeadView<T extends HTMLElement>(
  slot: LeadSlot,
  enabled: boolean,
  props: LeadTrackProps = {},
) {
  const ref = useRef<T>(null);
  // props 를 deps 에 넣으면 매 렌더마다 observer 를 다시 만든다 — ref 로 최신값만 들고 있는다.
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      // ⛔ 폴백에서도 «마운트 = 노출» 로 떨어뜨리지 않는다. 미지원 환경에서도 레일은
      //    여전히 display:none 일 수 있다 — 자기 상자가 그려졌는지부터 본다.
      if (el.getClientRects().length > 0) trackLeadView(slot, propsRef.current);
      return;
    }

    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          trackLeadView(slot, propsRef.current);
          io.disconnect();
          return;
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [slot, enabled]);

  return ref;
}
