/**
 * CV-N N-1 — 브랜드관 어댑터 (주 1회 · 2026-09-08).
 *
 * 공식 브랜드관은 (단지명 ↔ 사업명 ↔ 주소 ↔ 세대수) 를 «공식적으로» 잇는 유일한 표다.
 * 실증: acro.co.kr 의 아크로 라로체 = 시민공원주변재정비촉진3구역 · 3,545세대.
 *
 * ⛔ 어댑터는 «파서» 가 아니라 레지스트리 «행» 이다 — URL + 토큰만 DB(brand_tokens)에 있고
 *    추출은 AI 단일 경로다. 브랜드관 개편 때 고칠 코드가 없다.
 * ⛔ 미매칭을 폐기하지 않는다. 매칭에 실패한 카드는 presale_candidates 로 시드해
 *    커버리지를 겸한다 — 인리치와 발견을 같은 회전이 먹인다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { extractRegistryCards } from '@/lib/cvn/extract';
import { applyCandidate, loadSites, readSwitch } from '@/lib/cvn/apply';
import type { NameCandidateInput } from '@/lib/cvn/decide';
import { judgeSupplyType, normName, stripProvisional } from '@/lib/presale/candidate';

export const maxDuration = 300;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UA = 'Mozilla/5.0 (compatible; kadeora-bot)';

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function handler(req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('cvn-brand-registry', async () => {
      const admin = getSupabaseAdmin() as any;
      const sp = req.nextUrl.searchParams;
      const only = sp.get('brand');
      const limit = Math.max(1, Math.min(20, Number(sp.get('limit') ?? '6')));

      if (!(await readSwitch(admin, 'watcher_enabled', true))) {
        return { processed: 0, metadata: { skipped: 'cvn.watcher_enabled = false' } };
      }
      const autoApply = await readSwitch(admin, 'autoapply_enabled', false);

      let q = admin
        .from('brand_tokens')
        .select('brand, builders, registry_url')
        .eq('is_active', true)
        .not('registry_url', 'is', null);
      if (only) q = q.eq('brand', only);
      const { data: brands } = await q.limit(limit);

      const rows = (brands ?? []) as Array<{ brand: string; builders: string[]; registry_url: string }>;
      if (!rows.length) return { processed: 0, metadata: { message: 'registry_url 있는 브랜드 없음' } };

      const sites = await loadSites(admin);
      const runId = `cvn-n1-${new Date().toISOString().slice(0, 10)}`;
      let cards = 0;
      let applied = 0;
      let seeded = 0;
      const failures: string[] = [];
      const outcomes: any[] = [];

      for (const b of rows) {
        const html = await fetchHtml(b.registry_url);
        if (!html) {
          failures.push(`${b.brand}: 페이지 응답 없음`);
          continue;
        }
        const got = await extractRegistryCards(b.brand, b.registry_url, html);
        if (got.kind !== 'ok' || !got.value) {
          failures.push(`${b.brand}: ${got.kind} ${got.detail}`);
          continue;
        }
        cards += got.value.length;

        for (const card of got.value) {
          const input: NameCandidateInput = {
            proposedName: card.brandName,
            eventType: 'name_confirm',
            source: `brand_registry:${b.brand}`,
            sourceUrl: b.registry_url,
            projectName: card.projectName,
            builderRaw: (b.builders ?? [])[0] ?? null,
            totalUnits: card.units,
          };
          const out = await applyCandidate(input, sites, { admin, runId, autoApply });
          if (out.wrote) applied += 1;
          outcomes.push({ brand: b.brand, name: card.brandName, tier: out.tier, res: out.resolution });

          // 매칭 실패 → 신규 시드 후보. ⛔ 버리지 않는다.
          // ⚠️ 시드 표의 규약은 builder-presale-crawl 이 이미 정해 두었다 —
          //    source/norm_name 이 유일 키이고 supply_type 은 NOT NULL 이다. 새 규약을 만들지 않는다.
          if (!out.siteId) {
            const now = new Date().toISOString();
            const builder = (b.builders ?? [])[0] ?? null;
            await admin.from('presale_candidates').upsert(
              {
                source: `brand_registry:${b.brand}`,
                source_url: b.registry_url,
                raw_name: card.brandName,
                norm_name: normName(stripProvisional(card.brandName)),
                addr_raw: card.address,
                builder_raw: builder,
                total_units: card.units,
                supply_type: judgeSupplyType(card.brandName, card.address, b.brand),
                resolution: 'queued',
                resolution_note: card.projectName
                  ? `CV-N N-1 미매칭 — 브랜드관이 말한 사업명: ${card.projectName}`.slice(0, 300)
                  : 'CV-N N-1 미매칭 — 브랜드관에 사업명 없음',
                last_seen_at: now,
                updated_at: now,
              },
              { onConflict: 'source,norm_name' },
            );
            seeded += 1;
          }
        }
      }

      return {
        processed: cards,
        metadata: {
          brands: rows.length, cards, applied, seeded,
          auto_apply: autoApply, shadow: !autoApply,
          failures: failures.slice(0, 10),
          outcomes: outcomes.slice(0, 30),
        },
      };
    }),
  );
}

export const GET = withCronAuthFlex(handler);
