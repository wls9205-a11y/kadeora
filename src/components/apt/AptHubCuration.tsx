import React from 'react';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const LIFECYCLE_LABEL: Record<string, string> = {
  site_planning: '부지계획',
  pre_announcement: '분양 예고',
  model_house_open: '모델하우스 오픈',
  special_supply: '특별공급',
  subscription_open: '청약 진행',
  contract: '계약',
  construction: '시공',
  pre_move_in: '입주 예정',
  move_in: '입주',
  resale: '실거래',
};

const SITE_TYPE_LABEL: Record<string, string> = {
  subscription: '분양',
  redevelopment: '재개발',
  unsold: '미분양',
  trade: '실거래',
  landmark: '랜드마크',
  complex: '단지',
};

interface TodayPickRow {
  slug: string; name: string; site_type?: string | null; lifecycle_stage?: string | null;
  region?: string | null; sigungu?: string | null; dong?: string | null; popularity_score?: number | null;
  total_units?: number | null; builder?: string | null; rank?: number | null;
}
interface ImminentRow {
  slug: string; site_name: string; region?: string | null; sigungu?: string | null;
  rcept_bgnde?: string | null; days_until_apply?: number | null;
}
interface ModelHouseRow {
  slug: string; name: string; region?: string | null; sigungu?: string | null;
  builder?: string | null; total_units?: number | null;
}
interface HotByRegionRow {
  region: string; site_type: string; slug: string; name: string;
  sigungu?: string | null; popularity_score?: number | null; total_units?: number | null;
  rank?: number | null;
}
interface BuilderRow {
  builder: string; site_count: number; upcoming_count?: number | null;
}
interface RegionHubRow { region: string; cnt: number; }

const sectionTitleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const cardeoraBadgeStyle: React.CSSProperties = { fontSize: 9, fontWeight: 800, color: 'var(--kd-accent)', padding: '2px 8px', borderRadius: 999, background: 'var(--kd-accent-soft)', border: '1px solid var(--kd-accent-border)', letterSpacing: 0.5 };
const sectionMargin: React.CSSProperties = { margin: '0 0 18px' };

