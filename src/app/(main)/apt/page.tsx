// s262 Phase C — Issue Engine v1 /apt (legacy: src/_legacy/s262/apt_page_v0.tsx)
// 5 블록: 정책알림 + 마감임박 + 신규공고24h + 미분양핫 + 재개발단계변경 + 도구 4개
// DDayAlertCTA 마감임박 블록 끝에 노출 (비로그인 only).
// s262 Phase E (CAROUSEL v1): NEXT_PUBLIC_CAROUSEL_ENABLED 시 각 블록을 AptHScroll wrap.
// s264-b: 미분양 v_apt_card_unsold view + region_nm eq.
// s265-b: cascade fallback RPC + EmptyState + 통합 carousel.
import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import RegionAutoSelect from '@/components/apt/RegionAutoSelect';
import AptIssueCard from '@/components/cards/AptIssueCard';
import AptThumbnailCard from '@/components/cards/v2/AptThumbnailCard';
import AptHScroll from '@/components/carousel/AptHScroll';
import DDayAlertCTA from '@/components/cta/DDayAlertCTA';
import EmptyState from '@/components/ui/EmptyState';
import { TierBadge, headerForTier, type CascadeTier } from '@/components/cards/v2/TierBadge';
import type { AptIssueScore } from '@/lib/issue/types';

export const revalidate = 60;
export const maxDuration = 10;

const CAROUSEL_ENABLED = process.env.NEXT_PUBLIC_CAROUSEL_ENABLED === 'true';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ region?: string }> }): Promise<Metadata> {
  const sp = await searchParams;
  const regionLabel = sp.region ?? '전국';
  const baseTitle = sp.region ? `${regionLabel} 부동산 — 청약·미분양·재개발` : '아파트 청약·미분양·재개발';
  return {
    title: baseTitle,
    description: `${regionLabel} 청약 마감임박, 신규 공고, 미분양 핫딜, 재개발 단계 변경을 한 화면에. 카더라 이슈 엔진 v1.`,
    alternates: { canonical: sp.region ? `${SITE_URL}/apt?region=${encodeURIComponent(sp.region)}` : `${SITE_URL}/apt` },
    openGraph: {
      title: baseTitle, siteName: '카더라', locale: 'ko_KR', type: 'website',
      url: `${SITE_URL}/apt`,
    },
  };
}

type Sub = {
  id: number;
  house_nm: string;
  region_nm: string | null;
  mdatrgbn_nm: string | null;
  rcept_endde: string | null;
  created_at: string | null;
  is_regulated_area: boolean | null;
  is_speculative_zone: boolean | null;
};

// s264-b P0-2: v_apt_card_unsold view 정규화 컬럼.
type UnsoldRow = {
  id: number;
  name: string;
  region: string | null;
  households: number | null;
  supply_min: number | null;
  cover_image_url: string | null;
  region_nm: string | null;
  sigungu_nm: string | null;
};

type RedevRow = {
  id: number;
  district_name: string;
  region: string | null;
  sigungu: string | null;
  stage: string | null;
  previous_stage: string | null;
  last_stage_change: string | null;
  thumbnail_url: string | null;
  tier?: CascadeTier;
};

// s265-b: cascade RPC 응답 — AptIssueScore 위에 tier 추가.
type ImminentRow = AptIssueScore & { tier?: CascadeTier };
type FreshRow = Sub & { tier?: CascadeTier };

// s265-b: 통합 carousel — section 별 색 chip + 단지명 + 메타.
type UnifiedItem = {
  section: 'unsold' | 'imminent' | 'redev' | 'fresh' | 'score';
  id: number | string;
  title: string;
  meta?: string | null;
  href?: string | null;
};

const SECTION_STYLE: Record<UnifiedItem['section'], { bg: string; fg: string; label: string }> = {
  unsold:    { bg: '#FEF3C7', fg: '#92400E', label: '미분양' },
  imminent:  { bg: '#FEF3C7', fg: '#92400E', label: '청약' },
  redev:     { bg: '#DCFCE7', fg: '#166534', label: '재개발' },
  fresh:     { bg: '#DBEAFE', fg: '#1E40AF', label: '신규' },
  score:     { bg: '#EDE9FE', fg: '#5B21B6', label: '점수' },
};

function topTier<T extends { tier?: CascadeTier }>(rows: T[]): CascadeTier {
  return (rows[0]?.tier ?? 'L1') as CascadeTier;
}

