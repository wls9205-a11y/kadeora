#!/usr/bin/env node
/**
 * 마스터 §3 — Pretendard 자체 호스팅용 내려받기.
 *
 * 왜: `layout.tsx` 가 jsdelivr 의 스타일시트를 `<link rel="stylesheet">` 로 물고 있었다.
 * **크로스 도메인 렌더링 차단**이라 DNS+TLS+다운로드가 끝날 때까지 화면에 아무것도 안 그려진다.
 * 실측 FCP 3.5초 · LCP 4.8초가 이걸로 설명된다.
 *
 * ⚠️ `next/font/local` 을 쓸 수 없다. Pretendard 다이내믹 서브셋은 `unicode-range` 로 갈린
 *    @font-face 가 92개인데, `next/font/local` 은 src 별 unicode-range 를 받지 않는다.
 *    서브셋을 버리고 단일 variable(1.2MB)로 가면 자체 호스팅해도 첫 화면이 더 느려진다.
 *
 * 그래서 파일을 그대로 가져와 `public/fonts/pretendard/` 에 두고,
 * @font-face 는 번들 CSS 에 넣는다 — **스타일시트 요청 자체가 사라진다.**
 * 브라우저는 실제로 쓰는 유니코드 구간의 woff2 만 받는다.
 *
 * 사용: node scripts/fetch-pretendard.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const VERSION = 'v1.3.9';
const CSS_URL = `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@${VERSION}/dist/web/variable/pretendardvariable-dynamic-subset.min.css`;
const OUT_DIR = path.join('public', 'fonts', 'pretendard');
const CSS_OUT = path.join('src', 'app', 'styles', 'pretendard.css');
/** 브라우저가 참조할 경로. public/ 기준 절대 경로다. */
const PUBLIC_BASE = '/fonts/pretendard';

const UA = 'Mozilla/5.0 (compatible; kadeora-bot)';

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const css = await (await get(CSS_URL)).text();
const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/['"]/g, ''));
const unique = [...new Set(urls)];
console.log(`[pretendard] @font-face ${(css.match(/@font-face/g) || []).length}개 · 파일 ${unique.length}개`);

let bytes = 0;
const nameOf = (u) => path.basename(u.split('?')[0]);

for (const rel of unique) {
  const abs = new URL(rel, CSS_URL).toString();
  const name = nameOf(rel);
  const dest = path.join(OUT_DIR, name);
  if (fs.existsSync(dest)) {
    bytes += fs.statSync(dest).size;
    continue;
  }
  const buf = Buffer.from(await (await get(abs)).arrayBuffer());
  fs.writeFileSync(dest, buf);
  bytes += buf.length;
}
console.log(`[pretendard] 내려받기 완료 — ${(bytes / 1024 / 1024).toFixed(2)}MB`);

// url() 을 자체 호스팅 경로로 바꾼다.
let out = css.replace(/url\(([^)]+)\)/g, (_, u) => `url(${PUBLIC_BASE}/${nameOf(u.replace(/['"]/g, ''))})`);

const header = [
  '/* 자동 생성 — 직접 수정하지 말 것.',
  ` *   생성: node scripts/fetch-pretendard.mjs  (Pretendard ${VERSION})`,
  ' *',
  ' * 마스터 §3 — 이 규칙들이 예전에는 jsdelivr 스타일시트였다.',
  ' * 크로스 도메인 <link rel="stylesheet"> 라 렌더링을 막았다 (실측 FCP 3.5초).',
  ' * 번들 CSS 안으로 들어오면서 **스타일시트 요청이 사라졌고**,',
  ' * 브라우저는 실제로 쓰는 유니코드 구간의 woff2 만 받는다.',
  ' *',
  ' * ⚠️ font-display:swap 은 원본 그대로 유지한다. 폰트가 늦어도 글자는 먼저 보여야 한다.',
  ' */',
  '',
].join('\n');

fs.mkdirSync(path.dirname(CSS_OUT), { recursive: true });
fs.writeFileSync(CSS_OUT, (header + out).replace(/\r?\n/g, '\r\n'));
console.log(`[pretendard] wrote ${CSS_OUT}`);
