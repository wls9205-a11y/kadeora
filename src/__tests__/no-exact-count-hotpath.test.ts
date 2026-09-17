/**
 * B1 (2026-09-17) — 핫패스 count:'exact' 재유입 차단.
 *
 * 2026-09-16 장애의 발화원은 /api/stats/social-proof 의 exact count 7발이었다(커밋 febc1901).
 * PostgREST count:'exact' 는 대형 표에서 seq scan + 병렬 워커 → 워커 슬롯 기아 → pg_cron fork 실패 → 504.
 * 전수 감사: docs/audit/count_exact_2026-09-17.md
 *
 * 이 파일이 지키는 것:
 *  ① 대형 표(10만+ 행)를 핫패스(공개 SSR·공개 API·공유 lib)에서 exact 로 세지 않는다.
 *     필터+인덱스로 결과가 작은 것이 EXPLAIN 으로 확인된 자리만 같은 줄 또는 바로 위 3줄에
 *     `exact-ok:` 표지를 달아 허용한다.
 *  ② 핫패스 파일의 exact 개수는 허용목록 이하 — 새 자리·증가는 감사 문서를 갱신하고 여기를 올린다.
 *     (콜드 = api/admin · admin · api/cron · _legacy 는 검사 밖.)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');

/** pg_class.reltuples ≥ 10만 (2026-09-17 실측). 표가 커지면 여기에 추가한다. */
const BIG_TABLES = ['apt_transactions', 'apt_rent_transactions', 'stock_price_history', 'user_events'];

const COLD_PREFIXES = ['src/app/api/admin/', 'src/app/admin/', 'src/app/api/cron/', 'src/_legacy/', 'src/__tests__/'];

/** 핫패스 파일별 exact 허용 개수 — 전부 소형 표(<10만) 또는 인덱스 확인(apt-fetcher 294). */
const HOT_ALLOW: Record<string, number> = {
  'src/app/(main)/apt/data/page.tsx': 2,
  'src/app/(main)/blog/[slug]/page.tsx': 2,
  'src/app/(main)/discuss/DiscussClient.tsx': 1,
  'src/app/(main)/feed/FeedClient.tsx': 1,
  'src/app/(main)/feed/[id]/page.tsx': 1,
  'src/app/(main)/page.tsx': 1,
  'src/app/(main)/profile/[id]/ProfileGradeCard.tsx': 1,
  'src/app/(main)/profile/[id]/page.tsx': 3,
  'src/app/(main)/stock/[symbol]/page.tsx': 1,
  'src/app/(main)/stock/data/page.tsx': 1,
  'src/app/(main)/stock/market/[code]/page.tsx': 1,
  'src/app/api/apt/reviews/[id]/report/route.ts': 1,
  'src/app/api/apt/reviews/route.ts': 1,
  'src/app/api/blog/search/route.ts': 1,
  'src/app/api/comments/[id]/route.ts': 1,
  'src/app/api/comments/route.ts': 1,
  'src/app/api/discuss/route.ts': 1,
  'src/app/api/follow/route.ts': 2,
  'src/app/api/likes/route.ts': 2,
  'src/app/api/notifications/route.ts': 4,
  'src/app/api/polls/route.ts': 1,
  'src/app/api/portfolio/route.ts': 1,
  'src/app/api/posts/route.ts': 1,
  'src/app/api/report/route.ts': 2,
  'src/app/api/share/route.ts': 2,
  'src/app/api/stock/ai-analysis/route.ts': 1,
  'src/app/image-sitemap.xml/route.ts': 1,
  'src/app/llms.txt/route.ts': 1,
  'src/app/sitemap.xml/route.ts': 2,
  'src/components/Navigation.tsx': 2,
  'src/components/apt/SiteFloatingActions.tsx': 1,
  'src/lib/apt-fetcher.ts': 4,
  'src/lib/big-event-fact-verify.ts': 1,
  'src/lib/blog-safe-insert.ts': 1,
  'src/lib/content/issue-context.ts': 1,
  'src/lib/cvn/rank-targets.ts': 1,
  'src/lib/daily-report-data.ts': 2,
  'src/lib/llm/gateway.ts': 1,
};

