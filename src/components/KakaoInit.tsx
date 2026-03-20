'use client';
import Script from 'next/script';

export default function KakaoInit() {
  return (
    <Script
      src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        const kakao = (window as any).Kakao;
        if (kakao && !kakao.isInitialized()) {
          const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
          if (key) kakao.init(key);
        }
      }}
    />
  );
}
