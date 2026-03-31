'use client';

/**
 * 토스 앱인토스 미니앱 모드 (v2 — 반려 사유 수정)
 * 
 * 반려 사유 3건 수정:
 * 1. 공유 링크 → intoss/toss 스킴 사용
 * 2. 뒤로가기 중복 → 자체 백버튼 제거, 히스토리 백 + 최초화면 앱 종료
 * 3. Android/iOS 동일 적용
 * 
 * 토스 미니앱 SDK 2.1.0 기반
 * https://toss.im/docs/miniapp
 */

const TOSS_MODE_KEY = 'kd_toss_mode';

// ── 모드 감지 ──

export function isTossMode(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('toss') === '1') {
      sessionStorage.setItem(TOSS_MODE_KEY, '1');
      return true;
    }
  } catch {}
  
  try {
    return sessionStorage.getItem(TOSS_MODE_KEY) === '1';
  } catch {}
  
  return false;
}

export function setTossMode(): void {
  try { sessionStorage.setItem(TOSS_MODE_KEY, '1'); } catch {}
}

// ── 공유 (반려 사유 #1 수정) ──
// 토스 미니앱에서는 intoss:// 스킴 또는 토스 SDK share 사용

export async function tossShare(title: string, path: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  try {
    // 1순위: 토스 SDK bridge
    const w = window as any;
    if (w.TossApp?.share) {
      await w.TossApp.share({ title, url: `https://kadeora.app${path}` });
      return true;
    }
    
    // 2순위: intoss:// 스킴 (private 형식)
    // 토스 앱 내부 공유: intoss://miniapp/카더라?path={path}
    const intossUrl = `intoss://miniapp/kadeora?path=${encodeURIComponent(path)}&title=${encodeURIComponent(title)}`;
    window.location.href = intossUrl;
    return true;
  } catch {
    // 3순위: 일반 Web Share API (fallback)
    try {
      if (navigator.share) {
        await navigator.share({ title, url: `https://kadeora.app${path}` });
        return true;
      }
    } catch {}
  }
  
  return false;
}

// ── 뒤로가기 (반려 사유 #2, #3 수정) ──
// 토스 네비바의 뒤로가기만 사용, 자체 백버튼 제거
// 최초 화면에서 뒤로가기 → 앱 종료

let _historyLength = 0;

export function initTossNavigation(): void {
  if (typeof window === 'undefined' || !isTossMode()) return;
  
  // 진입 시점의 history length 저장
  _historyLength = window.history.length;
  
  // popstate 이벤트로 뒤로가기 감지
  window.addEventListener('popstate', () => {
    // 최초 화면이면 앱 종료
    if (window.history.length <= _historyLength) {
      closeTossApp();
    }
  });
}

export function closeTossApp(): void {
  try {
    const w = window as any;
    // 토스 SDK bridge
    if (w.TossApp?.close) {
      w.TossApp.close();
      return;
    }
    // 토스 미니앱 종료 스킴
    window.location.href = 'intoss://close';
  } catch {}
}

// ── 토스 모드에서 뒤로가기 ──
export function tossGoBack(): void {
  if (window.history.length <= _historyLength) {
    closeTossApp();
  } else {
    window.history.back();
  }
}
