import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

async function handler(req: NextRequest) {
  const start = Date.now();
  const sb = getSupabaseAdmin();
  let inserted = 0;
  let updated = 0;
  let errors: string[] = [];

  // ━━━ Step 1: 신규 청약 → apt_sites ━━━
  try {
    const { data: newSubs } = await sb.from('apt_subscriptions')
      .select('id, house_nm, house_manage_no, region_nm, supply_addr, tot_supply_hshld_co, mvn_prearnge_ym, constructor_nm, developer_nm, rcept_bgnde, nearest_station, nearest_school')
      .not('house_nm', 'is', null)
      .order('id', { ascending: false }).limit(500);

    for (const s of (newSubs || [])) {
      if (!s.house_nm || s.house_nm.trim().length < 3) continue;
      const slug = s.house_nm.trim().replace(/\s+/g, '-').replace(/[^\w가-힣\-]/g, '').toLowerCase();
      if (!slug) continue;

      const sigungu = s.supply_addr
        ? (s.supply_addr.match(/(?:시|도)\s+(\S+구|\S+시|\S+군)/)?.[1] || null)
        : null;

      const { error } = await (sb as any).from('apt_sites').upsert({
        slug,
        name: s.house_nm.trim(),
        site_type: 'subscription',
        region: s.region_nm,
        sigungu,
        address: s.supply_addr,
        total_units: s.tot_supply_hshld_co || null,
        move_in_date: s.mvn_prearnge_ym,
        builder: s.constructor_nm,
        developer: s.developer_nm,
        source_ids: { subscription_id: String(s.id), house_manage_no: s.house_manage_no },
        nearby_station: s.nearest_station,
        school_district: s.nearest_school,
        status: s.rcept_bgnde && s.rcept_bgnde >= '2026-01-01' ? 'active' : 'closed',
        sitemap_wave: s.rcept_bgnde && s.rcept_bgnde >= '2026-01-01' ? 1 : 2,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'slug', ignoreDuplicates: false });

      if (!error) inserted++;
    }
  } catch (e: any) { errors.push(`sub: ${e.message}`); }

  // ━━━ Step 2: 신규 재개발 → apt_sites ━━━
  try {
    const { data: newRedev } = await sb.from('redevelopment_projects')
      .select('id, district_name, region, sigungu, address, total_households, constructor, developer, stage, nearest_station, nearest_school, latitude, longitude')
      .eq('is_active', true).not('district_name', 'is', null).limit(300);

    for (const r of (newRedev || [])) {
      if (!r.district_name || r.district_name.trim().length < 3) continue;
      const slug = r.district_name.trim().replace(/\s+/g, '-').replace(/[^\w가-힣\-]/g, '').toLowerCase();
      if (!slug) continue;

      const { data: existing } = await (sb as any).from('apt_sites').select('id, source_ids').eq('slug', slug).maybeSingle();

      if (existing) {
        const srcIds = (existing.source_ids || {}) as Record<string, string>;
        await (sb as any).from('apt_sites').update({
          source_ids: { ...srcIds, redev_id: String(r.id), redev_stage: r.stage },
          latitude: r.latitude || undefined,
          longitude: r.longitude || undefined,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        updated++;
      } else {
        await (sb as any).from('apt_sites').insert({
          slug,
          name: r.district_name.trim(),
          site_type: 'redevelopment',
          region: r.region,
          sigungu: r.sigungu,
          address: r.address,
          total_units: r.total_households,
          builder: r.constructor,
          developer: r.developer,
          status: 'active',
          source_ids: { redev_id: String(r.id), redev_stage: r.stage },
          nearby_station: r.nearest_station,
          school_district: r.nearest_school,
          latitude: r.latitude,
          longitude: r.longitude,
          sitemap_wave: 1,
          key_features: r.stage ? [r.stage] : [],
        });
        inserted++;
      }
    }
  } catch (e: any) { errors.push(`redev: ${e.message}`); }

  // ━━━ Step 3: content_score 재계산 (전체) ━━━
  try {
    try { await (sb as any).rpc('refresh_all_site_scores'); } catch {}

    // 직접 점수 계산
    const { data: allSites } = await (sb as any).from('apt_sites')
      .select('id, name, region, sigungu, total_units, price_min, price_max, source_ids, description, faq_items, images, latitude, longitude, nearby_station, builder')
      .limit(5000);

    for (const s of (allSites || [])) {
      let score = 0;
      if (s.name && s.name.length >= 3) score += 10;
      if (s.region && s.sigungu) score += 10;
      else if (s.region) score += 5;
      if (s.total_units && s.total_units > 0) score += 10;
      if (s.price_min || s.price_max) score += 5;
      const src = (s.source_ids || {}) as Record<string, string>;
      if (src.subscription_id) score += 10;
      if (src.redev_id) score += 15;
      if (s.description && s.description.length >= 100) score += 10;
      if (s.faq_items && Array.isArray(s.faq_items) && s.faq_items.length >= 3) score += 10;
      if (s.images && Array.isArray(s.images) && s.images.length >= 1) score += 5;
      if (s.latitude && s.longitude) score += 5;
      if (s.nearby_station) score += 5;
      if (s.builder) score += 3;

      await (sb as any).from('apt_sites').update({ content_score: score }).eq('id', s.id);
    }
  } catch (e: any) { errors.push(`score: ${e.message}`); }

  // ━━━ Step 4: Wave 1 활성화 (score >= 40) ━━━
  try {
    await (sb as any).from('apt_sites')
      .update({ sitemap_wave: 1 })
      .gte('content_score', 40)
      .eq('sitemap_wave', 0);
  } catch {}

  const elapsed = Date.now() - start;

  return NextResponse.json({
    success: true,
    inserted,
    updated,
    elapsed: `${elapsed}ms`,
    errors: errors.length ? errors : undefined,
  });
}

export const GET = withCronAuth(handler);
