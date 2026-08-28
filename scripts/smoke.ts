/**
 * H7-0 — 배포 후 스모크.
 *
 * 사용:  npx tsx scripts/smoke.ts https://kadeora.app
 *
 * ── 왜 있나 ─────────────────────────────────────────────────────────────────
 * H7 §0 실측: 「회귀가 배포 후 «하루 뒤에» 발견됐다」. /blog 지역 선택이 0건이 된 것도,
 * 홈 「최근 움직인」이 전부 같은 문구가 된 것도 사람이 화면을 보고서야 드러났다.
 * 배포가 READY 인 것과 화면이 멀쩡한 것은 «다른 사실» 이다.
 *
 * ⛔ 이 스크립트가 하나라도 실패하면 그 커밋을 «완료로 보고하지 않는다»(Rule #114).
 * ⚠️ 로컬이 아니라 «프로덕션 URL» 을 친다. 로컬은 Supabase 키가 만료라 빈 화면이 나오고,
 *    빈 화면은 「깨진 것」과 「데이터가 없는 것」을 구분해 주지 않는다.
 */

import { chromium, type Browser, type Page } from 'playwright';

const BASE = (process.argv[2] || 'https://kadeora.app').replace(/\/$/, '');
const BOT_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const HUMAN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

type Level = 'fail' | 'warn';
const problems: { level: Level; where: string; msg: string }[] = [];
let checks = 0;

function ok(where: string, msg: string) {
  checks++;
  console.log(`  ✅ ${where} — ${msg}`);
}
function bad(where: string, msg: string, level: Level = 'fail') {
  checks++;
  problems.push({ level, where, msg });
  console.log(`  ${level === 'fail' ? '❌' : '⚠️ '} ${where} — ${msg}`);
}
/**
 * `owner` 를 주면 실패가 «경고» 가 된다 — 「그 커밋이 고칠 예정인 것」이라는 뜻이다.
 *
 * ⚠️ 무시가 아니다. 요약에 담당 커밋과 함께 «반드시» 찍히고, 그 커밋이 끝나면
 *    owner 를 지워 다시 fail 로 올린다. 이 장치가 없으면 2차 몫(H7-5·H7-6) 때문에
 *    1차 커밋이 영구히 빨간불이라 게이트가 아무 말도 못 하게 된다.
 * ⛔ 「지금 고치기 귀찮다」는 owner 사유가 아니다. 지시서에 그 커밋이 있어야 한다.
 */
function expect(where: string, cond: boolean, msg: string, owner?: string) {
  if (cond) return ok(where, msg);
  bad(where, owner ? `${msg}  <- ${owner} 예정` : msg, owner ? 'warn' : 'fail');
}

/** 화면 어디에도 있으면 안 되는 문구. 확정된 카피 규칙이라 상시 검사한다. */
const FORBIDDEN: [string, RegExp][] = [
  ['「인기」', /인기/],
  ['「부울경」', /부울경/],
  ['「부산·울산」', /부산\s*[·,]\s*울산/],
  ['실거래 「오늘/어제」', /(오늘|어제)\s*(실거래|거래)/],
  ['tel: 링크', /href=["']tel:/i],
];

/**
 * ⚠️ 금칙어는 «우리가 쓴 카피» 에만 건다. 블로그 본문에는 사람이 쓴 「인기」가
 *    정당하게 들어갈 수 있다(blog_posts 본문은 무수정이 원칙이다).
 *    그래서 상세 글에서는 <article> 안쪽을 잘라내고 검사한다.
 */
function chrome(html: string, stripArticle: boolean): string {
  if (!stripArticle) return html;
  return html.replace(/<article[\s\S]*?<\/article>/gi, '');
}

/**
 * ⚠️ 광고·동의 스크립트(구글 펀딩초이스·adtrafficquality 등)가 콘솔 에러를 «항상» 낸다.
 *    CSP 거부와 외부 CDN 실패는 우리가 고칠 대상이 아니고, 그것까지 세면 이 검사가
 *    영구히 빨간불이라 «아무도 안 보게» 된다. 우리 도메인 문제만 남긴다.
 */
const THIRD_PARTY = /(googlesyndication|googletagmanager|google-analytics|doubleclick|adtrafficquality|fundingchoicesmessages|adsbygoogle|gstatic|facebook|kakao\.com|pstatic\.net|daumcdn)/i;

async function open(b: Browser, path: string) {
  const page = await b.newPage({ viewport: { width: 1280, height: 1080 } });
  const consoleErrors: string[] = [];
  const internal404: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (THIRD_PARTY.test(t)) return;
    consoleErrors.push(t.slice(0, 200));
  });
  page.on('pageerror', (e) => {
    const t = String(e);
    if (!THIRD_PARTY.test(t)) consoleErrors.push(t.slice(0, 200));
  });
  // ⚠️ 죽은 «내부» 링크는 prefetch 로 드러난다 — 사람이 누르기 전에 잡히는 유일한 신호다.
  page.on('response', (r) => {
    if (r.status() !== 404) return;
    const u = r.url();
    if (u.startsWith(BASE)) internal404.push(u.replace(BASE, '').split('?')[0]);
  });
  const res = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 90000 });
  return { page, res, consoleErrors, internal404 };
}

