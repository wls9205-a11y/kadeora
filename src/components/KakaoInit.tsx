'use client';
import { useEffect } from 'react';
export default function KakaoInit() {
  useEffect(() => {
    const kakao = (window as any).Kakao;
    if (kakao && !kakao.isInitialized()) {
      const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (key) kakao.init(key);
    }
  }, []);
  return null;
}
