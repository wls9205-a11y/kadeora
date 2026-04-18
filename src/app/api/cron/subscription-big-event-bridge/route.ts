/**
 * [SUBSCRIPTION-BRIDGE] apt_subscriptions → big_event_registry 자동 승격
 *
 * 조건:
 *  - 총공급세대(tot_supply_hshld_co) ≥ 500 또는 mdatrgbn_nm/주택구분이 아파트
 *  - 청약 접수 시작일(rcept_bgnde) 또는 당첨자 발표(przwner_presnatn_de)가 오늘 이후(미래)
 *
 * 동작:
 *  - big_event_registry에 매칭 slug 없으면 INSERT
 *    event_type='신축분양', stage=6, constructor_status='confirmed'(시공사 있을 때)
 *  - 매칭 있으면 stage/scale_after/constructors 업데이트
 *
 * 주 1회 pg_cron 실행 (Vercel 100 cron 한도 외부)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 120;
export const runtime = 'nodejs';

function slugifyKorean(name: string, regionSigungu: string): string {
  const base = `${name || ''}-${regionSigungu || ''}-sub`
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9가-힣\-_.]/g, '')
    .slice(0, 80);
  return base || `sub-${Date.now()}`;
}

function splitRegion(regionNm: string | null | undefined): { sido: string; sigungu: string } {
  const raw = (regionNm || '').trim();
  if (!raw) return { sido: '', sigungu: '' };
  const parts = raw.split(/\s+/);
  if (parts.length >= 2) return { sido: parts[0], sigungu: parts.slice(1).join(' ') };
  return { sido: raw, sigungu: '' };
}

function priorityFromScale(scale: number | null | undefined): number {
  const n = Number(scale || 0);
  if (n >= 2000) return 90;
  if (n >= 1000) return 80;
  if (n >= 500) return 60;
  return 45;
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('subscription-big-event-bridge', async () => {
      const sb = getSupabaseAdmin();

      const todayIso = new Date().toISOString().slice(0, 10);

      // 500+ 세대 또는 mdatrgbn_nm='아파트' + 미래 접수 또는 당첨 발표
      const { data: subs } = await (sb as any)
        .from('apt_subscriptions')
        .select('id, house_manage_no, house_nm, region_nm, supply_addr, tot_supply_hshld_co, rcept_bgnde, rcept_endde, przwner_presnatn_de, constructor_nm, developer_nm, pblanc_url, mdatrgbn_nm')
        .not('house_nm', 'is', null)
        .or(`rcept_bgnde.gte.${todayIso},przwner_presnatn_de.gte.${todayIso}`)
        .order('rcept_bgnde', { ascending: true })
        .limit(200);

      if (!subs || subs.length === 0) {
        return { processed: 0, created: 0, updated: 0, metadata: { message: 'no upcoming subscriptions' } };
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const failures: string[] = [];

      for (const sub of subs as any[]) {
        try {
          const scale = Number(sub.tot_supply_hshld_co || 0);
          const isApt = (sub.mdatrgbn_nm || '').includes('아파트');
          if (scale < 500 && !isApt) { skipped++; continue; }
          if (!sub.house_nm || sub.house_nm.length < 2) { skipped++; continue; }

          const region = splitRegion(sub.region_nm);
          const slug = slugifyKorean(sub.house_nm, region.sigungu);
          const constructors: string[] = sub.constructor_nm ? [sub.constructor_nm] : [];
          const factSources: string[] = sub.pblanc_url ? [sub.pblanc_url] : [];

          // 매칭 체크
          const { data: existing } = await (sb as any)
            .from('big_event_registry')
            .select('id, slug, stage, scale_after, key_constructors, fact_sources')
            .or(`slug.eq.${slug},name.eq.${sub.house_nm}`)
            .maybeSingle();

          if (existing) {
            const mergedSources = Array.from(new Set([
              ...(Array.isArray(existing.fact_sources) ? existing.fact_sources : []),
              ...factSources,
            ]));
            const { error } = await (sb as any)
              .from('big_event_registry')
              .update({
                stage: 6,
                stage_updated_at: new Date().toISOString(),
                scale_after: scale > 0 ? scale : existing.scale_after,
                key_constructors: constructors.length > 0 ? constructors : existing.key_constructors,
                constructor_status: constructors.length > 0 ? 'confirmed' : (existing as any).constructor_status || 'unconfirmed',
                fact_sources: mergedSources,
                notes: `청약 브리지 업데이트 ${new Date().toISOString().slice(0,10)} · 세대 ${scale || '?'} · 시공 ${sub.constructor_nm || '-'}`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
            if (error) failures.push(`${sub.house_nm}:${error.message}`);
            else updated++;
            continue;
          }

          const { error } = await (sb as any).from('big_event_registry').insert({
            slug,
            name: sub.house_nm,
            full_name: sub.supply_addr ? `${sub.house_nm} (${sub.supply_addr})` : sub.house_nm,
            region_sido: region.sido,
            region_sigungu: region.sigungu,
            region_dong: null,
            event_type: '신축분양',
            stage: 6,
            stage_updated_at: new Date().toISOString(),
            scale_before: null,
            scale_after: scale > 0 ? scale : null,
            build_year_before: null,
            build_year_after_est: null,
            key_constructors: constructors,
            new_brand_name: null,
            constructor_status: constructors.length > 0 ? 'confirmed' : 'unconfirmed',
            fact_sources: factSources,
            priority_score: priorityFromScale(scale),
            is_active: true,
            notes: `apt_subscriptions 자동 승격 · 접수 ${sub.rcept_bgnde || '-'}~${sub.rcept_endde || '-'} · 시공 ${sub.constructor_nm || '-'}`,
          });
          if (error) {
            // slug unique 충돌은 skip
            if (/duplicate key/i.test(error.message || '')) { skipped++; continue; }
            failures.push(`${sub.house_nm}:${error.message}`);
          } else {
            created++;
          }
        } catch (err: any) {
          failures.push(`${sub.house_nm || 'unknown'}:${err?.message || 'unknown'}`);
        }
      }

      return {
        processed: subs.length,
        created,
        updated,
        failed: failures.length,
        metadata: {
          skipped,
          sample_failures: failures.slice(0, 5),
        },
      };
    }, { redisLockTtlSec: 240 }),
  );
}

export const GET = withCronAuth(handler);
