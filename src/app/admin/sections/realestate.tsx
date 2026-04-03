'use client';
import { useState, useEffect, useCallback } from 'react';
import { Badge, C, DataTable, Pill, Spinner, ago } from '../admin-shared';

interface SiteGroup {
  site_id: string; name: string; slug: string; region: string; sigungu: string;
  count: number; members: number; guests: number;
}
interface InterestRow {
  id: string; created_at: string; is_member: boolean; source: string;
  guest_name: string | null; guest_city: string | null; guest_district: string | null;
  guest_birth_date: string | null; guest_phone_last4: string | null; guest_phone: string | null;
  user_id: string | null;
  profiles: { nickname: string | null; residence_city: string | null; residence_district: string | null; phone: string | null } | null;
}

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
    { key: 'interests' as const, label: `관심단지`, icon: '❤️' },
  ];

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: C.text, margin: '0 0 20px' }}>🏢 부동산 관리</h1>
      <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-lg)', flexWrap: 'wrap' }}>
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
          headers={['단지명', '지역', '접수', '세대수', '브랜드', '유형', '대출', '규제', 'PDF']}
          rows={(data?.subscriptions ?? []).map((s: any) => [
            <a key="n" href={`/apt/${s.id}`} target="_blank" rel="noopener" style={{ color: C.brand, textDecoration: 'none', fontWeight: 600, fontSize: 12 }}>{s.house_nm || '—'}</a>,
            s.region_nm || '—',
            <span key="d" style={{ fontSize: 11 }}>{s.rcept_bgnde?.slice(5) || '—'}~{s.rcept_endde?.slice(5) || ''}</span>,
            <span key="u" style={{ fontWeight: 700 }}>{s.tot_supply_hshld_co || '—'}{s.total_households && s.total_households !== s.tot_supply_hshld_co ? <span style={{ color: C.textDim, fontSize: 10 }}> /{s.total_households}</span> : ''}</span>,
            s.brand_name ? <Badge key="b" color={C.brand}>{s.brand_name}</Badge> : '—',
            s.project_type && s.project_type !== '민간' ? <Badge key="pt" color={s.project_type === '재개발' ? '#FB923C' : s.project_type === '재건축' ? '#A78BFA' : C.green}>{s.project_type}</Badge> : '민간',
            s.loan_rate ? <Badge key="l" color={s.loan_rate.includes('무이자') ? C.green : C.yellow}>{s.loan_rate}</Badge> : '—',
            s.is_regulated_area ? <Badge key="r" color={C.red}>규제</Badge> : '—',
            s.max_floor !== null ? <Badge key="pdf" color={C.green}>✓</Badge> : <Badge key="pdf" color={C.textDim}>—</Badge>,
          ])}
        />
      )}
      {tab === 'unsold' && (
        <DataTable
          headers={['단지명', '지역', '미분양', '총세대', '시공사', '역세권', '할인']}
          rows={(data?.unsold ?? []).map((u: Record<string, any>) => [
            u.house_nm || '—',
            <span key="r" style={{ fontSize: 11 }}>{u.region_nm}{u.sigungu_nm ? ` ${u.sigungu_nm}` : ''}</span>,
            <span key="c" style={{ color: C.red, fontWeight: 700 }}>{u.tot_unsold_hshld_co || 0}</span>,
            u.tot_supply_hshld_co || '—',
            u.constructor_nm || '—',
            u.nearest_station ? <Badge key="st" color={C.brand}>🚇 {u.nearest_station}</Badge> : '—',
            u.discount_info ? <Badge key="dc" color={C.green}>💰 {u.discount_info}</Badge> : '—',
          ])}
        />
      )}
      {tab === 'redev' && (
        <DataTable
          headers={['구역명', '지역', '단계', '유형', '세대수', '시공사', '시행사']}
          rows={(data?.redevelopment ?? []).map((r: any) => [
            r.district_name || '—', r.region || '—',
            <Badge key="s" color={C.yellow}>{r.stage || '—'}</Badge>,
            r.project_type ? <Badge key="pt" color={r.project_type === '재개발' ? '#FB923C' : '#A78BFA'}>{r.project_type}</Badge> : '—',
            r.total_households || '—',
            r.constructor || '—',
            r.developer && r.developer !== r.constructor ? r.developer : '—',
          ])}
        />
      )}
      {tab === 'interests' && <InterestManager />}
    </div>
  );
}