export default async function AptHubCuration() {
  let todayPicks: TodayPickRow[] = [];
  let imminent: ImminentRow[] = [];
  let modelHouses: ModelHouseRow[] = [];
  let hotByRegion: HotByRegionRow[] = [];
  let builders: BuilderRow[] = [];
  let regionHubsRaw: RegionHubRow[] = [];
  try {
    const sb = getSupabaseAdmin();
    const [todayRes, imminentRes, modelRes, hotRes, buildersRes, regionHubsRes] = await Promise.all([
      (sb as any).from('v_apt_today_pick')
        .select('slug,name,site_type,lifecycle_stage,region,sigungu,dong,popularity_score,total_units,builder,rank')
        .order('rank', { ascending: true }).limit(10),
      (sb as any).from('v_apt_subscription_imminent')
        .select('slug,site_name,region,sigungu,rcept_bgnde,days_until_apply')
        .order('days_until_apply', { ascending: true }).limit(10),
      (sb as any).from('v_apt_model_house_opening')
        .select('slug,name,region,sigungu,builder,total_units')
        .limit(10),
      (sb as any).from('v_apt_hot_by_region')
        .select('region,site_type,slug,name,sigungu,popularity_score,total_units,rank')
        .lte('rank', 5)
        .order('region', { ascending: true })
        .order('rank', { ascending: true })
        .limit(170),
      (sb as any).from('v_apt_by_builder')
        .select('builder,site_count,upcoming_count')
        .order('site_count', { ascending: false }).limit(10),
      (sb as any).from('v_apt_region_hubs')
        .select('region,cnt'),
    ]);
    todayPicks = ((todayRes as any)?.data ?? []) as TodayPickRow[];
    imminent = ((imminentRes as any)?.data ?? []) as ImminentRow[];
    modelHouses = ((modelRes as any)?.data ?? []) as ModelHouseRow[];
    hotByRegion = ((hotRes as any)?.data ?? []) as HotByRegionRow[];
    builders = ((buildersRes as any)?.data ?? []) as BuilderRow[];
    regionHubsRaw = ((regionHubsRes as any)?.data ?? []) as RegionHubRow[];
  } catch (err) {
    console.error('[AptHubCuration]', err);
    // fail-safe: 모든 섹션 빈 상태로 nav만 노출
  }

  // 시도별 카운트 합산
  const regionCount = new Map<string, number>();
  for (const r of regionHubsRaw) {
    if (!r.region) continue;
    regionCount.set(r.region, (regionCount.get(r.region) || 0) + (Number(r.cnt) || 0));
  }
  const regionTop = Array.from(regionCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 7);

  // 시도별 hot 그룹화
  const hotGroups = new Map<string, HotByRegionRow[]>();
  for (const r of hotByRegion) {
    if (!r.region || !r.slug) continue;
    if (!hotGroups.has(r.region)) hotGroups.set(r.region, []);
    hotGroups.get(r.region)!.push(r);
  }
  const hotGroupsArr = Array.from(hotGroups.entries())
    .sort((a, b) => (regionCount.get(b[0]) ?? 0) - (regionCount.get(a[0]) ?? 0));

  function shortBuilder(name: string): string {
    return name.replace(/\(주\)|주식회사|\s+/g, '').slice(0, 12);
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '4px var(--sp-lg) 0' }}>
      {/* 좌측 nav 대신 상단 분류 pill bar (모바일 가로 스크롤) */}
      <nav aria-label="목적별 카테고리" style={{ ...sectionMargin, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', padding: '4px 0' }} className="apt-hub-nav">
        {[
          { href: '/apt?tab=subscription', label: '분양 진행', emoji: '🏗️' },
          { href: '/apt?tab=imminent', label: `분양 임박 ${imminent.length > 0 ? `D-${imminent[0]?.days_until_apply ?? '7'}` : 'D-7'}`, emoji: '⏰' },
          { href: '/apt?tab=model', label: '모델하우스', emoji: '🏠' },
          { href: '/apt?tab=unsold', label: '미분양·줍줍', emoji: '⚠️' },
          { href: '/apt?tab=redev', label: '재건축·재개발', emoji: '🏗️' },
          { href: '/apt?tab=trade', label: '실거래·시세', emoji: '📊' },
        ].map(t => (
          <Link key={t.href} href={t.href} style={{ flex: '0 0 auto', padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, textDecoration: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {t.emoji} {t.label}
          </Link>
        ))}
        <style>{`.apt-hub-nav::-webkit-scrollbar { display: none; }`}</style>
      </nav>

      {/* 섹션 1: 오늘의 추천 */}
      {todayPicks.length > 0 && (
        <section style={sectionMargin} aria-label="오늘의 추천 단지">
          <h2 style={sectionTitleStyle}>
            <span>★ 오늘의 추천</span>
            <span style={cardeoraBadgeStyle}>CARDERA</span>
          </h2>
          <div className="apt-hub-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
            {todayPicks.map(p => (
              <Link key={p.slug} href={`/apt/${encodeURIComponent(p.slug)}`} style={{ flex: '0 0 auto', width: 180, scrollSnapAlign: 'start', textDecoration: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)' }}>
                  <span style={{ color: 'var(--kd-accent)' }}>#{p.rank ?? '—'}</span>
                  {p.site_type && <span>{SITE_TYPE_LABEL[p.site_type] || p.site_type}</span>}
                  {p.popularity_score != null && p.popularity_score !== 100 && <span>· ★ {p.popularity_score}</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  {[p.region, p.sigungu, p.dong].filter(Boolean).join(' ')}
                </div>
                {p.lifecycle_stage && (
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--kd-accent)' }}>{LIFECYCLE_LABEL[p.lifecycle_stage] || p.lifecycle_stage}</div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 섹션 2: 분양 임박 D-7 */}
      {imminent.length > 0 && (
        <section style={sectionMargin} aria-label="분양 임박">
          <h2 style={sectionTitleStyle}>
            <span>⏰ 분양 임박 D-7</span>
            <Link href="/apt?tab=imminent" style={{ fontSize: 10, color: 'var(--text-tertiary)', textDecoration: 'none', fontWeight: 700 }}>전체 →</Link>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {imminent.slice(0, 6).map(s => {
              const days = s.days_until_apply ?? 0;
              const dColor = days <= 3 ? '#791F1F' : days <= 7 ? '#BA7517' : 'var(--text-tertiary)';
              return (
                <Link key={s.slug} href={`/apt/${encodeURIComponent(s.slug)}`} style={{ textDecoration: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flexShrink: 0, fontSize: 22, fontWeight: 900, color: dColor, width: 56, textAlign: 'center' }}>
                    D-{days}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.site_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginTop: 2 }}>
                      {[s.region, s.sigungu].filter(Boolean).join(' ')} · {s.rcept_bgnde}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 섹션 3: 모델하우스 오픈 */}
      {modelHouses.length > 0 && (
        <section style={sectionMargin} aria-label="모델하우스 오픈">
          <h2 style={sectionTitleStyle}>
            <span>🏠 모델하우스 오픈</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 999, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>방문 가능 {modelHouses.length}곳</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {modelHouses.slice(0, 6).map(m => (
              <Link key={m.slug} href={`/apt/${encodeURIComponent(m.slug)}`} style={{ textDecoration: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  {[m.region, m.sigungu].filter(Boolean).join(' ')}
                  {m.builder && ` · ${m.builder}`}
                </div>
                <div style={{ marginTop: 4, fontSize: 9, fontWeight: 800, color: 'var(--kd-accent)', padding: '2px 8px', borderRadius: 999, background: 'var(--kd-accent-soft)', border: '1px solid var(--kd-accent-border)', alignSelf: 'flex-start' }}>방문 가능</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 섹션 4: 시도별 hot */}
      {hotGroupsArr.length > 0 && (
        <section style={sectionMargin} aria-label="시도별 인기">
          <h2 style={sectionTitleStyle}>
            <span>🔥 시도별 hot</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)' }}>{hotGroupsArr.length}개 시도</span>
          </h2>
          <div className="apt-hub-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
            {hotGroupsArr.slice(0, 12).map(([region, sites]) => (
              <div key={region} style={{ flex: '0 0 auto', width: 200, scrollSnapAlign: 'start', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Link href={`/apt/region/${encodeURIComponent(region)}`} style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {region}
                  </Link>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 700 }}>top {sites.length}</span>
                </div>
                <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sites.slice(0, 5).map(s => (
                    <li key={s.slug}>
                      <Link href={`/apt/${encodeURIComponent(s.slug)}`} style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 11 }}>
                        <span style={{ color: 'var(--kd-accent)', fontWeight: 800, width: 14 }}>{s.rank}</span>
                        <span style={{ flex: 1, color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <Link href={`/apt/ranking/${encodeURIComponent(region)}/landmark`} style={{ display: 'block', marginTop: 8, fontSize: 10, fontWeight: 700, color: 'var(--kd-accent)', textDecoration: 'none' }}>
                  ranking TOP 30 →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 시공사 brand */}
      {builders.length > 0 && (
        <section style={sectionMargin} aria-label="주요 시공사">
          <h2 style={sectionTitleStyle}>
            <span>🏗️ 시공사 brand</span>
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 700 }}>top {builders.length}</span>
          </h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {builders.map(b => (
              <Link key={b.builder} href={`/apt/builder/${encodeURIComponent(b.builder)}`} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, textDecoration: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {shortBuilder(b.builder)} <span style={{ color: 'var(--kd-accent)', fontWeight: 800 }}>({b.site_count})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 시도 카운트 nav (regionHubs 합산) */}
      {regionTop.length > 0 && (
        <section style={sectionMargin} aria-label="시도별 단지">
          <h2 style={sectionTitleStyle}>
            <span>📍 시도별 단지</span>
            <Link href="/apt/region" style={{ fontSize: 10, color: 'var(--text-tertiary)', textDecoration: 'none', fontWeight: 700 }}>전체 →</Link>
          </h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {regionTop.map(([r, c]) => (
              <Link key={r} href={`/apt/region/${encodeURIComponent(r)}`} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, textDecoration: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {r} <span style={{ color: 'var(--kd-accent)', fontWeight: 800 }}>({c.toLocaleString()})</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <style>{`.apt-hub-scroll::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
