'use client';
import { useEffect } from 'react';
import { isTossMode, initTossNavigation } from '@/lib/toss-mode';

/**
 * 토스 앱인토스 미니앱 초기화 (v2)
 * 
 * 1. html에 data-theme="light" + class="toss-mode" 추가
 * 2. CSS로 자체 헤더/하단탭/설치배너/CTA/백버튼 숨김
 * 3. body padding 제거 (토스 네이티브 내비바 영역)
 * 4. 뒤로가기 히스토리 관리 — 최초화면에서 앱 종료
 */
export default function TossModeInit() {
  useEffect(() => {
    if (!isTossMode()) return;

    const html = document.documentElement;
    html.setAttribute('data-theme', 'light');
    html.classList.add('toss-mode');

    // 뒤로가기 히스토리 관리 초기화
    initTossNavigation();

    const style = document.createElement('style');
    style.id = 'toss-mode-styles';
    style.textContent = `
      .toss-mode {
        --bg-base: #FFFFFF !important;
        --bg-surface: #F5F6F8 !important;
        --bg-hover: #EEEFF1 !important;
        --text-primary: #191F28 !important;
        --text-secondary: #4E5968 !important;
        --text-tertiary: #8B95A1 !important;
        --border: #E5E8EB !important;
        --nav-bg: #FFFFFF !important;
        color-scheme: light !important;
      }
      .toss-mode body {
        background: #FFFFFF !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
      }
      /* 반려 사유 #2: 자체 뒤로가기/네비게이션 완전 숨김 — 토스 네이티브만 사용 */
      .toss-mode nav,
      .toss-mode [data-nav="bottom"],
      .toss-mode [data-role="back-button"],
      .toss-mode .kd-back-button {
        display: none !important;
      }
      /* 토스 모드에서 상단 여백 제거 */
      .toss-mode main {
        padding-top: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return null;
}
