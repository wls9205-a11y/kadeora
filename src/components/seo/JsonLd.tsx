/**
 * 세션 146 — JSON-LD SSR 래퍼. next/script 금지 (Yeti 크롤 시 client-only 스크립트 못 읽음).
 * 서버 컴포넌트에서 <script type="application/ld+json"> 직접 삽입.
 *
 * ⛔ AD-3(2026-09-07) — 여기가 «ld+json 을 내보내는 유일한 자리» 다.
 *    이 파일이 만들어져 있는데도 채택이 0이었고, 72개 파일이 각자 원시
 *    JSON.stringify 를 script 태그에 꽂고 있었다(script 태그 170개). 그 중에는
 *    크롤로 들어온 텍스트를 그대로 싣는 자리들이 있어서, 값에 "</script>" 가
 *    섞이면 태그가 거기서 닫히고 뒤가 마크업으로 해석된다 — HTML 파손이자
 *    스크립트 탈출 벡터다. 그래서 전량을 이 컴포넌트로 모았다.
 *    새 구조화 데이터는 여기를 거친다. script 태그를 다시 손으로 쓰지 말 것.
 *
 * ⚠️ 이스케이프는 lib/jsonld.ts 의 jsonLdSafe 를 «빌려 쓴다». 원래 이 파일은
 *    '<' 만 막고 jsonLdSafe 는 > & ' U+2028 U+2029 까지 막고 있었는데, 그 헬퍼를
 *    쓰던 2개 파일을 이리로 옮기면 보호가 오히려 얇아진다. 넓은 쪽으로 합쳤다.
 *    (전부 유효한 JSON 이스케이프라 JSON.parse 결과는 그대로다)
 */
import React from 'react';
import { jsonLdSafe } from '@/lib/jsonld';

export interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export default function JsonLd({ data }: JsonLdProps) {
  const payload = Array.isArray(data) ? data : [data];
  return (
    <>
      {payload.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdSafe(item) }}
        />
      ))}
    </>
  );
}
