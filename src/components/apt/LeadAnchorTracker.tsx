'use client';

// P0-A′ — 점프바 CTA 계측. «하필 그 버튼만» 계측이 하나도 없었다.
//
// ── 왜 이것이 급한가 ──
// 8/25~8/30 내내 «어디도 가리키지 않는 앵커» 였던 버튼이 바로 이것이다(43b09436).
// 그런데 user_events 에 그 클릭은 **한 건도 없다** — 계측이 없으니 「눌렀는데 아무 일도
// 없었다」는 사실이 기록될 자리조차 없었다. 하단 바의 17:0 은 «기록된» 피해였고,
// 이 버튼의 피해는 아직 «크기를 모르는» 피해다. 그래서 자부터 놓는다.
//
// ── 왜 SiteJumpBar 안에 넣지 않나 ──
// ⛔ 그 파일은 「클라이언트 JS 없는 순수 앵커」가 설계 조건이다 — 히어로가 LCP 요소라
//    바로 아래에 하이드레이션 비용을 얹지 않는다는 근거가 파일 상단에 적혀 있다.
//    계측을 넣자고 그 조건을 깨지 않는다. 계측만 «별도 섬» 으로 떼어, DOM 에서
//    그 앵커를 찾아 리스너를 건다. 마크업은 서버가 그대로 그리고, 자만 클라에 선다.
//
// ── 왜 hashchange 가 아닌가 ──
// ⛔ 이미 `#lead-form` 인 상태에서 다시 누르면 hashchange 는 «나지 않는다».
//    재클릭도 신호인데(lead-track: 클릭은 중복 제거하지 않는다) 그 신호를 통째로 잃는다.
//    실제 앵커 요소에 리스너를 건다.

import { useEffect, useRef } from 'react';
import { LEAD_FORM_ID } from '@/lib/apt/detail-anchors';
import { trackLeadClick, trackLeadView, type LeadTrackProps } from '@/lib/apt/lead-track';

/** 점프바 «안» 의 리드폼 앵커만 잡는다 — 레일·본문의 같은 href 를 삼키지 않게. */
const SELECTOR = `nav.kd-jumpbar a[href="#${LEAD_FORM_ID}"]`;

export default function LeadAnchorTracker({
  siteSlug,
  lifecycleStage,
}: {
  siteSlug: string;
  lifecycleStage?: string | null;
}) {
  const propsRef = useRef<LeadTrackProps>({});
  propsRef.current = { site_slug: siteSlug, lifecycle_stage: lifecycleStage };

  useEffect(() => {
    const el = document.querySelector<HTMLAnchorElement>(SELECTOR);
    // ⚠️ 없으면 조용히 끝낸다 — cta.show=false 이거나 칩이 2개 미만이면 점프바 자체가
    //    렌더되지 않는다(SiteJumpBar). 그것은 결함이 아니라 정상 분기다.
    if (!el) return;

    const onClick = () => trackLeadClick('jumpbar', propsRef.current);
    el.addEventListener('click', onClick);

    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        entries => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            trackLeadView('jumpbar', propsRef.current);
            io?.disconnect();
            return;
          }
        },
        { threshold: 0.5 },
      );
      io.observe(el);
    } else if (el.getClientRects().length > 0) {
      trackLeadView('jumpbar', propsRef.current);
    }

    return () => {
      el.removeEventListener('click', onClick);
      io?.disconnect();
    };
  }, []);

  return null;
}
