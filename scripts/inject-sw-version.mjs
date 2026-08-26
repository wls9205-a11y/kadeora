#!/usr/bin/env node
/**
 * public/sw.template.js → public/sw.js 를 «생성» 한다.
 *
 * ── 왜 제자리 수정이 아니라 생성인가 ────────────────────────────────────
 * 예전에는 추적 중인 public/sw.js 를 빌드가 «제자리에서» 고쳤다. 그래서
 *   ① 빌드할 때마다 CACHE_VERSION 한 줄이 바뀌어 push 마다 충돌이 났고
 *   ② 그렇다고 sw.js 를 .gitignore 로 빼면 배포 체크아웃에 파일이 없어
 *      아래 존재 검사에서 조용히 skip 되고 **서비스워커 없이 배포** 됐다.
 * ②가 훨씬 위험하다 — 빌드도 테스트도 통과하고, 며칠 뒤 「푸시가 안 와요」로 나타난다.
 * (SW 가 없으면 PageViewTracker 의 register 가 죽고, 거기에 매달린 웹푸시 구독 4곳이
 *  전부 무력화된다. 이미 설치된 PWA 는 업데이트 확인이 404 를 받아 등록이 해제된다.)
 *
 * 그래서 «원본은 템플릿, 배포물은 생성» 으로 가른다.
 *   추적함  public/sw.template.js   ← 여기를 고친다
 *   무시함  public/sw.js            ← 빌드 산출물
 *
 * ── ⛔ 실패하면 «죽는다» ────────────────────────────────────────────────
 * 템플릿이 없거나 자리표시가 안 잡히면 exit 1 이다. 경고만 찍고 넘어가면
 * 잘못된 결과가 그대로 배포된다 — 그게 이 파일이 고치려는 사고의 본체다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TEMPLATE_PATH = join(process.cwd(), 'public', 'sw.template.js');
const OUT_PATH = join(process.cwd(), 'public', 'sw.js');
const PLACEHOLDER = '__CACHE_VERSION__';
/**
 * 자리표시가 «CACHE_VERSION 줄에» 있는지 본다.
 * ⚠️ 파일 어딘가에 문자열이 있는지만 보면 안 된다 — 이 템플릿은 머리말 주석에서도
 *    __CACHE_VERSION__ 을 언급한다. 검증에서 실제로 걸렸다: 리터럴을 '999' 로 바꿔도
 *    주석 덕에 통과해 버렸다. 잡아야 할 것은 «치환 대상이 남아 있는가» 다.
 */
const VERSION_LINE = /const\s+CACHE_VERSION\s*=\s*['"]__CACHE_VERSION__['"]\s*;/;

function fail(msg) {
  console.error(`[inject-sw-version] ${msg}`);
  console.error('[inject-sw-version] 서비스워커 없이 배포되는 것을 막기 위해 빌드를 중단한다.');
  process.exit(1);
}

function pickVersion() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 8);
  const explicit = process.env.NEXT_PUBLIC_CACHE_VERSION;
  if (explicit) return explicit;
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function main() {
  if (!existsSync(TEMPLATE_PATH)) {
    fail('public/sw.template.js 가 없다. 이 파일이 서비스워커의 원본이다.');
  }
  const template = readFileSync(TEMPLATE_PATH, 'utf8');
  if (!VERSION_LINE.test(template)) {
    fail(`템플릿의 CACHE_VERSION 줄이 ${PLACEHOLDER} 가 아니다. 자리표시를 되돌릴 것.`);
  }
  const version = pickVersion();
  // 리터럴 한 줄만 치환한다. 주석에 있는 언급은 그대로 둔다(설명이라 남아야 한다).
  const out = template.replace(VERSION_LINE, `const CACHE_VERSION = '${version}';`);
  writeFileSync(OUT_PATH, out, 'utf8');
  console.log(`[inject-sw-version] public/sw.js 생성 · CACHE_VERSION = ${version}`);
}

main();
