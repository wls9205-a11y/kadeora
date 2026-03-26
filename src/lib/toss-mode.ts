'use client';

/**
 * 토스 앱인토스 미니앱 모드 감지
 * 
 * URL에 ?toss=1 파라미터가 있으면 토스 미니앱 모드로 동작:
 * - 자체 헤더/하단 탭바 숨김 (토스 네이티브 내비바 대체)
 * - 설치 배너/CTA/가입 유도 숨김
 * - 라이트 모드 강제
 * - PWA 관련 기능 비활성화
 * 
 * 한번 감지되면 sessionStorage에 저장 (페이지 이동 시에도 유지)
 */

const TOSS_MODE_KEY = 'kd_toss_mode';

export function isTossMode(): boolean {
  if (typeof window === 'undefined') return false;
  
  // URL 파라미터 체크
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('toss') === '1') {
      sessionStorage.setItem(TOSS_MODE_KEY, '1');
      return true;
    }
  } catch {}
  
  // sessionStorage 체크 (페이지 이동 후에도 유지)
  try {
    return sessionStorage.getItem(TOSS_MODE_KEY) === '1';
  } catch {}
  
  return false;
}

export function setTossMode(): void {
  try {
    sessionStorage.setItem(TOSS_MODE_KEY, '1');
  } catch {}
}
