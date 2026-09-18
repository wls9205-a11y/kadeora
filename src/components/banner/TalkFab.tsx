'use client';

// 부정공 단톡방 입장 FAB — 전역 우하단 (UI_INSTRUCTION_20260910 §1.B).
//
// 왜 있나: 이 자리에는 글쓰기 FAB(/write)가 떠 있었다. 작성 진입점은 이미 4곳
// (데스크톱 사용자 메뉴 · 더보기 시트 · GlobalMissionBar · 피드 EmptyState)이 있어
// 이 자리가 유일 경로가 아니었고, 방으로 보내는 동선이 더 급했다.
// 피드 목록 상단에 작성 버튼을 «같은 커밋» 에서 신설해 진입 밀도를 보강한다.
//
// ⛔ 카카오 CI(말풍선 심볼)를 쓰지 않는다. 브랜드 자산 사용 조건이 따로 있고,
//    이 버튼이 가리키는 것은 «카카오» 가 아니라 «부정공 방» 이다.
//
// ⚠️ 인라인 style 에 display 를 두지 «않는다». 반응형 display 클래스(md:hidden 등)는
//    특정성 0,1,0 이라 인라인 1,0,0,0 에 언제나 진다. Navigation.tsx 547·490 이
//    정확히 그 함정으로 「모바일 전용」이 전 폭 노출로 살아 있었다(2026-09-10 실측).
//    기하·표시는 전부 components.css 의 .kd-talk-fab 이 갖는다.
//
// ⚠️ 노출 표면은 «걷어낸 글쓰기 FAB 와 동일» 하다 — 현장 상세 제외.
//    그 화면의 우하단은 SiteFloatingActions 의 문서화된 점유 지도(68/124/180 +54)가
//    쓰고 있고, 단톡방 CTA 도 이미 4개 있다. 겹침과 중복을 동시에 만들지 않는다.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { KAKAO_TALK_URL, trackTalkClick } from '@/lib/talk-banner';
import { useTalkView } from './useTalkView';
import { isAptSiteDetailPath } from '@/lib/apt/is-site-detail';

const KAKAO_YELLOW = '#FEE500';
const KAKAO_INK = '#2F1B0C';

/** 모바일 축소 임계(px). 히어로를 벗어나면 접는다 — 임계 1개·리스너 1개. */
const COLLAPSE_AT = 160;

export default function TalkFab() {
  const pathname = usePathname() ?? '';
  const hidden = isAptSiteDetailPath(pathname);

  // 훅은 조기 반환보다 위에서 무조건 호출한다 (훅 순서 규칙).
  const viewRef = useTalkView<HTMLAnchorElement>('fab');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (hidden) return;
    // 리스너 «하나». rAF 로 접어 스크롤당 상태 계산을 1프레임 1회로 묶는다.
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        setCollapsed(window.scrollY > COLLAPSE_AT);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hidden]);

  if (hidden) return null;

  return (
    <a
      ref={viewRef}
      href={KAKAO_TALK_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="부정공 단톡방 입장"
      onClick={() => trackTalkClick('fab')}
      className="kd-talk-fab"
      data-collapsed={collapsed ? 'true' : 'false'}
      style={{ background: KAKAO_YELLOW, color: KAKAO_INK }}
    >
      <MessageCircle size={20} strokeWidth={2.2} aria-hidden="true" />
      <span className="kd-talk-fab__label">부정공 단톡방</span>
    </a>
  );
}