async function fetchBlocks(region: string) {
  const sb = getSupabaseAdmin();
  const isAll = region === '전국';

  const [unifiedRes, imminentRes, freshRes, regulatedRes, unsoldRes, redevRes] = await Promise.all([
    // s265-b: 통합 carousel (cross-section 5장)
    (sb as any).rpc('get_apt_unified_carousel', { p_region: region }),
    // s265-b: cascade RPC (L1 region → L2 D-30 → L3 인접 → L4 전국)
    (sb as any).rpc('get_apt_imminent_cascade', { p_region: region, p_limit: 5 }),
    (sb as any).rpc('get_apt_fresh_cascade',    { p_region: region, p_limit: 5 }),
    // 정책 알림: 규제/투기 지역 (region 매칭 strict, 0건이면 섹션 hide)
    (sb as any).from('apt_subscriptions')
      .select('id, house_nm, region_nm, mdatrgbn_nm, rcept_endde, created_at, is_regulated_area, is_speculative_zone')
      .or('is_regulated_area.eq.true,is_speculative_zone.eq.true')
      .gte('rcept_endde', new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10))
      .order('rcept_endde', { ascending: true }).limit(3),
    // 미분양 핫 — s264-b view + region eq.
    (() => {
      let q = (sb as any).from('v_apt_card_unsold')
        .select('id, name, region, households, supply_min, cover_image_url, region_nm, sigungu_nm')
        .order('households', { ascending: false, nullsFirst: false })
        .limit(5);
      if (!isAll) q = q.eq('region_nm', region);
      return q;
    })(),
    // s265-b: 재개발 cascade
    (sb as any).rpc('get_apt_redev_cascade', { p_region: region, p_limit: 5 }),
  ]);

  // RPC 응답: data 가 jsonb 배열 또는 array<object>. 둘 다 대응.
  const asArray = <T,>(x: unknown): T[] => {
    if (Array.isArray(x)) return x as T[];
    if (x && typeof x === 'object' && Array.isArray((x as { items?: unknown[] }).items)) {
      return (x as { items: T[] }).items;
    }
    return [];
  };

  const filterRegion = <T extends { region_nm?: string | null; region?: string | null }>(rows: T[]): T[] => {
    if (isAll) return rows;
    return rows.filter((r) => (r.region_nm ?? r.region ?? '').includes(region));
  };

  return {
    unified:    asArray<UnifiedItem>(unifiedRes?.data ?? []),
    imminent:   asArray<ImminentRow>(imminentRes?.data ?? []),
    fresh:      asArray<FreshRow>(freshRes?.data ?? []),
    regulated:  filterRegion((regulatedRes?.data ?? []) as Sub[]),
    unsoldHot:  ((unsoldRes?.data ?? []) as UnsoldRow[]),
    redevStage: asArray<RedevRow>(redevRes?.data ?? []),
  };
}

