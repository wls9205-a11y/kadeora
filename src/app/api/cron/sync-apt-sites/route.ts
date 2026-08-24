import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { generateAptSlug } from '@/lib/apt-slug';

export const maxDuration = 300;

// V18 A: 여기 있던 사본을 걷어내고 lib/apt-slug.ts 원본을 쓴다 (로직 동일, 동작 불변).
//
// ⚠️ **strict 로 바꾸지 말 것.** 이 값은 생성뿐 아니라 62·211행에서 **기존 행 조회에도**
//    쓰인다. 규칙을 바꾸면 느슨한 값으로 저장된 활성 160행을 못 찾아
//    같은 현장이 매 실행마다 새로 생긴다. 정리하려면 DB 쪽 slug 마이그레이션이 먼저다.
const makeSlug = generateAptSlug;

const extractSigungu = (addr: string | null) =>
  addr?.match(/(?:시|도)\s+(\S+구|\S+시|\S+군)/)?.[1] || null;

async function handler(_req: NextRequest) {
  const start = Date.now();
  const sb = getSupabaseAdmin();
  let inserted = 0;
  let updated = 0;
  let scored = 0;
  const errors: string[] = [];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 1: 청약(apt_subscriptions) → apt_sites
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  try {
    const { data: subs } = await sb.from('apt_subscriptions')
      .select('id, house_nm, house_manage_no, region_nm, supply_addr, tot_supply_hshld_co, mvn_prearnge_ym, constructor_nm, developer_nm, rcept_bgnde, nearest_station, nearest_school')
      .not('house_nm', 'is', null)
      .order('id', { ascending: false }).limit(500);

    for (const s of (subs || [])) {
      if (!s.house_nm || s.house_nm.trim().length < 3) continue;
      const slug = makeSlug(s.house_nm);
      if (!slug) continue;

      const { error } = await sb.from('apt_sites').upsert({
        slug, name: s.house_nm.trim(), site_type: 'subscription',
        region: s.region_nm, sigungu: extractSigungu(s.supply_addr),
        address: s.supply_addr, total_units: s.tot_supply_hshld_co || null,
        move_in_date: s.mvn_prearnge_ym, builder: s.constructor_nm, developer: s.developer_nm,
        source_ids: { subscription_id: String(s.id), house_manage_no: s.house_manage_no },
        nearby_station: s.nearest_station, school_district: s.nearest_school,
        status: s.rcept_bgnde && s.rcept_bgnde >= '2026-01-01' ? 'active' : 'closed',
        sitemap_wave: s.rcept_bgnde && s.rcept_bgnde >= '2026-01-01' ? 1 : 2,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'slug', ignoreDuplicates: false });
      if (error) console.error('[sync-apt-sites] insert fail', error.message?.slice(0, 200));
      else inserted++;
    }
  } catch (e: unknown) { errors.push(`sub: ${errMsg(e)}`); }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 2: 재개발(redevelopment_projects) → apt_sites (배치 최적화)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  try {
    const { data: redevs } = await sb.from('redevelopment_projects')
      .select('id, district_name, region, sigungu, address, total_households, constructor, developer, stage, nearest_station, nearest_school, latitude, longitude')
      .eq('is_active', true).not('district_name', 'is', null).limit(300);

    const validRedevs = (redevs || []).filter(r => r.district_name && r.district_name.trim().length >= 3);
    if (validRedevs.length > 0) {
      const slugs = validRedevs.map(r => makeSlug(r.district_name!));
      // 한 번에 기존 데이터 조회
      const { data: existingSites } = await sb.from('apt_sites')
        .select('id, slug, source_ids').in('slug', slugs);
      const existingMap = new Map((existingSites || []).map(s => [s.slug, s]));

      const newRows: any[] = [];
      const updateOps: Array<() => Promise<void>> = [];

      for (const r of validRedevs) {
        const slug = makeSlug(r.district_name!);
        if (!slug) continue;
        const existing = existingMap.get(slug);

        if (existing) {
          const srcIds = (existing.source_ids || {}) as Record<string, string>;
          updateOps.push(() =>
            sb.from('apt_sites').update({
              source_ids: { ...srcIds, redev_id: String(r.id), redev_stage: r.stage },
              latitude: r.latitude || undefined, longitude: r.longitude || undefined,
              updated_at: new Date().toISOString(),
            }).eq('id', existing.id) as unknown as Promise<void>
          );
          updated++;
        } else {
          newRows.push({
            slug, name: r.district_name!.trim(), site_type: 'redevelopment',
            region: r.region, sigungu: r.sigungu, address: r.address,
            total_units: r.total_households, builder: r.constructor, developer: r.developer,
            status: 'active', source_ids: { redev_id: String(r.id), redev_stage: r.stage },
            nearby_station: r.nearest_station, school_district: r.nearest_school,
            latitude: r.latitude, longitude: r.longitude,
            sitemap_wave: 1, key_features: r.stage ? [r.stage] : [],
          });
        }
      }

      // 배치 삽입 (50건씩)
      for (let i = 0; i < newRows.length; i += 50) {
        const { error } = await sb.from('apt_sites').upsert(newRows.slice(i, i + 50), { onConflict: 'slug', ignoreDuplicates: true });
        if (error) console.error('[sync-apt-sites] insert fail', error.message?.slice(0, 200));
        else inserted += Math.min(50, newRows.length - i);
      }
      // 업데이트는 10건씩 병렬
      for (let i = 0; i < updateOps.length; i += 10) {
        await Promise.allSettled(updateOps.slice(i, i + 10).map(fn => fn()));
      }
    }
  } catch (e: unknown) { errors.push(`redev: ${errMsg(e)}`); }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 3: 실거래(apt_transactions) → apt_sites (NEW)
  // 고유 단지명 기준으로 집계 후 신규만 삽입
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let tradeInserted = 0;
  try {
    // 실거래에서 고유 단지별 집계 (apt_sites에 없는 것만)
    const { data: trades } = await sb.rpc('get_trade_sites_for_sync') as { data: Record<string, any>[] | null };

    // RPC 없으면 직접 쿼리 (초기 1회는 직접)
    if (!trades) {
      // 실거래에서 이미 apt_sites에 있는 이름 목록 가져오기
      const { data: existingNames } = await sb.from('apt_sites')
        .select('name').limit(10000);
      const nameSet = new Set((existingNames || []).map((n: Record<string, any>) => n.name));

      // 실거래 고유 단지 집계
      const { data: rawTrades } = await sb
        .from('apt_transactions')
        .select('apt_name, region_nm, sigungu, built_year, deal_amount, exclusive_area, deal_date, total_households, latitude, longitude, nearest_station')
        .not('apt_name', 'is', null)
        .order('deal_date', { ascending: false })
        .limit(10000);

      // 단지별 집계
      const tradeMap = new Map<string, any>();
      for (const t of (rawTrades || [])) {
        const name = t.apt_name?.trim();
        if (!name || name.length < 3 || nameSet.has(name)) continue;
        if (!tradeMap.has(name)) {
          tradeMap.set(name, {
            name, region: t.region_nm, sigungu: t.sigungu,
            built_year: t.built_year, total_households: t.total_households,
            latitude: t.latitude, longitude: t.longitude,
            nearest_station: t.nearest_station,
            prices: [], areas: [], latest_date: t.deal_date, count: 0,
          });
        }
        const m = tradeMap.get(name)!;
        m.count++;
        if (t.deal_amount) m.prices.push(t.deal_amount);
        if (t.exclusive_area) m.areas.push(parseFloat(String(t.exclusive_area)));
        if (t.deal_date && t.deal_date > m.latest_date) m.latest_date = t.deal_date;
      }

      // 배치 삽입 (500건씩)
      const entries = [...tradeMap.values()];
      for (let i = 0; i < entries.length; i += 50) {
        const batch = entries.slice(i, i + 50);
        const rows = batch.map(t => {
          const slug = makeSlug(t.name);
          const prices = t.prices.sort((a: number, b: number) => a - b);
          const areas = t.areas.sort((a: number, b: number) => a - b);
          return {
            slug, name: t.name, site_type: 'trade' as const,
            region: t.region, sigungu: t.sigungu,
            total_units: t.total_households || null,
            price_min: prices.length > 0 ? prices[0] : null,
            price_max: prices.length > 0 ? prices[prices.length - 1] : null,
            latitude: t.latitude || null, longitude: t.longitude || null,
            nearby_station: t.nearest_station || null,
            status: 'active' as const,
            source_ids: {
              trade_count: String(t.count),
              built_year: t.built_year ? String(t.built_year) : null,
              latest_trade: t.latest_date,
              area_min: areas.length > 0 ? String(Math.round(areas[0])) : null,
              area_max: areas.length > 0 ? String(Math.round(areas[areas.length - 1])) : null,
            },
            sitemap_wave: 2,
            is_active: true,
            updated_at: new Date().toISOString(),
          };
        }).filter(r => r.slug);

        // upsert — slug 중복 시 업데이트
        const { error } = await sb.from('apt_sites').upsert(rows, {
          onConflict: 'slug', ignoreDuplicates: true,
        });
        if (error) console.error('[sync-apt-sites] insert fail', error.message?.slice(0, 200));
        if (!error) tradeInserted += rows.length;
        else errors.push(`trade-batch-${i}: ${error.message}`);
      }
    }
    inserted += tradeInserted;
  } catch (e: unknown) { errors.push(`trade: ${errMsg(e)}`); }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 4: 미분양 개별 단지(unsold_apts) → apt_sites (배치 최적화)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let unsoldInserted = 0;
  try {
    const { data: unsolds } = await sb.from('unsold_apts')
      .select('id, house_nm, region_nm, sigungu_nm, supply_addr, tot_unsold_hshld_co, tot_supply_hshld_co, sale_price_min, sale_price_max, completion_ym, constructor_nm, developer_nm, latitude, longitude, nearest_station, discount_info, key_features')
      .not('house_nm', 'is', null)
      .limit(500);

    const validUnsolds = (unsolds || []).filter(u => u.house_nm && u.house_nm.trim().length >= 3);
    if (validUnsolds.length > 0) {
      const slugs = validUnsolds.map(u => makeSlug(u.house_nm!));
      // 한 번에 기존 데이터 조회
      const { data: existingSites } = await sb.from('apt_sites')
        .select('id, slug, source_ids, site_type').in('slug', slugs);
      const existingMap = new Map((existingSites || []).map(s => [s.slug, s]));

      const newRows: any[] = [];
      const updateOps: Array<() => Promise<void>> = [];

      for (const u of validUnsolds) {
        const slug = makeSlug(u.house_nm!);
        if (!slug) continue;
        const existing = existingMap.get(slug);

        if (existing) {
          const srcIds = (existing.source_ids || {}) as Record<string, string>;
          updateOps.push(() =>
            sb.from('apt_sites').update({
              source_ids: { ...srcIds, unsold_id: String(u.id), unsold_count: String(u.tot_unsold_hshld_co || 0) },
              price_min: u.sale_price_min || undefined,
              price_max: u.sale_price_max || undefined,
              total_units: u.tot_supply_hshld_co || undefined,
              sigungu: u.sigungu_nm || undefined,
              builder: u.constructor_nm || undefined,
              developer: u.developer_nm || undefined,
              latitude: u.latitude || undefined,
              longitude: u.longitude || undefined,
              nearby_station: u.nearest_station || undefined,
              updated_at: new Date().toISOString(),
            }).eq('id', existing.id) as unknown as Promise<void>
          );
          updated++;
        } else {
          newRows.push({
            slug, name: u.house_nm!.trim(), site_type: 'unsold',
            region: u.region_nm, sigungu: u.sigungu_nm, address: u.supply_addr,
            total_units: u.tot_supply_hshld_co || null,
            price_min: u.sale_price_min || null, price_max: u.sale_price_max || null,
            builder: u.constructor_nm, developer: u.developer_nm,
            latitude: u.latitude, longitude: u.longitude,
            nearby_station: u.nearest_station, status: 'active',
            source_ids: { unsold_id: String(u.id), unsold_count: String(u.tot_unsold_hshld_co || 0) },
            move_in_date: u.completion_ym,
            key_features: u.key_features || (u.discount_info ? [u.discount_info] : []),
            sitemap_wave: 1, is_active: true,
          });
        }
      }

      // 배치 삽입
      for (let i = 0; i < newRows.length; i += 50) {
        const { error } = await sb.from('apt_sites').upsert(newRows.slice(i, i + 50), { onConflict: 'slug', ignoreDuplicates: true });
        if (error) console.error('[sync-apt-sites] insert fail', error.message?.slice(0, 200));
        else unsoldInserted += Math.min(50, newRows.length - i);
      }
      // 업데이트 10건씩 병렬
      for (let i = 0; i < updateOps.length; i += 10) {
        await Promise.allSettled(updateOps.slice(i, i + 10).map(fn => fn()));
      }
    }
    inserted += unsoldInserted;
  } catch (e: unknown) { errors.push(`unsold: ${errMsg(e)}`); }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 5: content_score 재계산 (배치)
  // trade 타입에 맞는 점수 체계 추가
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  try {
    try { await sb.rpc('refresh_all_site_scores'); } catch {}

    // hero_image_url 은 DB 에는 있으나 생성된 database.ts 에 아직 없다 — 저장소 관행대로 캐스팅.
    const { data: allSites } = await (sb as any).from('apt_sites')
      .select('id, name, site_type, region, sigungu, total_units, price_min, price_max, source_ids, description, faq_items, images, hero_image_url, satellite_image_url, latitude, longitude, nearby_station, builder, developer, move_in_date, address, key_features')
      .limit(10000);

    const scoreGroups = new Map<number, string[]>();
    for (const s of (allSites || [])) {
      let score = 0;
      // 기본 정보 (최대 30)
      if (s.name && s.name.length >= 3) score += 10;
      if (s.region && s.sigungu) score += 10;
      else if (s.region) score += 5;
      if (s.total_units && s.total_units > 0) score += 10;

      // 가격 (최대 5)
      if (s.price_min || s.price_max) score += 5;

      // 데이터 소스 (최대 31)
      const src = (s.source_ids || {}) as Record<string, string>;
      if (src.subscription_id) score += 10;
      if (src.redev_id) score += 15;
      if (src.trade_count) {
        const tc = parseInt(src.trade_count) || 0;
        score += 10;
        if (tc >= 10) score += 5;
        if (tc >= 30) score += 3;
      }
      if (src.unsold_id) score += 8;

      // 콘텐츠 풍부도 (최대 28)
      if (s.description && s.description.length >= 100) score += 10;
      if (s.description && s.description.length >= 200) score += 3;
      if (s.faq_items && Array.isArray(s.faq_items) && s.faq_items.length >= 3) score += 10;
      if (s.faq_items && Array.isArray(s.faq_items) && s.faq_items.length >= 5) score += 3;
      if (s.key_features && Array.isArray(s.key_features) && s.key_features.length >= 2) score += 2;

      // 미디어 (최대 5)
      // s7-2: 기준이 images 였는데 그 배열은 뉴스 스크랩이라 화면에서 뺐다.
      // 그대로 두면 "화면에 없는 이미지로 점수를 받는" 상태가 되므로 실제 표시되는
      // 자체 호스팅 이미지로 옮긴다. sitemap 편입선(25) 교차는 양방향 0건으로 실측 확인.
      if (s.hero_image_url || s.satellite_image_url) score += 5;

      // 위치 (최대 13)
      if (s.latitude && s.longitude) score += 5;
      if (s.nearby_station) score += 5;
      if (s.address && s.address.length > 5) score += 3;

      // 부가 정보 (최대 11)
      if (s.builder) score += 3;
      if (src.built_year) score += 3;
      if (s.developer) score += 2;
      if (s.move_in_date) score += 3;

      const ids = scoreGroups.get(score) || [];
      ids.push(s.id);
      scoreGroups.set(score, ids);
    }

    for (const [score, ids] of scoreGroups) {
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        await sb.from('apt_sites').update({ content_score: score }).in('id', chunk);
        scored += chunk.length;
      }
    }
  } catch (e: unknown) { errors.push(`score: ${errMsg(e)}`); }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 6: sitemap_wave 활성화 (score >= 25)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  try {
    await sb.from('apt_sites')
      .update({ sitemap_wave: 1 })
      .gte('content_score', 25)
      .eq('sitemap_wave', 0);
  } catch {}

  const elapsed = Date.now() - start;

  return NextResponse.json({
    success: true,
    inserted,
    updated,
    scored,
    tradeInserted,
    unsoldInserted,
    elapsed: `${elapsed}ms`,
    errors: errors.length ? errors : undefined,
  });
}

export const GET = withCronAuth(handler);