/** 공통 — 응답 코드 · 금칙어 · 콘솔 에러. 모든 페이지가 통과해야 한다. */
async function common(
  where: string,
  page: Page,
  status: number,
  consoleErrors: string[],
  internal404: string[] = [],
  stripArticle = false,
) {
  expect(where, status < 500, `응답 ${status} (5xx 아님)`);
  const html = chrome(await page.content(), stripArticle);
  for (const [label, re] of FORBIDDEN) {
    // 「인기 시리즈」 라벨 하나가 남아 있고 그것은 H7-5 몫이다. 그 외 「인기」는 즉시 실패.
    const onlySeries =
      label === '「인기」' && /인기 시리즈/.test(html) && (html.match(/인기/g) || []).length === 1;
    expect(where, !re.test(html), `${label} 0건`, onlySeries ? 'H7-5' : undefined);
  }
  expect(
    where,
    consoleErrors.length === 0,
    consoleErrors.length ? `콘솔 에러 ${consoleErrors.length}건: ${consoleErrors[0]}` : '콘솔 에러 0 (외부 광고 스크립트 제외)',
  );
  const dead = [...new Set(internal404)];
  expect(
    where,
    dead.length === 0,
    dead.length ? `내부 404 ${dead.length}종: ${dead.slice(0, 3).join(', ')}` : '내부 404 0건',
  );
}

