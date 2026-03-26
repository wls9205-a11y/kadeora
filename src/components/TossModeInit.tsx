'use client';
import { useEffect } from 'react';
import { isTossMode } from '@/lib/toss-mode';

/**
 * 토스 앱인토스 미니앱 모드 초기화
 * 
 * root layout에서 렌더링 — 토스 모드 감지 시:
 * 1. html에 data-theme="light" + class="toss-mode" 추가
 * 2. CSS로 자체 헤더, 하단탭, 설치배너, CTA 등 숨김
 * 3. body padding 조정 (토스 네이티브 내비바 영역)
 */
export default function TossModeInit() {
  useEffect(() => {
    if (!isTossMode()) return;

    const html = document.documentElement;
    html.setAttribute('data-theme', 'light');
    html.classList.add('toss-mode');

    // 토스 모드 스타일 주입
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
    `;
    document.head.appendChild(style);
  }, []);

  return null;
}
