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

/** 제공자별 OAuth 가능 여부. 인앱마다 «막는 제공자» 가 다르다. */
export interface OAuthAvailability {
  kakao: boolean;
  google: boolean;
}

export interface InAppBrowserState {
  isInApp: boolean;
  type: InAppBrowserType;
  /**
   * 하위호환 — 「둘 중 하나라도 가능한가」. 기존 호출부(전면 차단 모달 분기)가 쓴다.
   * ⛔ 제공자별 버튼 렌더 판정에 쓰지 말 것. 그 판정은 canDoOAuthBy 다.
   */
  canDoOAuth: boolean;
  /**
   * SU A-1 (2026-09-05): 구글은 카카오톡·네이버 인앱 웹뷰에서 OAuth 를 «거부» 한다
   * (disallowed_useragent). 9/3 실드롭 2건 — UA 카카오톡 인앱(Android `; wv)`) →
   * 구글 /authorize 302 후 복귀 0. 21일 구글 성공 0/3.
   * 반면 카카오 로그인은 카카오톡 인앱에서 50% 성공(s235 실측) 이므로 막지 않는다.
   */
  canDoOAuthBy: OAuthAvailability;
  /** SSR/판정 전 boolean — true 면 결정 완료 (브라우저 검사 끝). */
  resolved: boolean;
}

type Detection = Omit<InAppBrowserState, 'resolved' | 'canDoOAuth'>;

const BOTH: OAuthAvailability = { kakao: true, google: true };
const NEITHER: OAuthAvailability = { kakao: false, google: false };
/** 카카오톡·네이버 인앱: 카카오는 되고 구글은 막힌다. */
const KAKAO_ONLY: OAuthAvailability = { kakao: true, google: false };

const INITIAL: InAppBrowserState = {
  isInApp: false, type: null, canDoOAuth: true, canDoOAuthBy: BOTH, resolved: false,
};

function detect(ua: string): Detection {
  // 다음(Daum) 인앱 — 14일 데이터 0/5 성공 → 차단
  if (/DaumApps/i.test(ua)) return { isInApp: true, type: 'daum', canDoOAuthBy: NEITHER };
  // 당근(Karrot) — 1/6 성공 → 차단
  if (/KARROT/i.test(ua)) return { isInApp: true, type: 'karrot', canDoOAuthBy: NEITHER };
  // 네이버 인앱 — 카카오 45.8% 성공 → 통과 / 구글은 웹뷰 차단
  if (/NAVER\(inapp/i.test(ua)) return { isInApp: true, type: 'naver', canDoOAuthBy: KAKAO_ONLY };
  // 카카오톡 인앱 — 카카오 50% 성공 → 통과 / 구글은 웹뷰 차단
  if (/KAKAOTALK/i.test(ua)) return { isInApp: true, type: 'kakao', canDoOAuthBy: KAKAO_ONLY };
  // 페이스북/인스타/라인 인앱 — 일반적으로 OAuth 차단
  if (/FB_IAB|FBAN|Instagram|Line\//i.test(ua)) return { isInApp: true, type: 'social', canDoOAuthBy: NEITHER };
  // Android WebView — 일반 webview 도 OAuth 막힘
  if (/;\s?wv\)/i.test(ua)) return { isInApp: true, type: 'webview', canDoOAuthBy: NEITHER };
  return { isInApp: false, type: null, canDoOAuthBy: BOTH };
}

function withLegacy(d: Detection): Omit<InAppBrowserState, 'resolved'> {
  return { ...d, canDoOAuth: d.canDoOAuthBy.kakao || d.canDoOAuthBy.google };
}

export function useInAppBrowser(): InAppBrowserState {
  const [state, setState] = useState<InAppBrowserState>(INITIAL);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setState({ ...withLegacy(detect(navigator.userAgent || '')), resolved: true });
  }, []);
  return state;
}

export function detectInAppBrowserSync(ua: string): Omit<InAppBrowserState, 'resolved'> {
  return withLegacy(detect(ua));
}
