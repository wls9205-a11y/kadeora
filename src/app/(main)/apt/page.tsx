// s262 Phase C — Issue Engine v1 /apt (legacy: src/_legacy/s262/apt_page_v0.tsx)
// 5 블록: 정책알림 + 마감임박 + 신규공고24h + 미분양핫 + 재개발단계변경 + 도구 4개
// DDayAlertCTA 마감임박 블록 끝에 노출 (비로그인 only).
import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import RegionAutoSelect from '@/components/apt/RegionAutoSelect';
import AptIssueCard from '@/components/cards/AptIssueCard';
import DDayAlertCTA from '@/components/cta/DDayAlertCTA';
import type { AptIssueScore } from '@/lib/issue/types';

export const revalidate = 60;
export const maxDuration = 10;

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

type UnsoldRow = {
  id: number;
  house_nm: string;
  region_nm: string | null;
  sigungu_nm: string | null;
  tot_unsold_hshld_co: number | null;
  sale_price_min: number | null;
  thumbnail_url: string | null;
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
};

async function fetchBlocks(region: string) {
  const sb = getSupabaseAdmin();
  const isAll = region === '전국';

  const [imminent, fresh24h, regulated, unsoldHot, redevStage] = await Promise.all([
    // 마감 임박: apt_issue_scores dday 0..7
    (sb as any).from('apt_issue_scores').select('*').is('warning', null)
      .gte('dday', 0).lte('dday', 7)
      .order('dday', { ascending: true })
      .order('score', { ascending: false, nullsFirst: false })
      .limit(5),
    // 신규 공고 24h
    (sb as any).from('apt_subscriptions')
      .select('id, house_nm, region_nm, mdatrgbn_nm, rcept_endde, created_at, is_regulated_area, is_speculative_zone')
      .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order('created_at', { ascending: false }).limit(5),
    // 정책 알림: 규제/투기 지역
    (sb as any).from('apt_subscriptions')
      .select('id, house_nm, region_nm, mdatrgbn_nm, rcept_endde, created_at, is_regulated_area, is_speculative_zone')
      .or('is_regulated_area.eq.true,is_speculative_zone.eq.true')
      .gte('rcept_endde', new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10))
      .order('rcept_endde', { ascending: true }).limit(3),
    // 미분양 핫
    (sb as any).from('unsold_apts')
      .select('id, house_nm, region_nm, sigungu_nm, tot_unsold_hshld_co, sale_price_min, thumbnail_url')
      .eq('is_active', true)
      .order('tot_unsold_hshld_co', { ascending: false, nullsFirst: false }).limit(5),
    // 재개발 단계 변경
    (sb as any).from('redevelopment_projects')
      .select('id, district_name, region, sigungu, stage, previous_stage, last_stage_change, thumbnail_url')
      .not('last_stage_change', 'is', null)
      .order('last_stage_change', { ascending: false }).limit(5),
  ]);

  const filterRegion = <T extends { region_nm?: string | null; region?: string | null }>(rows: T[]): T[] => {
    if (isAll) return rows;
    return rows.filter((r) => (r.region_nm ?? r.region ?? '').includes(region));
  };

  return {
    imminent: ((imminent?.data ?? []) as AptIssueScore[]).filter((r) => isAll || (r.region_nm ?? '').includes(region)),
    fresh24h: filterRegion((fresh24h?.data ?? []) as Sub[]),
    regulated: filterRegion((regulated?.data ?? []) as Sub[]),
    unsoldHot: filterRegion((unsoldHot?.data ?? []) as UnsoldRow[]),
    redevStage: filterRegion((redevStage?.data ?? []) as RedevRow[]),
  };
}

export default async function AptPage({ searchParams }: { searchParams?: Promise<{ region?: string }> }) {
  const sp = (await searchParams) || {};
  const region = sp.region?.trim() || '전국';
  const isAutoRegion = !sp.region;
  const blocks = await fetchBlocks(region);

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

      {/* 1. 정책 알림 */}
      <Block title="🚨 정책 알림" subtitle="규제·투기 지역 청약" href="/apt/subscription?filter=regulated">
        {blocks.regulated.length === 0 ? (
          <Empty label="현재 지역 규제 청약 없음" />
        ) : blocks.regulated.map((s) => (
          <SubRow key={s.id} sub={s} badge={s.is_speculative_zone ? '투기과열' : '조정대상'} />
        ))}
      </Block>

      {/* 2. 마감 임박 */}
      <Block title="⏰ 마감 임박 (D-7)" subtitle="이슈 점수 기준" href="/apt/imminent">
        {blocks.imminent.length === 0 ? (
          <Empty label="마감 임박 청약 없음" />
        ) : blocks.imminent.map((a) => <AptIssueCard key={a.id} data={a} />)}
        <DDayAlertCTA source="apt_dday_alert" redirect="/apt" />
      </Block>

      {/* 3. 신규 공고 24h */}
      <Block title="🆕 신규 공고 (24h)" subtitle="공고 등재 24시간 내" href="/apt/subscription?sort=newest">
        {blocks.fresh24h.length === 0 ? (
          <Empty label="24시간 내 신규 공고 없음" />
        ) : blocks.fresh24h.map((s) => <SubRow key={s.id} sub={s} />)}
      </Block>

      {/* 4. 미분양 핫 */}
      <Block title="🔥 미분양 핫" subtitle="잔여 세대 많은 단지" href="/apt/unsold">
        {blocks.unsoldHot.length === 0 ? (
          <Empty label="미분양 데이터 준비 중" />
        ) : blocks.unsoldHot.map((u) => <UnsoldHotRow key={u.id} u={u} />)}
      </Block>

      {/* 5. 재개발 단계 변경 */}
      <Block title="🏗️ 재개발 단계 변경" subtitle="최근 단계 변경 단지" href="/apt/redev">
        {blocks.redevStage.length === 0 ? (
          <Empty label="최근 단계 변경 없음" />
        ) : blocks.redevStage.map((r) => <RedevRowComp key={r.id} r={r} />)}
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
        {u.house_nm}
      </span>
      <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
        {u.sigungu_nm ?? u.region_nm ?? ''}
      </span>
      {u.tot_unsold_hshld_co ? (
        <span style={{ fontSize: 11, color: '#9A3412', fontWeight: 600 }}>잔여 {u.tot_unsold_hshld_co.toLocaleString()}세대</span>
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

function Empty({ label }: { label: string }) {
  return (
    <div style={{ padding: 16, margin: 3, borderRadius: 6, background: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
      {label}
    </div>
  );
}
