#!/usr/bin/env node
/**
 * 세션 147 D1 — Kakao Local API 진단.
 * 403 원인 파악 위해 응답 바디 전문 출력.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
if (!KAKAO_KEY) { console.error('❌ KAKAO_REST_API_KEY missing'); process.exit(1); }

const queries = [
  '경기도 용인시 처인구 고림동 620',
  '서울 강남구 테헤란로 152',
  '제주 제주시 조천읍 북촌리 1938',
];

async function probe(query, endpoint) {
  const url = `https://dapi.kakao.com/v2/local/${endpoint}?query=${encodeURIComponent(query)}&size=1`;
  console.log(`\n━━ ${endpoint} | ${query}`);
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  console.log(`HTTP: ${res.status}`);
  console.log('Response body:');
  const text = await res.text();
  console.log(text.slice(0, 1500));
}

async function main() {
  console.log(`KAKAO_REST_API_KEY length=${KAKAO_KEY.length}, prefix=${KAKAO_KEY.slice(0, 8)}...`);
  for (const q of queries) {
    await probe(q, 'search/address.json');
    await probe(q, 'search/keyword.json');
  }
}

main().catch(e => { console.error('fatal:', e); process.exit(1); });