const EXACT_RE = /count:\s*['"]exact['"]/g;

export interface Violation { line: number; reason: string }

/** 한 파일 내용에서 대형 표 exact 를 찾는다. 순수 함수 — 아래에서 합성 입력으로 긍정 검증한다. */
export function findBigTableExact(src: string): Violation[] {
  const out: Violation[] = [];
  const lines = src.split(/\r?\n/);
  const hasOk = (ln: number) => lines.slice(Math.max(0, ln - 4), ln + 1).some((l) => l.includes('exact-ok:'));
  const bigAlt = BIG_TABLES.join('|');

  // (a) exact 직전의 가장 가까운 .from('x') 가 대형 표
  EXACT_RE.lastIndex = 0;
  for (let m = EXACT_RE.exec(src); m; m = EXACT_RE.exec(src)) {
    const before = src.slice(Math.max(0, m.index - 400), m.index);
    const froms = [...before.matchAll(/\.from\(\s*['"]([a-z0-9_]+)['"]\s*\)/g)];
    const last = froms[froms.length - 1];
    if (!last || !BIG_TABLES.includes(last[1])) continue;
    const ln = src.slice(0, m.index).split(/\r?\n/).length - 1;
    if (!hasOk(ln)) out.push({ line: ln + 1, reason: `exact count on ${last[1]}` });
  }

  // (b) exact 헬퍼에 대형 표 이름을 인자로 넘기는 형태 — one('apt_transactions') 등.
  //     .from( / .rpc( 뒤가 아닌 대형 표 리터럴은 헬퍼 경유로 본다(파일에 exact 가 있을 때만 호출됨).
  const litRe = new RegExp(`(\\.from\\(\\s*|\\.rpc\\(\\s*)?['"](${bigAlt})['"]`, 'g');
  lines.forEach((l, i) => {
    for (const m of l.matchAll(litRe)) {
      if (m[1]) continue;
      if (/^\s*(\/\/|\*)/.test(l)) continue;
      if (/\w\(\s*$/.test(l.slice(0, m.index))) {
        if (!hasOk(i)) out.push({ line: i + 1, reason: `big table ${m[2]} passed to helper in exact-count file` });
      }
    }
  });
  return out;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(p);
  }
  return acc;
}

const rel = (p: string) => relative(ROOT, p).split(sep).join('/');

const hotFiles = walk(SRC)
  .map((p) => ({ path: rel(p), text: readFileSync(p, 'utf8') }))
  .filter((f) => !COLD_PREFIXES.some((c) => f.path.startsWith(c)))
  .map((f) => ({ ...f, n: (f.text.match(EXACT_RE) ?? []).length }))
  .filter((f) => f.n > 0);

describe('검출기 긍정 검증', () => {
  it('대형 표 exact 를 잡는다', () => {
    const v = findBigTableExact(`const { count } = await sb.from('apt_transactions').select('id', { count: 'exact', head: true });`);
    expect(v).toHaveLength(1);
  });
  it('헬퍼 경유 대형 표를 잡는다', () => {
    const v = findBigTableExact(`const one = (t) => sb.from(t).select('*', { count: 'exact', head: true });\nawait one('stock_price_history');`);
    expect(v.length).toBeGreaterThan(0);
  });
  it('exact-ok 표지와 소형 표는 통과', () => {
    expect(findBigTableExact(`// exact-ok: EXPLAIN 인덱스 확인\nsb.from('apt_transactions').select('id', { count: 'exact', head: true })`)).toHaveLength(0);
    expect(findBigTableExact(`sb.from('apt_sites').select('id', { count: 'exact', head: true })`)).toHaveLength(0);
  });
});

describe('핫패스 count:exact', () => {
  it('스캔이 실제로 파일을 본다', () => {
    expect(hotFiles.length).toBeGreaterThan(10);
  });

  it('대형 표(10만+)를 exact 로 세지 않는다', () => {
    const bad = hotFiles.flatMap((f) => findBigTableExact(f.text).map((v) => `${f.path}:${v.line} ${v.reason}`));
    expect(bad).toEqual([]);
  });

  it('허용목록 밖 exact 신규·증가 없음 (감사 문서 갱신 후 HOT_ALLOW 수정)', () => {
    const over = hotFiles
      .filter((f) => f.n > (HOT_ALLOW[f.path] ?? 0))
      .map((f) => `${f.path}: ${f.n} > ${HOT_ALLOW[f.path] ?? 0}`);
    expect(over).toEqual([]);
  });
});
