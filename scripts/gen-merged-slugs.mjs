#!/usr/bin/env node
/**
 * V15 A-1 — 병합된 구 slug → 생존 slug 정적 맵 생성기.
 *
 * 왜 정적 맵인가: 리다이렉트는 middleware(Edge)가 처리한다. 요청마다 DB 를 때릴 수 없고,
 * 대상이 256건뿐이라 번들에 실어도 부담이 없다.
 *
 * 원본은 apt_site_merges. 중복 행은 DELETE 하지 않고 is_active=false 로 남아 있으므로
 * 이 표가 유일한 근거다 (V15 리스크 #11 — 절대 삭제하지 말 것).
 *
 * 안전장치:
 *   - 생존 slug 가 apt_sites 에 없거나 비활성이면 그 쌍을 버린다. 301 로 404 를 만들지 않는다.
 *   - dead == survivor 자기참조는 버린다 (리다이렉트 루프).
 *   - 생존자가 다시 다른 병합의 dead 면 체인을 끝까지 접는다. 301 체인은 크롤 예산을 먹는다.
 *
 * 사용:
 *   node scripts/gen-merged-slugs.mjs                 # DB 에서 읽어 갱신
 *   node scripts/gen-merged-slugs.mjs --dry           # 통계만
 *   node scripts/gen-merged-slugs.mjs --tsv pairs.tsv # `dead|survivor` 줄 목록에서 생성
 *
 * --tsv 는 서비스 키가 없는 환경(로컬 .env.local 은 placeholder)에서 쓰는 우회로다.
 * 생존자 실존 검사를 할 수 없으므로 입력을 만든 쪽이 검증 책임을 진다 — DB 에서
 *   select md5(string_agg(dead_slug||'|'||survivor_slug, chr(10) order by dead_slug))
 *     from apt_site_merges;
 * 로 대조할 것.
 *
 * 필요 env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (없으면 .env.local 을 읽는다)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const TSV = argv.includes('--tsv') ? argv[argv.indexOf('--tsv') + 1] : null;
const OUT = path.join('src', 'lib', 'apt', 'merged-slugs.ts');

const CRLF = String.fromCharCode(13) + String.fromCharCode(10);

function emit(merges, survivors, checkDeadActive) {
  const direct = new Map();
  for (const m of merges) {
    if (!m.dead_slug || !m.survivor_slug) continue;
    if (m.dead_slug === m.survivor_slug) continue;
    direct.set(m.dead_slug, m.survivor_slug);
  }

  /** 체인을 끝까지 접는다. 순환이면 그 쌍을 버린다. */
  const resolve = (dead) => {
    const seen = new Set([dead]);
    let cur = direct.get(dead);
    while (cur && direct.has(cur)) {
      if (seen.has(cur)) return null;
      seen.add(cur);
      cur = direct.get(cur);
    }
    return cur ?? null;
  };

  const pairs = [];
  const dropped = [];
  for (const dead of [...direct.keys()].sort()) {
    const survivor = resolve(dead);
    if (!survivor) { dropped.push([dead, '순환']); continue; }
    if (!survivors.has(survivor)) { dropped.push([dead, `생존자 없음: ${survivor}`]); continue; }
    if (checkDeadActive && survivors.has(dead)) { dropped.push([dead, '구 slug 가 아직 활성']); continue; }
    pairs.push([dead, survivor]);
  }

  console.log(`[gen-merged-slugs] 원본 ${merges.length} · 채택 ${pairs.length} · 제외 ${dropped.length}`);
  for (const [d, why] of dropped.slice(0, 20)) console.log(`  - 제외 ${d} (${why})`);
  if (DRY) return;

  const body = pairs.map(([d, s]) => `  ${JSON.stringify(d)}: ${JSON.stringify(s)},`).join('\n');
  const ts = [
    '// 자동 생성 — 직접 수정하지 말 것.',
    '//   생성: node scripts/gen-merged-slugs.mjs',
    '//   원본: public.apt_site_merges (V15 A-1 · 중복 256쌍 병합)',
    '//',
    '// 영문 접두어 slug 규칙이 두 갈래로 돌아 같은 현장에 slug 가 둘씩 생겼다',
    '// (`DMC센트럴자이` → `dmc센트럴자이` / `센트럴자이`). 병합 후 구 slug 가 404 가 되는데',
    '// 색인과 블로그 내부 링크가 거기 걸려 있어 middleware 가 301 로 넘긴다.',
    '//',
    '// ⚠️ 생존자 선정에 slug 품질 기준이 빠져 23쌍이 거꾸로 잡혀 있었다',
    '//    (`dmc-sk-view-아이파크포레` → `---아이파크포레`). DB 담당이 방향을 뒤집었고,',
    '//    이 파일은 그 수정본 기준이다. 깨진 생존자 0건을 확인하고 생성했다.',
    '',
    'export const MERGED_SLUGS: Record<string, string> = {',
    body,
    '};',
    '',
    '/** 병합된 구 slug 면 생존 slug 를, 아니면 null. */',
    'export function survivorSlug(slug: string): string | null {',
    '  return Object.prototype.hasOwnProperty.call(MERGED_SLUGS, slug) ? MERGED_SLUGS[slug] : null;',
    '}',
    '',
  ].join('\n');

  fs.writeFileSync(OUT, ts.replace(/\r?\n/g, CRLF));
  console.log(`[gen-merged-slugs] wrote ${OUT} (${pairs.length}건)`);
}

