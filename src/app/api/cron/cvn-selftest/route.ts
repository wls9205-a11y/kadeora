/**
 * CV-N L2 — 포스트디플로이 셀프테스트 (2026-09-08).
 *
 * ── L1 과 무엇이 다른가 ─────────────────────────────────────────────────────
 * L1(vitest·python)은 AI 를 부르지 않는다. 로컬·CI 에 ANTHROPIC 키가 없기 때문이고,
 * 그래서 push 조건이 될 수 있다. 그러나 그것만으로는 «배포된 환경에서 AI 가 실제로
 * 스키마대로 답하는가» 를 모른다. 여기가 그 자리다.
 *
 * ⛔ 이 라우트는 «쓰지 않는다». 매칭·티어까지만 굴려 보고 판정만 한다.
 *    green 이면 cvn.autoapply_enabled 를 켜고, red 면 «배포 실패가 아니라» 섀도로 남긴다 —
 *    크론은 계속 돌되 원장만 쌓이고 적용은 0 이다. 한방 배포는 어떤 경우에도 성공하고,
 *    위험할 때 스스로 안전 모드로 내려간다.
 *
 * ⚠️ 라이브 브랜드관 HTML 로 판정하지 않는다. 그 페이지는 코드와 무관하게 바뀌므로
 *    「코드가 멀쩡한데 red」를 만든다(v1.2-A 가 막으려던 형태). 대신 골든 기사 «문면» 을
 *    실제 AI 에 태운다 — AI 왕복·스키마·분류 정확도는 진짜로 재고, 외부 변동은 타지 않는다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { classifyNewsBatch } from '@/lib/cvn/extract';
import { loadSites, setSwitch } from '@/lib/cvn/apply';
import { decideTier, matchSite, type NameCandidateInput } from '@/lib/cvn/decide';
import { GOLDEN_CASES, GOLDEN_SNIPPETS } from '@/lib/cvn/golden';

export const maxDuration = 300;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('cvn-selftest', async () => {
      const admin = getSupabaseAdmin() as any;
      const dry = req.nextUrl.searchParams.get('dry') === '1';

      const got = await classifyNewsBatch(
        GOLDEN_SNIPPETS.map((s) => ({ title: s.title, description: s.description, url: s.url })),
      );
      if (got.kind !== 'ok' || !got.value) {
        const detail = `AI 추출 실패: ${got.kind} ${got.detail}`;
        if (!dry) await report(admin, false, detail, []);
        return { processed: 0, metadata: { green: false, reason: detail } };
      }

      // ⚠️ 매칭은 «실 DB» 로 한다. 그래야 N-0 병합 결과까지 같은 판정에 실린다.
      const sites = await loadSites(admin);
      const byUrl = new Map(got.value.map((c) => [c.url, c]));
      const checks: Array<{ key: string; ok: boolean; detail: string }> = [];

      for (const snip of GOLDEN_SNIPPETS) {
        const expect = GOLDEN_CASES.find((c) => c.key === snip.key);
        const card = byUrl.get(snip.url);
        if (!card) {
          checks.push({ key: snip.key, ok: false, detail: '분류 결과 없음' });
          continue;
        }
        if (card.eventType !== snip.expectEvent) {
          checks.push({
            key: snip.key, ok: false,
            detail: `event_type ${card.eventType} (기대 ${snip.expectEvent})`,
          });
          continue;
        }
        const pn = (card.projectName ?? '').replace(/\s/g, '');
        if (!pn.includes(snip.expectProjectContains)) {
          checks.push({
            key: snip.key, ok: false,
            detail: `사업명 «${card.projectName}» 에 ${snip.expectProjectContains} 없음`,
          });
          continue;
        }

        const input: NameCandidateInput = {
          proposedName: card.proposedName,
          eventType: card.eventType,
          source: 'news:naver',
          sourceUrl: card.url,
          projectName: card.projectName,
          sigungu: card.region ?? expect?.sigungu ?? null,
          builderRaw: card.builder,
          crossRefs: 1,
        };
        const m = matchSite(input, sites);
        const d = decideTier(input, m);

        if (expect?.expectSiteId && m.siteId !== expect.expectSiteId) {
          checks.push({ key: snip.key, ok: false, detail: `매칭 ${m.siteId ?? 'null'} (기대 ${expect.expectSiteId})` });
          continue;
        }
        // bid 는 «절대» 적용되면 안 된다 — T-C 차단이 이 셋의 핵심이다.
        if (snip.expectEvent === 'bid' && (d.apply || d.tier !== 'T-C')) {
          checks.push({ key: snip.key, ok: false, detail: `bid 가 차단되지 않음 (tier ${d.tier}, apply ${d.apply})` });
          continue;
        }
        checks.push({ key: snip.key, ok: true, detail: `${d.tier} · ${d.resolution}` });
      }

      const failed = checks.filter((c) => !c.ok);
      const green = failed.length === 0;

      if (!dry) {
        await setSwitch(admin, 'autoapply_enabled', green);
        await report(admin, green, green ? '' : failed.map((f) => `${f.key}: ${f.detail}`).join(' / '), checks);
      }

      return {
        processed: checks.length,
        metadata: {
          green,
          autoapply: green,
          mode: green ? 'live' : 'shadow',
          failed: failed.length,
          checks,
        },
      };
    }),
  );
}

async function report(
  admin: any,
  green: boolean,
  detail: string,
  checks: Array<{ key: string; ok: boolean; detail: string }>,
): Promise<void> {
  const lines = checks.map((c) => `${c.ok ? '✅' : '❌'} ${c.key} — ${c.detail}`).join('\n');
  await admin.from('admin_alerts').insert({
    type: 'cvn_selftest',
    severity: green ? 'info' : 'warning',
    title: green
      ? 'CV-N L2 green — 자동 적용을 켰다'
      : 'CV-N L2 red — 섀도로 남는다(배포는 성공했다)',
    message: green
      ? `골든 ${checks.length}건 전부 통과. cvn.autoapply_enabled = true.\n\n${lines}`
      : `골든셋이 통과하지 못했다. 크론은 계속 돌되 «원장만» 쌓이고 적용은 0 이다.\n` +
        `고친 뒤 이 라우트를 다시 부르면 그때 켜진다.\n\n${detail}\n\n${lines}`,
    metadata: { green, checks },
  });
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
