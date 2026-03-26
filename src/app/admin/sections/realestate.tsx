'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, C, DataTable, Pill, Spinner, ago } from '../admin-shared';

export default function RealEstateSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sites' | 'subscriptions' | 'unsold' | 'redev' | 'interests'>('sites');

  useEffect(() => {
    fetch('/api/admin/dashboard?section=realestate').then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const tabs = [
    { key: 'sites' as const, label: `통합 현장 (${data?.sites?.length || 0})`, icon: '🏢' },
    { key: 'subscriptions' as const, label: `청약 (${data?.subscriptions?.length || 0})`, icon: '📋' },
    { key: 'unsold' as const, label: `미분양 (${data?.unsold?.length || 0})`, icon: '📉' },
    { key: 'redev' as const, label: `재개발 (${data?.redevelopment?.length || 0})`, icon: '🏗️' },
    { key: 'interests' as const, label: `관심단지 (${data?.interests?.length || 0})`, icon: '❤️' },
  ];

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 20px' }}>🏢 부동산 관리</h1>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map(t => <Pill key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>{t.icon} {t.label}</Pill>)}
      </div>

      {tab === 'sites' && (
        <DataTable
          headers={['현장명', '유형', '지역', '콘텐츠점수', '관심', '상태', '업데이트']}
          rows={(data?.sites ?? []).map((s: any) => [
            <a key="n" href={`/apt/${s.slug}`} target="_blank" rel="noopener" style={{ color: C.brand, textDecoration: 'none', fontWeight: 600 }}>{s.name}</a>,
            <Badge key="t" color={s.site_type === 'subscription' ? C.green : s.site_type === 'redevelopment' ? C.yellow : C.cyan}>{s.site_type}</Badge>,
            `${s.region || ''} ${s.sigungu || ''}`,
            <span key="sc" style={{ color: (s.content_score || 0) >= 40 ? C.green : C.yellow, fontWeight: 700 }}>{s.content_score || 0}</span>,
            s.interest_count || 0,
            <Badge key="st" color={s.status === 'active' ? C.green : C.textDim}>{s.status}</Badge>,
            ago(s.updated_at),
          ])}
        />
      )}
      {tab === 'subscriptions' && (
        <DataTable
          headers={['단지명', '지역', '접수시작', '접수종료', '세대수']}
          rows={(data?.subscriptions ?? []).map((s: any) => [
            s.house_nm || '—', s.region_nm || '—', s.rcept_bgnde || '—', s.rcept_endde || '—', s.tot_supply_hshld_co || '—',
          ])}
        />
      )}
      {tab === 'unsold' && (
        <DataTable
          headers={['단지명', '지역', '미분양', '총세대']}
          rows={(data?.unsold ?? []).map((u: Record<string, any>) => [
            u.complex_name || '—', u.region || '—',
            <span key="c" style={{ color: C.red, fontWeight: 700 }}>{u.unsold_count || 0}</span>,
            u.total_units || '—',
          ])}
        />
      )}
      {tab === 'redev' && (
        <DataTable
          headers={['구역명', '지역', '단계', '세대수']}
          rows={(data?.redevelopment ?? []).map((r: any) => [
            r.district_name, r.region || '—',
            <Badge key="s" color={C.yellow}>{r.stage || '—'}</Badge>,
            r.total_households || '—',
          ])}
        />
      )}
      {tab === 'interests' && (
        <DataTable
          headers={['이름', '현장ID', '회원여부', '등록일']}
          rows={(data?.interests ?? []).map((i: any) => [
            i.name || '(비공개)',
            i.site_id,
            i.is_member ? <Badge key="m" color={C.green}>회원</Badge> : <Badge key="m" color={C.textDim}>비회원</Badge>,
            ago(i.created_at),
          ])}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════
// ⚙️ SYSTEM
// ══════════════════════════════════════