if (TSV) {
  const merges = fs
    .readFileSync(TSV, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('|');
      if (i < 0) throw new Error(`--tsv 형식 오류: ${line}`);
      return { dead_slug: line.slice(0, i), survivor_slug: line.slice(i + 1) };
    });
  // 실존 검사 대신 자기 집합으로 체인·자기참조만 잡는다.
  const survivors = new Set(merges.map((m) => m.survivor_slug));
  console.log(`[gen-merged-slugs] --tsv ${TSV} ${merges.length}쌍 (생존자 실존 검사 생략)`);
  emit(merges, survivors, false);
} else {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && fs.existsSync('.env.local')) {
    for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // 서비스 키가 없으면 anon 으로 떨어진다.
  //   apt_site_merges·apt_sites 는 읽기가 열려 있어 이 스크립트에 필요한 두 조회가 다 된다.
  //   로컬 .env.local 의 SERVICE_ROLE 은 placeholder 라 이 폴백이 없으면
  //   맵을 손으로 옮겨 적게 된다 — 416쌍을 전사하다 한 글자 틀리면 301 이 404 가 된다.
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = svc && !svc.startsWith('local-') ? svc : anon;
  if (!url || !key) {
    console.error('[gen-merged-slugs] NEXT_PUBLIC_SUPABASE_URL 과 SERVICE_ROLE 또는 ANON 키가 필요합니다');
    process.exit(1);
  }
  console.log(`[gen-merged-slugs] key=${key === svc ? 'service_role' : 'anon'}`);
  const sb = createClient(url, key, { auth: { persistSession: false } });

  /** PostgREST 기본 db-max-rows=1000 — 지금은 256건이지만 배치로 긁는다. */
  const page = async (table, cols, order, extra) => {
    const out = [];
    const size = 1000;
    for (let off = 0; ; off += size) {
      let q = sb.from(table).select(cols).order(order, { ascending: true }).range(off, off + size - 1);
      if (extra) q = extra(q);
      const { data, error } = await q;
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...(data ?? []));
      if (!data || data.length < size) break;
    }
    return out;
  };

  const merges = await page('apt_site_merges', 'dead_slug, survivor_slug', 'dead_slug');
  const rows = await page('apt_sites', 'slug', 'slug', (q) => q.eq('is_active', true).not('slug', 'is', null));
  const survivors = new Set(rows.map((r) => r.slug));
  emit(merges, survivors, true);
}
