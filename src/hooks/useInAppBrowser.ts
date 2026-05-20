'use client';
import { useEffect, useState } from 'react';

export type InAppBrowserType =
  | 'daum'
  | 'karrot'
  | 'naver'
  | 'kakao'
  | 'social'
  | 'webview'
  | null;

export interface InAppBrowserState {
  isInApp: boolean;
  type: InAppBrowserType;
  /** OAuth 가능 여부. false 면 카카오/구글 OAuth 동의화면이 막혀서 가입 실패. */
  canDoOAuth: boolean;
  /** SSR/판정 전 boolean — true 면 결정 완료 (브라우저 검사 끝). */
  resolved: boolean;
}

const INITIAL: InAppBrowserState = { isInApp: false, type: null, canDoOAuth: true, resolved: false };

function detect(ua: string): Omit<InAppBrowserState, 'resolved'> {
  // 다음(Daum) 인앱 — 14일 데이터 0/5 성공 → 차단
  if (/DaumApps/i.test(ua)) return { isInApp: true, type: 'daum', canDoOAuth: false };
  // 당근(Karrot) — 1/6 성공 → 차단
  if (/KARROT/i.test(ua)) return { isInApp: true, type: 'karrot', canDoOAuth: false };
  // 네이버 인앱 — 45.8% 성공 → 통과
  if (/NAVER\(inapp/i.test(ua)) return { isInApp: true, type: 'naver', canDoOAuth: true };
  // 카카오톡 인앱 — 50% 성공 → 통과
  if (/KAKAOTALK/i.test(ua)) return { isInApp: true, type: 'kakao', canDoOAuth: true };
  // 페이스북/인스타/라인 인앱 — 일반적으로 OAuth 차단
  if (/FB_IAB|FBAN|Instagram|Line\//i.test(ua)) return { isInApp: true, type: 'social', canDoOAuth: false };
  // Android WebView — 일반 webview 도 OAuth 막힘
  if (/;\s?wv\)/i.test(ua)) return { isInApp: true, type: 'webview', canDoOAuth: false };
  return { isInApp: false, type: null, canDoOAuth: true };
}

export function useInAppBrowser(): InAppBrowserState {
  const [state, setState] = useState<InAppBrowserState>(INITIAL);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const d = detect(navigator.userAgent || '');
    setState({ ...d, resolved: true });
  }, []);
  return state;
}

export function detectInAppBrowserSync(ua: string): Omit<InAppBrowserState, 'resolved'> {
  return detect(ua);
}