// ══════════════════════════════════════
// 관심단지 관리 컴포넌트
// ══════════════════════════════════════
function InterestManager() {
  const [groups, setGroups] = useState<SiteGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SiteGroup | null>(null);
  const [details, setDetails] = useState<InterestRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [phoneMask, setPhoneMask] = useState(true);
  const [period, setPeriod] = useState<'all' | '7d' | '30d'>('all');

  useEffect(() => {
    fetch('/api/admin/interests?group_by=site')
      .then(r => r.json())
      .then(setGroups)
      .finally(() => setLoading(false));
  }, []);

  const selectSite = useCallback(async (g: SiteGroup) => {
    setSelected(g);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/interests?site_id=${g.site_id}`);
      const data = await res.json();
      setDetails(data || []);
    } catch { setDetails([]); }
    setDetailLoading(false);
  }, []);

  const downloadCSV = useCallback(() => {
    if (!selected || !details.length) return;
    const rows = filteredDetails.map((d, i) => {
      if (d.is_member) {
        const p = d.profiles;
        return [i + 1, '회원', p?.nickname || '-', p?.residence_city || '-', p?.residence_district || '-', p?.phone || '-', '-', new Date(d.created_at).toLocaleDateString('ko-KR')].join(',');
      }
      const phone = phoneMask ? (d.guest_phone_last4 ? `***${d.guest_phone_last4}` : '-') : (d.guest_phone || (d.guest_phone_last4 ? `***${d.guest_phone_last4}` : '-'));
      return [i + 1, '비회원', d.guest_name || '-', d.guest_city || '-', d.guest_district || '-', phone, d.guest_birth_date || '-', new Date(d.created_at).toLocaleDateString('ko-KR')].join(',');
    });
    const csv = '\uFEFF' + ['#,구분,이름/닉네임,시도,시군구,연락처,생년월일,등록일'].concat(rows).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `관심단지_${selected.name}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selected, details, phoneMask, period]);

  const filtered = search
    ? groups.filter(g => g.name.includes(search) || g.region.includes(search) || g.sigungu.includes(search))
    : groups;

  // 기간 필터링된 상세 데이터
  const filteredDetails = details.filter(d => {
    if (period === 'all') return true;
    const days = period === '7d' ? 7 : 30;
    return Date.now() - new Date(d.created_at).getTime() < days * 86400000;
  });

  const totalAll = groups.reduce((s, g) => s + g.count, 0);
  const totalMembers = groups.reduce((s, g) => s + g.members, 0);
  const totalGuests = groups.reduce((s, g) => s + g.guests, 0);

  if (loading) return <Spinner />;

  return (
    <div style={{ display: 'flex', gap: 'var(--sp-lg)', flexDirection: 'column' }}>
      {/* 요약 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: '총 등록', value: totalAll, color: C.brand, icon: '❤️' },
          { label: '회원', value: totalMembers, color: C.green, icon: '👤' },
          { label: '비회원', value: totalGuests, color: C.yellow, icon: '📝' },
          { label: '관심 현장', value: groups.length, color: C.cyan, icon: '🏢' },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-sm)', padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: C.textDim }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 단지 목록 */}
      <div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="단지명/지역 검색..."
          style={{ width: '100%', maxWidth: 300, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'grid', gap: 4 }}>
          {filtered.length === 0 && <div style={{ color: C.textDim, fontSize: 13, padding: 16 }}>등록된 관심단지가 없습니다</div>}
          {filtered.map(g => (
            <button
              key={g.site_id}
              onClick={() => selectSite(g)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-sm)',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: `1px solid ${selected?.site_id === g.site_id ? C.brand : C.border}`,
                background: selected?.site_id === g.site_id ? `${C.brand}10` : C.surface,
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{g.name}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{g.region} {g.sigungu}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.brand }}>{g.count}<span style={{ fontSize: 10, color: C.textDim, fontWeight: 500 }}>명</span></div>
                <div style={{ fontSize: 10, color: C.textDim }}>회원{g.members} · 비회원{g.guests}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 선택된 단지 상세 */}
      {selected && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-card)', padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>{selected.name}</h3>
              <span style={{ fontSize: 11, color: C.textDim }}>{selected.region} {selected.sigungu} — {filteredDetails.length}명</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* 기간 필터 */}
              {(['all', '30d', '7d'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '4px 10px', borderRadius: 4, border: `1px solid ${period === p ? C.brand : C.border}`,
                  background: period === p ? `${C.brand}15` : 'transparent',
                  color: period === p ? C.brand : C.textDim, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>{{ all: '전체', '30d': '30일', '7d': '7일' }[p]}</button>
              ))}
              {/* 마스킹 토글 */}
              <button onClick={() => setPhoneMask(!phoneMask)} style={{
                padding: '4px 10px', borderRadius: 4, border: `1px solid ${C.border}`,
                background: phoneMask ? 'transparent' : `${C.yellow}15`,
                color: phoneMask ? C.textDim : C.yellow, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>{phoneMask ? '🔒 마스킹' : '🔓 전체보기'}</button>
              {/* CSV 다운로드 */}
              <button onClick={downloadCSV} style={{
                padding: '4px 10px', borderRadius: 4, border: `1px solid ${C.green}40`,
                background: `${C.green}10`, color: C.green, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>📥 CSV</button>
            </div>
          </div>

          {detailLoading ? <Spinner /> : (
            <>
              {/* 회원 테이블 */}
              {(() => {
                const members = filteredDetails.filter(d => d.is_member);
                if (!members.length) return null;
                return (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 4 }}>👤 회원 ({members.length}명)</div>
                    <DataTable
                      headers={['#', '닉네임', '거주지', '연락처', '등록일']}
                      rows={members.map((m, i) => {
                        const p = m.profiles;
                        const loc = [p?.residence_city, p?.residence_district].filter(Boolean).join(' ') || '-';
                        const phone = phoneMask ? (p?.phone ? `***${p.phone.slice(-4)}` : '-') : (p?.phone || '-');
                        return [
                          i + 1,
                          <span key="n" style={{ fontWeight: 600 }}>{p?.nickname || '-'}</span>,
                          loc,
                          phone,
                          new Date(m.created_at).toLocaleDateString('ko-KR'),
                        ];
                      })}
                    />
                  </>
                );
              })()}

              {/* 비회원 테이블 */}
              {(() => {
                const guests = filteredDetails.filter(d => !d.is_member);
                if (!guests.length) return null;
                return (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.yellow, margin: '12px 0 4px' }}>📝 비회원 ({guests.length}명)</div>
                    <DataTable
                      headers={['#', '이름', '거주지', '연락처', '생년월일', '등록일']}
                      rows={guests.map((g, i) => {
                        const loc = [g.guest_city, g.guest_district].filter(Boolean).join(' ') || '-';
                        const name = phoneMask ? (g.guest_name ? g.guest_name.slice(0, 1) + '**' : '-') : (g.guest_name || '-');
                        const phone = phoneMask ? (g.guest_phone_last4 ? `***${g.guest_phone_last4}` : '-') : (g.guest_phone || (g.guest_phone_last4 ? `***${g.guest_phone_last4}` : '-'));
                        return [
                          i + 1,
                          <span key="n" style={{ fontWeight: 600 }}>{name}</span>,
                          loc,
                          phone,
                          g.guest_birth_date || '-',
                          new Date(g.created_at).toLocaleDateString('ko-KR'),
                        ];
                      })}
                    />
                  </>
                );
              })()}

              {filteredDetails.length === 0 && <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: 20 }}>해당 기간에 등록된 관심 고객이 없습니다</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
// ⚙️ SYSTEM
// ══════════════════════════════════════
