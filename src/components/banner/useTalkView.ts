'use client';

// 배너가 실제로 화면에 들어왔을 때만 노출로 센다.
// 마운트 시점에 세면 접힘 블록·화면 밖 배너까지 노출로 잡혀 클릭률이 실제보다 낮게 나온다.

import { useEffect, useRef } from 'react';
import { trackTalkView, type TalkSlot, type TalkTrackProps } from '@/lib/talk-banner';

/**
 * 반환한 ref 를 배너 루트에 걸면 뷰포트 진입 시 1회 노출을 기록한다.
 * IntersectionObserver 미지원 환경에서는 마운트 시 1회 기록으로 떨어진다.
 */
export function useTalkView<T extends HTMLElement>(slot: TalkSlot, props: TalkTrackProps = {}) {
  const ref = useRef<T>(null);
  // props 를 deps 에 넣으면 매 렌더마다 observer 를 다시 만든다 — ref 로 최신값만 들고 있는다.
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const el = ref.current;
    // ref 가 안 붙었다면 배너가 렌더되지 않았거나(라우트 제외) 집계 대상이 아닌 인스턴스다.
    // 여기서 기록하면 화면에 없던 배너까지 노출로 잡혀 클릭률이 실제보다 낮게 나온다.
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      trackTalkView(slot, propsRef.current);
      return;
    }
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          trackTalkView(slot, propsRef.current);
          io.disconnect();
          return;
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [slot]);

  return ref;
}
