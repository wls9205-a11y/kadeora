'use client';
import Script from 'next/script';

export default function KakaoInit() {
  return (
    <Script
      src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        try {
          const kakao = (window as any).Kakao;
          console.log('[KakaoInit] SDK loaded, Kakao:', !!kakao);
          if (kakao && !kakao.isInitialized()) {
            const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
            console.log('[KakaoInit] init key present:', !!key, 'key length:', key?.length);
            if (key) {
              kakao.init(key);
              console.log('[KakaoInit] initialized:', kakao.isInitialized(), 'Share:', !!kakao.Share);
            }
          } else if (kakao) {
            console.log('[KakaoInit] already initialized, Share:', !!kakao.Share);
          }
        } catch (e) {
          console.warn('[KakaoInit] SDK init failed:', e);
        }
      }}
      onError={(e) => {
        console.warn('[KakaoInit] SDK script load FAILED:', e);
      }}
    />
  );
}