/** 깨진 이미지 — H7-3 이전에는 외부 핫링크가 실제로 죽어 있다. 전부 200 이어야 한다. */
async function imagesLoad(where: string, page: Page) {
  const srcs: string[] = await page.evaluate(() =>
    [...document.querySelectorAll('img')]
      .map((i) => (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src)
      .filter((s) => s && !s.startsWith('data:')),
  );
  const uniq = [...new Set(srcs)];
  const dead: string[] = [];
  for (const s of uniq) {
    try {
      const r = await fetch(s, { method: 'HEAD', redirect: 'follow' });
      // 일부 CDN 이 HEAD 를 막는다 — 405/501 이면 GET 으로 한 번 더 본다.
      if (r.status === 405 || r.status === 501) {
        const g = await fetch(s, { method: 'GET', redirect: 'follow' });
        if (!g.ok) dead.push(`${g.status} ${s.slice(0, 90)}`);
      } else if (!r.ok) dead.push(`${r.status} ${s.slice(0, 90)}`);
    } catch (e) {
      dead.push(`ERR ${s.slice(0, 90)}`);
    }
  }
  expect(where, dead.length === 0, dead.length ? `깨진 이미지 ${dead.length}/${uniq.length}: ${dead[0]}` : `이미지 ${uniq.length}장 전부 200`);
}

/** 죽은 링크·빈 버튼 — H7-6 이 정리할 대상을 상시로 잡는다. */
async function deadControls(where: string, page: Page) {
  const bad0 = await page.evaluate(() => {
    const anchorsNoHref = [...document.querySelectorAll('a')].filter(
      (a) => !a.getAttribute('href'),
    ).length;
    const buttonsInert = [...document.querySelectorAll('button')].filter(
      (b) => !b.onclick && !b.getAttribute('form') && b.type !== 'submit' && !b.hasAttribute('data-action'),
    ).length;
    const closed = [...document.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href') || '')
      .filter((h) => /^\/(feed|discuss|write)(\/|$|\?)/.test(h) || /^\/apt\/map(\/|$|\?)/.test(h));
    return { anchorsNoHref, buttonsInert, closed: [...new Set(closed)] };
  });
  expect(where, bad0.anchorsNoHref === 0, `href 없는 <a> ${bad0.anchorsNoHref}개`);
  expect(
    where,
    bad0.closed.length === 0,
    bad0.closed.length ? `닫힌 라우트 링크 ${bad0.closed.length}종: ${bad0.closed.join(', ')}` : '닫힌 라우트 링크 0',
    bad0.closed.length ? 'H7-6' : undefined,
  );
  // ⚠️ 버튼은 React 가 onclick 프로퍼티를 쓰지 않아 오탐이 난다. 경고로만 남긴다.
  if (bad0.buttonsInert > 0) {
    console.log(`  ·  ${where} — (참고) 핸들러 미검출 button ${bad0.buttonsInert}개 · React 합성 이벤트라 오탐 가능`);
  }
}

/** 봇과 사람에게 같은 것을 준다(클로킹 금지). */
async function sameForBot(where: string, path: string) {
  const [a, b] = await Promise.all([
    fetch(BASE + path, { headers: { 'User-Agent': BOT_UA } }).then((r) => r.text()),
    fetch(BASE + path, { headers: { 'User-Agent': HUMAN_UA } }).then((r) => r.text()),
  ]);
  // 나노초 타임스탬프·난수 id 로 «바이트가 완전히» 같기는 어렵다. 1% 이내면 같은 것으로 본다.
  const diff = Math.abs(a.length - b.length);
  const rel = diff / Math.max(a.length, b.length || 1);
  expect(where, rel < 0.01, `봇/사람 응답 크기 차 ${diff}B (${(rel * 100).toFixed(2)}%)`);
}

async function main() {
  console.log(`\n■ H7-0 스모크 — ${BASE}\n`);
  const b = await chromium.launch();

  // ── / ─────────────────────────────────────────────────────────────────────
  {
    const w = '/';
    const { page, res, consoleErrors, internal404 } = await open(b, '/');
    await common(w, page, res!.status(), consoleErrors, internal404);
    const m = await page.evaluate(() => ({
      hero: document.querySelectorAll('.kd-home-hero').length,
      stats: [...document.querySelectorAll('.kd-home-hero__stat')].map((e) => e.textContent || ''),
      // 클래스에 기대지 «않는다». 첫판에 .kd-lrow 로 셌다가 0 이 나왔는데 화면에는
      // 5개가 멀쩡히 있었다 - 홈은 그 클래스를 쓰지 않는다. 제목에서 섹션을 찾는다.
      moved: (() => {
        const h = [...document.querySelectorAll('h2,h3')].find((x) =>
          (x.textContent || '').includes('최근 움직인'),
        );
        if (!h) return 0;
        return (h.closest('section') || h.parentElement)!.querySelectorAll('a[href]').length;
      })(),
      leadForm: document.querySelectorAll('form input[name="phone"], form input[type="tel"]').length,
    }));
    expect(w, m.hero === 1, `히어로 ${m.hero}개 (정확히 1)`);
    expect(w, m.stats.length >= 2, `데이터 띠 ${m.stats.length}칸`);
    // ⚠️ 3칸은 «데이터가 있을 때» 다. 청약 접수 예정이 없으면 2칸이 옳다(H7 §0 별도 기록).
    if (m.stats.length < 3) {
      console.log(`  ·  ${w} — (참고) 3칸 미만. 각 칸은 데이터가 있을 때만 렌더된다`);
    }
    expect(w, m.stats.every((s) => /\d/.test(s)), '각 데이터 칸에 숫자 있음');
    expect(w, m.moved >= 1, `「최근 움직인 현장」 항목 ${m.moved}개 (≥1)`);
    expect(w, m.leadForm === 0, `홈 리드폼 ${m.leadForm}개 (0이어야 함)`);
    await deadControls(w, page);
    await imagesLoad(w, page);
    await sameForBot(w, '/');
    await page.close();
  }

  // ── /apt?region=부산 ──────────────────────────────────────────────────────
  {
    const w = '/apt?region=부산';
    const { page, res, consoleErrors, internal404 } = await open(b, '/apt?region=' + encodeURIComponent('부산'));
    await common(w, page, res!.status(), consoleErrors, internal404);
    const m = await page.evaluate(() => ({
      cards: document.querySelectorAll('.sub-card').length,
      rows: document.querySelectorAll('.kd-lrow').length,
      empty: document.querySelectorAll('.apt-block__empty').length,
      blocks: [...document.querySelectorAll('.apt-block')].map((s) => ({
        h: (s.querySelector('.apt-block__h')?.textContent || '').trim().slice(0, 24),
        n: s.querySelectorAll('.apt-pcard, .kd-lrow').length,
      })),
    }));
    expect(w, m.cards >= 3, `캐러셀 카드 ${m.cards}장 (≥3)`);
    expect(w, m.rows >= 5, `텍스트 줄 ${m.rows}개 (≥5)`);
    expect(w, m.empty === 0, `빈 상태 문구 ${m.empty}개 (0)`);
    const soon = m.blocks.find((x) => x.h.includes('곧 나올'));
    expect(w, !!soon && soon.n >= 3, `「곧 나올 현장」 ${soon?.n ?? 0}개 (≥3)`);
    await deadControls(w, page);
    await imagesLoad(w, page);
    await page.close();
  }

  // ── /apt/[id] 2건 ─────────────────────────────────────────────────────────
  for (const slug of ['엄궁역-트라비스-하늘채', '기장-이진캐스빌-포레']) {
    const w = `/apt/${slug}`;
    const { page, res, consoleErrors, internal404 } = await open(b, '/apt/' + encodeURIComponent(slug));
    await common(w, page, res!.status(), consoleErrors, internal404);
    const m = await page.evaluate(() => {
      const lds = [...document.querySelectorAll('script[type="application/ld+json"]')].map(
        (s) => s.textContent || '',
      );
      const obs = document.querySelector('.obs-list, [data-kd="observations"]');
      const lead = document.querySelector('#lead-form, [id*="lead"]');
      return {
        h1: document.querySelectorAll('h1').length,
        lds,
        obsTop: obs ? Math.round(obs.getBoundingClientRect().top + window.scrollY) : null,
        leadTop: lead ? Math.round(lead.getBoundingClientRect().top + window.scrollY) : null,
      };
    });
    expect(w, m.h1 === 1, `h1 ${m.h1}개 (정확히 1)`);
    let parsed = 0;
    let hasId = false;
    for (const t of m.lds) {
      try {
        const j = JSON.parse(t);
        parsed++;
        const arr = Array.isArray(j) ? j : [j];
        if (arr.some((x) => x && x['@id'])) hasId = true;
      } catch {
        /* 아래에서 개수로 잡힌다 */
      }
    }
    expect(w, parsed === m.lds.length && parsed > 0, `JSON-LD ${parsed}/${m.lds.length}개 파싱 OK`);
    expect(w, hasId, 'JSON-LD 에 @id 존재');
    if (m.obsTop !== null && m.leadTop !== null) {
      expect(w, m.obsTop < m.leadTop, `「최근 관측」이 리드폼 위 (obs ${m.obsTop} < lead ${m.leadTop})`);
    } else {
      console.log(`  ·  ${w} — (참고) 관측 블록 ${m.obsTop === null ? '없음' : '있음'} · 리드폼 ${m.leadTop === null ? '없음' : '있음'}`);
    }
    await deadControls(w, page);
    await imagesLoad(w, page);
    await page.close();
  }

  // ── /blog 지역 필터 (H7-1 이 고치는 자리) ─────────────────────────────────
  for (const q of ['?region=부산', '?region=부산&sgg=해운대구']) {
    const w = '/blog' + q;
    const { page, res, consoleErrors, internal404 } = await open(
      b,
      '/blog?' + new URLSearchParams(Object.fromEntries(new URLSearchParams(q.slice(1)))).toString(),
    );
    await common(w, page, res!.status(), consoleErrors, internal404);
    const n = await page.evaluate(
      () => document.querySelectorAll('article a[href^="/blog/"], .kd-lrow, li a[href^="/blog/"]').length,
    );
    expect(w, n >= 1, `목록 ${n}건 (≥1)`);
    await page.close();
  }

  // ── /blog/{최신} ──────────────────────────────────────────────────────────
  {
    const { page: lp } = await open(b, '/blog');
    const slug = await lp.evaluate(() => {
      const a = document.querySelector('a[href^="/blog/"]');
      return a ? (a.getAttribute('href') || '').replace('/blog/', '') : null;
    });
    await lp.close();
    if (!slug) {
      bad('/blog', '최신 글 링크를 찾지 못해 상세 검사를 못 했다');
    } else {
      const w = `/blog/${decodeURIComponent(slug).slice(0, 30)}…`;
      const { page, res, consoleErrors, internal404 } = await open(b, '/blog/' + slug);
      await common(w, page, res!.status(), consoleErrors, internal404, /* stripArticle */ true);
      const m = await page.evaluate(() => {
        const ext = [...document.querySelectorAll('article img, .prose img, main img')]
          .map((i) => (i as HTMLImageElement).src)
          .filter((s) => s && !s.startsWith('data:') && !/kadeora\.app|supabase|^\//.test(s));
        const abouts: string[] = [];
        for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
          try {
            const j = JSON.parse(s.textContent || '');
            for (const x of Array.isArray(j) ? j : [j]) {
              const a = x?.about;
              for (const one of Array.isArray(a) ? a : [a]) {
                const u = one?.['@id'] || one?.url;
                if (typeof u === 'string') abouts.push(u);
              }
            }
          } catch { /* common() 이 파싱 실패를 따로 잡지 않는 페이지다 */ }
        }
        return { ext: [...new Set(ext)], abouts: [...new Set(abouts)] };
      });
      expect(w, m.ext.length === 0, m.ext.length ? `본문 외부 이미지 ${m.ext.length}장: ${m.ext[0].slice(0, 70)}` : '본문 외부 이미지 0장');
      for (const u of m.abouts) {
        try {
          const r = await fetch(u, { method: 'HEAD', redirect: 'follow' });
          expect(w, r.ok, `JSON-LD about ${r.status} ${u.slice(0, 60)}`);
        } catch {
          bad(w, `JSON-LD about 요청 실패 ${u.slice(0, 60)}`);
        }
      }
      await page.close();
    }
  }

  await b.close();

  const fails = problems.filter((p) => p.level === 'fail');
  const warns = problems.filter((p) => p.level === 'warn');
  console.log(`
■ 검사 ${checks} / 실패 ${fails.length} / 예정(경고) ${warns.length}`);
  if (fails.length) {
    console.log('
  -- 지금 고쳐야 하는 것 --');
    for (const p of fails) console.log(`   ❌ ${p.where} — ${p.msg}`);
  }
  if (warns.length) {
    console.log('
  -- 뒤 커밋이 고칠 예정 (무시 아님. 그 커밋 뒤 다시 fail 로 올린다) --');
    for (const p of warns) console.log(`   ⚠️  ${p.where} — ${p.msg}`);
  }
  if (fails.length) {
    console.log('\n⛔ 스모크 실패 — 이 커밋을 «완료로 보고하지 않는다»(Rule #114).');
    process.exit(1);
  }
  console.log('\n✅ 스모크 통과');
}

main().catch((e) => {
  console.error('스모크 자체가 죽었다:', e);
  process.exit(1);
});
