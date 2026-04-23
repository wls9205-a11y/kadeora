/**
 * 세션 146 — JSON-LD SSR 래퍼. next/script 금지 (Yeti 크롤 시 client-only 스크립트 못 읽음).
 * 서버 컴포넌트에서 <script type="application/ld+json"> 직접 삽입.
 */
import React from 'react';

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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item).replace(/</g, '\\u003c') }}
        />
      ))}
    </>
  );
}
