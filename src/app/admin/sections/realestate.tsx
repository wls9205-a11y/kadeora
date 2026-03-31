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
    const rows = details.map((d, i) => {
      if (d.is_member) {
        const p = d.profiles;
        return [i + 1, '회원', p?.nickname || '-', p?.residence_city || '-', p?.residence_district || '-', '-', '-', new Date(d.created_at).toLocaleDateString('ko-KR')].join(',');
      }
      return [i + 1, '비회원', d.guest_name || '-', d.guest_city || '-', d.guest_district || '-', d.guest_phone_last4 ? `***${d.guest_phone_last4}` : '-', d.guest_birth_date?.slice(0, 4) || '-', new Date(d.created_at).toLocaleDateString('ko-KR')].join(',');
    });
    const csv = '\uFEFF' + ['#,구분,이름/닉네임,시도,시군구,연락처,생년,등록일'].concat(rows).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `관심단지_${selected.name}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selected, details]);

  const filtered = search
    ? groups.filter(g => g.name.includes(search) || g.region.includes(search) || g.sigungu.includes(search))
    : groups;

  if (loading) return <Spinner />;

  return (
    <div style={{ display: 'flex', gap: 'var(--sp-lg)', flexDirection: 'column' }}>
      {/* 단지 목록 */}
      <div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="단지명/지역 검색..."
          style={{ width: '100%', maxWidth: 300, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'grid', gap: 6 }}>
          {filtered.length === 0 && <div style={{ color: C.textDim, fontSize: 13, padding: 16 }}>등록된 관심단지가 없습니다</div>}
          {filtered.map(g => (
            <button
              key={g.site_id}
              onClick={() => selectSite(g)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-sm)',
                padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-md)', border: `1px solid ${selected?.site_id === g.site_id ? C.brand : C.border}`,
                background: selected?.site_id === g.site_id ? `${C.brand}10` : C.surface,
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{g.name}</div>
                <div style={{ fontSize: 12, color: C.textDim }}>{g.region} {g.sigungu}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.brand }}>{g.count}명</div>
                <div style={{ fontSize: 11, color: C.textDim }}>회원 {g.members} · 비회원 {g.guests}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 선택된 단지 상세 */}
      {selected && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-card)', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>{selected.name}</h3>
              <span style={{ fontSize: 12, color: C.textDim }}>{selected.region} {selected.sigungu} — 총 {selected.count}명</span>
            </div>
            <button onClick={downloadCSV} style={{
              padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: `1px solid ${C.border}`,
              background: C.surface, color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              CSV 다운로드
            </button>
          </div>

          {detailLoading ? <Spinner /> : (
            <>
              {/* 회원 테이블 */}
              {(() => {
                const members = details.filter(d => d.is_member);
                if (!members.length) return null;
                return (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}>회원 ({members.length}명)</div>
                    <DataTable
                      headers={['#', '닉네임', '거주지', '등록일']}
                      rows={members.map((m, i) => {
                        const p = m.profiles;
                        const loc = [p?.residence_city, p?.residence_district].filter(Boolean).join(' ') || '-';
                        return [
                          i + 1,
                          p?.nickname || '-',
                          loc,
                          new Date(m.created_at).toLocaleDateString('ko-KR'),
                        ];
                      })}
                    />
                  </>
                );
              })()}

              {/* 비회원 테이블 */}
              {(() => {
                const guests = details.filter(d => !d.is_member);
                if (!guests.length) return null;
                return (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '14px 0 6px' }}>비회원 ({guests.length}명)</div>
                    <DataTable
                      headers={['#', '이름', '거주지', '연락처', '생년', '등록일']}
                      rows={guests.map((g, i) => {
                        const loc = [g.guest_city, g.guest_district].filter(Boolean).join(' ') || '-';
                        const name = g.guest_name ? g.guest_name.slice(0, 1) + '**' : '-';
                        return [
                          i + 1,
                          name,
                          loc,
                          g.guest_phone_last4 ? `***${g.guest_phone_last4}` : '-',
                          g.guest_birth_date?.slice(0, 4) ? `${g.guest_birth_date.slice(0, 4)}년` : '-',
                          new Date(g.created_at).toLocaleDateString('ko-KR'),
                        ];
                      })}
                    />
                  </>
                );
              })()}

              {details.length === 0 && <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', padding: 24 }}>등록된 관심 고객이 없습니다</div>}
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