export default async function AptPage({ searchParams }: { searchParams?: Promise<{ region?: string }> }) {
  const sp = (await searchParams) || {};
  const region = sp.region?.trim() || '전국';
  const isAutoRegion = !sp.region;
  const blocks = await fetchBlocks(region);

  const imminentTier = topTier(blocks.imminent);
  const freshTier    = topTier(blocks.fresh);
  const redevTier    = topTier(blocks.redevStage);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 6px 24px' }}>
      <h1 className="sr-only">{region} 아파트 — 이슈 단지 / 청약 / 미분양 / 재개발</h1>

      {isAutoRegion && <RegionAutoSelect />}

      {/* Sticky region bar */}
      <div
        style={{
          position: 'sticky', top: 44, zIndex: 10,
          padding: '8px 6px', margin: '0 -6px 8px',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #E5E7EB',
          fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span style={{ fontWeight: 700 }}>📍 {region}</span>
        <Link href="/apt/region" style={{ fontSize: 11.5, color: '#6B7280', textDecoration: 'none' }}>
          지역 변경 →
        </Link>
      </div>

      {/* s265-b: 통합 carousel (cross-section 5장) — 페이지 최상단 */}
      {blocks.unified.length > 0 && (
        <section style={{ marginBottom: 14 }}>
          <div style={{ padding: '0 6px 6px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>🎯 오늘의 단지 5</h2>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{region} 핵심 단지 한눈에</div>
          </div>
          <AptHScroll ariaLabel="오늘의 단지">
            {blocks.unified.slice(0, 5).map((u) => {
              const s = SECTION_STYLE[u.section] ?? SECTION_STYLE.score;
              return (
                <Link
                  key={`${u.section}-${u.id}`}
                  href={u.href ?? '/apt'}
                  style={{
                    flex: '0 0 200px',
                    scrollSnapAlign: 'start',
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    textDecoration: 'none',
                    color: '#111827',
                    boxShadow: '0 1px 1px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    <span style={{ background: s.bg, color: s.fg, padding: '1px 6px', borderRadius: 3, fontSize: 10.5, fontWeight: 700 }}>
                      {s.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.title}
                  </div>
                  {u.meta ? (
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.meta}
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </AptHScroll>
        </section>
      )}

      {/* 1. 정책 알림 — 0건 시 섹션 자체 hide (s265-b) */}
      {blocks.regulated.length > 0 && (
        <Block title="🚨 정책 알림" subtitle="규제·투기 지역 청약" href="/apt/subscription?filter=regulated">
          {blocks.regulated.map((s) => (
            <SubRow key={s.id} sub={s} badge={s.is_speculative_zone ? '투기과열' : '조정대상'} />
          ))}
        </Block>
      )}

      {/* 2. 마감 임박 — cascade RPC + TierBadge */}
      <Block title={headerForTier('⏰ 마감 임박 (D-7)', imminentTier)} subtitle="이슈 점수 기준" href="/apt/imminent">
        {blocks.imminent.length === 0 ? (
          <EmptyState icon="⏰" title="마감 임박 청약 없음" description="cascade 폴백에도 결과가 없습니다." cta={{ label: '전국 보기', href: '/apt' }} />
        ) : CAROUSEL_ENABLED ? (
          <AptHScroll ariaLabel="마감 임박 청약">
            {blocks.imminent.map((a, i) => (
              <div key={a.id} style={{ flex: '0 0 auto', position: 'relative' }}>
                <AptThumbnailCard
                  id={a.id}
                  name={a.house_nm}
                  location={a.region_nm}
                  price={a.sale_price_min}
                  households={a.households_count}
                  score={a.score}
                  dday={a.dday}
                  thumbnailUrl={a.thumbnail_url}
                  houseTy={a.house_ty}
                  priority={i < 2}
                />
                {a.tier && a.tier !== 'L1' ? (
                  <span style={{ position: 'absolute', top: 6, right: 6 }}>
                    <TierBadge tier={a.tier} />
                  </span>
                ) : null}
              </div>
            ))}
          </AptHScroll>
        ) : (
          blocks.imminent.map((a) => (
            <div key={a.id} style={{ position: 'relative' }}>
              <AptIssueCard data={a} />
              {a.tier && a.tier !== 'L1' ? (
                <span style={{ position: 'absolute', top: 6, right: 6 }}>
                  <TierBadge tier={a.tier} />
                </span>
              ) : null}
            </div>
          ))
        )}
        <DDayAlertCTA source="apt_dday_alert" redirect="/apt" />
      </Block>

      {/* 3. 신규 공고 — cascade */}
      <Block title={headerForTier('🆕 신규 공고 (24h)', freshTier)} subtitle="공고 등재 24시간 내" href="/apt/subscription?sort=newest">
        {blocks.fresh.length === 0 ? (
          <EmptyState icon="🆕" title="신규 공고 없음" description="cascade 폴백에도 결과가 없습니다." cta={{ label: '전국 보기', href: '/apt' }} />
        ) : (
          blocks.fresh.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 3px' }}>
              <div style={{ flex: 1 }}>
                <SubRow sub={s} />
              </div>
              {s.tier && s.tier !== 'L1' ? <TierBadge tier={s.tier} /> : null}
            </div>
          ))
        )}
      </Block>

      {/* 4. 미분양 핫 (region eq) */}
      <Block title="🔥 미분양 핫" subtitle="잔여 세대 많은 단지" href="/apt/unsold">
        {blocks.unsoldHot.length === 0 ? (
          <EmptyState icon="🔥" title="미분양 데이터 준비 중" description="해당 지역 미분양 단지가 없거나 갱신 대기 중입니다." cta={{ label: '전국 보기', href: '/apt' }} />
        ) : blocks.unsoldHot.map((u) => <UnsoldHotRow key={u.id} u={u} />)}
      </Block>

      {/* 5. 재개발 — cascade */}
      <Block title={headerForTier('🏗️ 재개발 단계 변경', redevTier)} subtitle="최근 단계 변경 단지" href="/apt/redev">
        {blocks.redevStage.length === 0 ? (
          <EmptyState icon="🏗️" title="최근 단계 변경 없음" description="cascade 폴백에도 결과가 없습니다." cta={{ label: '전국 보기', href: '/apt' }} />
        ) : (
          blocks.redevStage.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 3px' }}>
              <div style={{ flex: 1 }}>
                <RedevRowComp r={r} />
              </div>
              {r.tier && r.tier !== 'L1' ? <TierBadge tier={r.tier} /> : null}
            </div>
          ))
        )}
      </Block>

      {/* 도구 4개 */}
      <section style={{ marginTop: 18 }}>
        <div style={{ padding: '0 6px 6px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>🛠️ 부동산 도구</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, padding: '0 3px' }}>
          <ToolCard href="/apt/map" emoji="🗺️" label="부동산 지도" desc="지도로 한눈에" />
          <ToolCard href="/apt/diagnose" emoji="🎯" label="가점 진단" desc="청약 가점 계산" />
          <ToolCard href="/apt/redev" emoji="🏗️" label="재개발 현황" desc="정비사업 추적" />
          <ToolCard href="/apt/unsold-deals" emoji="💰" label="미분양 딜" desc="할인·옵션 정보" />
        </div>
      </section>
    </div>
  );
}

function Block({ title, subtitle, href, children }: { title: string; subtitle?: string; href?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 6px 6px' }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{title}</h2>
          {subtitle ? <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{subtitle}</div> : null}
        </div>
        {href ? (
          <Link href={href} style={{ fontSize: 11.5, color: '#6B7280', textDecoration: 'none' }}>
            전체 →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SubRow({ sub, badge }: { sub: Sub; badge?: string }) {
  const dday = sub.rcept_endde
    ? Math.ceil((new Date(sub.rcept_endde).getTime() - Date.now()) / 86400_000)
    : null;
  return (
    <Link
      href={`/apt/subscription/${sub.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 9px', margin: 3, borderRadius: 6,
        background: '#FFFFFF', border: '1px solid #E5E7EB',
        textDecoration: 'none', color: '#111827',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sub.house_nm}
      </span>
      <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
        {sub.region_nm ?? ''}
      </span>
      {badge ? (
        <span style={{ background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 600 }}>
          {badge}
        </span>
      ) : null}
      {dday != null ? (
        <span style={{ background: dday <= 3 ? '#DC2626' : '#F3F4F6', color: dday <= 3 ? '#FFFFFF' : '#4B5563', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 600 }}>
          {dday < 0 ? '마감' : `D-${dday}`}
        </span>
      ) : null}
    </Link>
  );
}

function UnsoldHotRow({ u }: { u: UnsoldRow }) {
  return (
    <Link
      href={`/apt/unsold/${u.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 9px', margin: 3, borderRadius: 6,
        background: '#FFFFFF', borderLeft: '3px solid #F59E0B',
        boxShadow: '0 1px 1px rgba(0,0,0,0.04)',
        textDecoration: 'none', color: '#111827',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {u.name}
      </span>
      <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
        {u.sigungu_nm ?? u.region_nm ?? u.region ?? ''}
      </span>
      {u.households ? (
        <span style={{ fontSize: 11, color: '#9A3412', fontWeight: 600 }}>잔여 {u.households.toLocaleString()}세대</span>
      ) : null}
    </Link>
  );
}

function RedevRowComp({ r }: { r: RedevRow }) {
  return (
    <Link
      href={`/apt/redev/${r.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 9px', margin: 3, borderRadius: 6,
        background: '#FFFFFF', borderLeft: '3px solid #10B981',
        boxShadow: '0 1px 1px rgba(0,0,0,0.04)',
        textDecoration: 'none', color: '#111827',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.district_name}
      </span>
      <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
        {r.sigungu ?? r.region ?? ''}
      </span>
      {r.previous_stage && r.stage && r.previous_stage !== r.stage ? (
        <span style={{ background: '#DCFCE7', color: '#166534', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 600 }}>
          {r.previous_stage} → {r.stage}
        </span>
      ) : r.stage ? (
        <span style={{ background: '#F3F4F6', color: '#4B5563', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 600 }}>
          {r.stage}
        </span>
      ) : null}
    </Link>
  );
}

function ToolCard({ href, emoji, label, desc }: { href: string; emoji: string; label: string; desc: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: 12,
        borderRadius: 8,
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        textDecoration: 'none',
        color: '#111827',
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{desc}</div>
    </Link>
  );
}
