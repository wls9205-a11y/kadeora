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
  canDoOAuth: boolean;
  resolved: boolean;
}

const INITIAL: InAppBrowserState = { isInApp: false, type: null, canDoOAuth: true, resolved: false };

function detect(ua: string): Omit<InAppBrowserState, 'resolved'> {
  if (/DaumApps/i.test(ua)) return { isInApp: true, type: 'daum', canDoOAuth: false };
  if (/KARROT/i.test(ua)) return { isInApp: true, type: 'karrot', canDoOAuth: false };
  if (/NAVER\(inapp/i.test(ua)) return { isInApp: true, type: 'naver', canDoOAuth: true };
  if (/KAKAOTALK/i.test(ua)) return { isInApp: true, type: 'kakao', canDoOAuth: true };
  if (/FB_IAB|FBAN|Instagram|Line\//i.test(ua)) return { isInApp: true, type: 'social', canDoOAuth: false };
  // s268: Android WebView 패턴 다양화 — SM-S916N 2026-05-12 케이스 fix
  if (/;\s?wv[);]/i.test(ua)) return { isInApp: true, type: 'webview', canDoOAuth: false };
  if (/\bwv\b/i.test(ua) && /Android/i.test(ua) && !/Chrome\/\d+\.\d+\.\d+\.\d+ Mobile Safari/i.test(ua)) {
    return { isInApp: true, type: 'webview', canDoOAuth: false };
  }
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
