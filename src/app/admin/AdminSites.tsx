'use client';
import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface SiteRow { id: string; slug: string; name: string; site_type: string; region: string; sigungu: string; content_score: number; interest_count: number; page_views: number; is_active: boolean; sitemap_wave: number; created_at: string; }
interface InterestRow { id: number; site_id: string; user_id: string | null; guest_name: string | null; guest_phone_last4: string | null; guest_city: string | null; guest_district: string | null; is_member: boolean; created_at: string; site_name?: string; }
interface ConsentRow { id: number; consent_type: string; is_agreed: boolean; guest_identifier: string | null; consented_at: string; withdrawn_at: string | null; }

const card = { background: '#0A1225', borderRadius: 12, padding: '14px 16px', border: '1px solid #152240', marginBottom: 14 };
const hdr: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#E8EDF5', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const badge = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: bg, color });

export default function AdminSites() {
  const [tab, setTab] = useState<'overview' | 'sites' | 'interests' | 'consents'>('overview');
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [kpi, setKpi] = useState({ total: 0, published: 0, interests: 0, todayInterests: 0, views: 0, consentsTotal: 0, withdrawals: 0 });
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [leads, setLeads] = useState({ total: 0, forwarded: 0, contacted: 0, converted: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ region: '', type: '', q: '' });
  const [actionResult, setActionResult] = useState('');
  const [running, setRunning] = useState('');

  const sb = createSupabaseBrowser();

  const loadKPI = useCallback(async () => {
    try {
      const [sitesR, interestsR, consentsR] = await Promise.all([
        (sb as any).from('apt_sites').select('id, content_score, interest_count, page_views, is_active', { count: 'exact' }),
        (sb as any).from('apt_site_interests').select('id, created_at', { count: 'exact' }),
        (sb as any).from('privacy_consents').select('id, withdrawn_at', { count: 'exact' }),
      ]);
      const allSites = sitesR.data || [];
      const published = allSites.filter((s: any) => s.content_score >= 40 && s.is_active).length;
      const totalInterests = interestsR.count || 0;
      const today = new Date().toISOString().slice(0, 10);
      const todayI = (interestsR.data || []).filter((i: any) => i.created_at?.startsWith(today)).length;
      const totalViews = allSites.reduce((sum: number, s: any) => sum + (s.page_views || 0), 0);
      const withdrawals = (consentsR.data || []).filter((c: any) => c.withdrawn_at).length;
      setKpi({ total: allSites.length, published, interests: totalInterests, todayInterests: todayI, views: totalViews, consentsTotal: consentsR.count || 0, withdrawals });
    } catch {}
  }, []);

  const loadFlags = useCallback(async () => {
    try {
      const { data } = await (sb as any).from('feature_flags').select('key, enabled');
      const map: Record<string, boolean> = {};
      (data || []).forEach((f: any) => { map[f.key] = f.enabled; });
      setFlags(map);
    } catch {}
    try {
      const { data } = await (sb as any).from('consultant_leads').select('status');
      const all = data || [];
      setLeads({
        total: all.length,
        forwarded: all.filter((l: any) => l.status === 'forwarded').length,
        contacted: all.filter((l: any) => l.status === 'contacted').length,
        converted: all.filter((l: any) => l.status === 'converted').length,
      });
    } catch {}
  }, []);

  const toggleFlag = async (key: string) => {
    const newVal = !flags[key];
    await (sb as any).from('feature_flags').update({ enabled: newVal, updated_at: new Date().toISOString() }).eq('key', key);
    setFlags(prev => ({ ...prev, [key]: newVal }));
  };

  const loadSites = useCallback(async () => {
    setLoading(true);
    let q = (sb as any).from('apt_sites').select('id, slug, name, site_type, region, sigungu, content_score, interest_count, page_views, is_active, sitemap_wave, created_at')
      .order('interest_count', { ascending: false }).limit(100);
    if (filter.region) q = q.eq('region', filter.region);
    if (filter.type) q = q.eq('site_type', filter.type);
    if (filter.q) q = q.ilike('name', `%${filter.q}%`);
    const { data } = await q;
    setSites(data || []);
    setLoading(false);
  }, [filter]);

  const loadInterests = useCallback(async () => {
    setLoading(true);
    const { data } = await (sb as any).from('apt_site_interests')
      .select('id, site_id, user_id, guest_name, guest_phone_last4, guest_city, guest_district, is_member, created_at')
      .order('created_at', { ascending: false }).limit(100);
    // 현장명 매칭
    if (data?.length) {
      const siteIds = [...new Set(data.map((d: any) => d.site_id))];
      const { data: siteNames } = await (sb as any).from('apt_sites').select('id, name').in('id', siteIds);
      const nameMap = Object.fromEntries((siteNames || []).map((s: any) => [s.id, s.name]));
      data.forEach((d: any) => d.site_name = nameMap[d.site_id] || '');
    }
    setInterests(data || []);
    setLoading(false);
  }, []);

  const loadConsents = useCallback(async () => {
    setLoading(true);
    const { data } = await (sb as any).from('privacy_consents')
      .select('id, consent_type, is_agreed, guest_identifier, consented_at, withdrawn_at')
      .order('consented_at', { ascending: false }).limit(100);
    setConsents(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadKPI(); loadFlags(); }, []);
  useEffect(() => {
    if (tab === 'sites') loadSites();
    if (tab === 'interests') loadInterests();
    if (tab === 'consents') loadConsents();
  }, [tab, filter]);

  const runCron = async (name: string, path: string) => {
    setRunning(name);
    setActionResult('');
    try {
      const res = await fetch(path, { headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}` } });
      const data = await res.json();
      setActionResult(`${name}: ${JSON.stringify(data).slice(0, 200)}`);
    } catch (e: any) { setActionResult(`${name}: 에러 - ${e.message}`); }
    setRunning('');
    loadKPI();
  };

  const toggleSiteActive = async (site: SiteRow) => {
    await (sb as any).from('apt_sites').update({ is_active: !site.is_active }).eq('id', site.id);
    loadSites();
  };

  const exportCSV = () => {
    const rows = interests.map(i => [
      i.site_name || '', i.is_member ? '회원' : '비회원', i.guest_name || '(회원)', 
      i.guest_phone_last4 ? `****${i.guest_phone_last4}` : '-',
      i.guest_city || '', i.guest_district || '', i.created_at?.slice(0, 10) || ''
    ]);
    const csv = '\uFEFF현장,유형,이름,전화번호(마스킹),시도,시군구,등록일\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `관심고객_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { key: 'overview' as const, label: '대시보드' },
    { key: 'sites' as const, label: '현장 목록' },
    { key: 'interests' as const, label: '관심고객' },
    { key: 'consents' as const, label: '동의 관리' },
  ];

  const typeLbl: Record<string, string> = { subscription: '분양', redevelopment: '재개발', unsold: '미분양', landmark: '랜드마크', complex: '기존단지' };
  const typeClr: Record<string, string> = { subscription: '#2EE8A5', redevelopment: '#B794FF', unsold: '#FF6B6B', landmark: '#38BDF8' };

  return (
    <div style={{ ...card, marginTop: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#E8EDF5' }}>🏗️ 현장 관리 센터</div>
        <div style={{ display: 'flex', gap: 3 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: tab === t.key ? '#3B7BF6' : '#0F1A32', color: tab === t.key ? '#fff' : '#94A8C4',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ━━━ 대시보드 탭 ━━━ */}
      {tab === 'overview' && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: '총 현장', value: kpi.total.toLocaleString(), color: '#E8EDF5' },
              { label: '공개 중', value: kpi.published.toLocaleString(), color: '#2EE8A5' },
              { label: '관심고객', value: kpi.interests.toLocaleString(), color: '#3B7BF6' },
              { label: '총 페이지뷰', value: kpi.views >= 1000 ? `${(kpi.views / 1000).toFixed(1)}K` : kpi.views.toString(), color: '#FFD43B' },
            ].map(k => (
              <div key={k.label} style={{ background: '#0F1A32', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#6B82A0', marginBottom: 2 }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* 관심고객 등록 플로우 설명 */}
          <div style={{ background: '#0F1A32', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #152240' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#E8EDF5', marginBottom: 8 }}>📋 관심고객 등록 → 처리 흐름</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ fontSize: 11, color: '#94A8C4', lineHeight: 1.8 }}>
                <div style={{ fontWeight: 700, color: '#3B7BF6', marginBottom: 4 }}>회원 등록</div>
                ① 현장 페이지에서 "등록하기" 클릭<br/>
                ② apt_site_interests에 user_id로 저장<br/>
                ③ interest_count +1 (소셜 프루프)<br/>
                ④ +50P 포인트 적립
              </div>
              <div style={{ fontSize: 11, color: '#94A8C4', lineHeight: 1.8 }}>
                <div style={{ fontWeight: 700, color: '#FFD43B', marginBottom: 4 }}>비회원 등록</div>
                ① 이름/전화/생년/거주지 입력<br/>
                ② 만 14세 미만 자동 차단<br/>
                ③ privacy_consents에 동의 이력 저장<br/>
                ④ 전화번호 마스킹 저장 (AES-256 예정)
              </div>
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#152240', borderRadius: 8, fontSize: 11, color: '#6B82A0' }}>
              📊 동의 현황: 필수 {kpi.consentsTotal}건 · 철회 {kpi.withdrawals}건 · 오늘 관심등록 {kpi.todayInterests}건
            </div>
          </div>

          {/* 원클릭 운영 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#E8EDF5', marginBottom: 8 }}>⚡ 원클릭 운영</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            {[
              { label: '현장 싱크', icon: '🔄', path: '/api/cron/sync-apt-sites', desc: '5개 테이블 통합' },
              { label: '이미지 수집', icon: '🖼️', path: '/api/cron/collect-site-images', desc: '네이버 검색 일괄' },
              { label: '동의 파기', icon: '🗑️', path: '/api/cron/purge-withdrawn-consents', desc: '철회 5일 이후' },
              { label: '관심고객 CSV', icon: '📥', action: 'csv', desc: '마스킹 다운로드' },
              { label: 'KPI 새로고침', icon: '📊', action: 'refresh', desc: '최신 데이터' },
            ].map(a => (
              <button key={a.label} onClick={() => {
                if (a.action === 'csv') { setTab('interests'); setTimeout(exportCSV, 500); }
                else if (a.action === 'refresh') loadKPI();
                else if (a.path) runCron(a.label, a.path);
              }} disabled={running === a.label} style={{
                background: '#0F1A32', border: '1px solid #152240', borderRadius: 8, padding: '10px 6px',
                cursor: 'pointer', textAlign: 'center', opacity: running === a.label ? 0.5 : 1,
              }}>
                <div style={{ fontSize: 16 }}>{a.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#E8EDF5', marginTop: 2 }}>{running === a.label ? '실행 중...' : a.label}</div>
                <div style={{ fontSize: 9, color: '#6B82A0', marginTop: 1 }}>{a.desc}</div>
              </button>
            ))}
          </div>
          {actionResult && <div style={{ fontSize: 10, color: '#6B82A0', padding: '6px 8px', background: '#0F1A32', borderRadius: 6, marginBottom: 8, wordBreak: 'break-all' }}>{actionResult}</div>}

          {/* 타입별 현장 수 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#E8EDF5', marginBottom: 8 }}>📊 타입별 현장 수</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {['subscription', 'redevelopment', 'unsold', 'landmark'].map(t => {
              const cnt = sites.length ? sites.filter(s => s.site_type === t).length : '—';
              return (
                <div key={t} onClick={() => { setFilter({ ...filter, type: t }); setTab('sites'); }} style={{ background: '#0F1A32', borderRadius: 8, padding: '8px 6px', textAlign: 'center', cursor: 'pointer', border: '1px solid #152240' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: typeClr[t] || '#E8EDF5' }}>{cnt}</div>
                  <div style={{ fontSize: 10, color: '#6B82A0' }}>{typeLbl[t]}</div>
                </div>
              );
            })}
          </div>

          {/* 프리미엄 상담사 연결 */}
          <div style={{ background: '#0F1A32', borderRadius: 10, padding: 14, marginTop: 14, border: '1px solid #152240' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#E8EDF5' }}>🤝 프리미엄 상담사 연결</div>
              <button onClick={() => toggleFlag('premium_consultant_forwarding')} style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: flags.premium_consultant_forwarding ? '#2EE8A5' : '#FF6B6B',
                color: flags.premium_consultant_forwarding ? '#0A1225' : '#fff',
                transition: 'all 0.2s',
              }}>
                {flags.premium_consultant_forwarding ? '🟢 활성화' : '🔴 비활성'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#94A8C4', lineHeight: 1.7, marginBottom: 10 }}>
              {flags.premium_consultant_forwarding
                ? '관심고객이 제3자 제공에 동의하면 → 해당 지역 상담사에게 자동 전달됩니다.'
                : '비활성 상태입니다. 활성화하면 제3자 동의 관심고객이 상담사에게 자동 연결됩니다.'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { label: '총 전달', value: leads.total, color: '#E8EDF5' },
                { label: '전달 완료', value: leads.forwarded, color: '#3B7BF6' },
                { label: '상담 중', value: leads.contacted, color: '#FFD43B' },
                { label: '계약 전환', value: leads.converted, color: '#2EE8A5' },
              ].map(k => (
                <div key={k.label} style={{ background: '#0A1225', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 9, color: '#6B82A0' }}>{k.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#6B82A0', lineHeight: 1.6 }}>
              흐름: 관심고객 등록 → 제3자 동의 ✅ → 서버 자동 복호화 → 상담사 알림톡 발송 → 감사 로그 기록<br/>
              ⚠️ 어드민 화면에는 ****5678만 표시. 전화번호 원본은 서버→상담사 직접 전달.
            </div>
          </div>
        </>
      )}

      {/* ━━━ 현장 목록 탭 ━━━ */}
      {tab === 'sites' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <select value={filter.region} onChange={e => setFilter({ ...filter, region: e.target.value })} style={{ padding: '5px 8px', borderRadius: 6, background: '#0F1A32', border: '1px solid #152240', color: '#E8EDF5', fontSize: 11 }}>
              <option value="">전체 지역</option>
              {['서울','부산','경기','인천','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })} style={{ padding: '5px 8px', borderRadius: 6, background: '#0F1A32', border: '1px solid #152240', color: '#E8EDF5', fontSize: 11 }}>
              <option value="">전체 타입</option>
              <option value="subscription">분양</option>
              <option value="redevelopment">재개발</option>
              <option value="unsold">미분양</option>
              <option value="landmark">랜드마크</option>
            </select>
            <input value={filter.q} onChange={e => setFilter({ ...filter, q: e.target.value })} placeholder="현장명 검색..." style={{ flex: 1, padding: '5px 8px', borderRadius: 6, background: '#0F1A32', border: '1px solid #152240', color: '#E8EDF5', fontSize: 11, minWidth: 100 }} />
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 20, color: '#6B82A0', fontSize: 12 }}>불러오는 중...</div> : (
            <div style={{ overflow: 'auto', maxHeight: 400 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ borderBottom: '1px solid #152240' }}>
                  {['현장명','지역','타입','점수','관심','뷰','상태',''].map(h => <th key={h} style={{ padding: '6px 4px', color: '#6B82A0', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {sites.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #0F1A32' }}>
                      <td style={{ padding: '6px 4px', fontWeight: 600, color: '#E8EDF5', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={`/apt/sites/${s.slug}`} target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'none' }}>{s.name}</a>
                      </td>
                      <td style={{ padding: '6px 4px', color: '#94A8C4', whiteSpace: 'nowrap' }}>{s.region} {s.sigungu || ''}</td>
                      <td style={{ padding: '6px 4px' }}><span style={badge(typeClr[s.site_type] ? `${typeClr[s.site_type]}22` : '#15224050', typeClr[s.site_type] || '#94A8C4')}>{typeLbl[s.site_type] || s.site_type}</span></td>
                      <td style={{ padding: '6px 4px', color: s.content_score >= 40 ? '#2EE8A5' : '#FFD43B', fontWeight: 700 }}>{s.content_score}</td>
                      <td style={{ padding: '6px 4px', color: '#3B7BF6', fontWeight: 700 }}>{s.interest_count}</td>
                      <td style={{ padding: '6px 4px', color: '#94A8C4' }}>{s.page_views}</td>
                      <td style={{ padding: '6px 4px' }}>
                        <span style={badge(s.is_active ? 'rgba(46,232,165,0.12)' : 'rgba(255,107,107,0.12)', s.is_active ? '#2EE8A5' : '#FF6B6B')}>
                          {s.is_active ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <button onClick={() => toggleSiteActive(s)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid #152240', background: '#0F1A32', color: '#94A8C4' }}>
                          {s.is_active ? '비활성화' : '활성화'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'center', padding: 6, fontSize: 10, color: '#6B82A0' }}>{sites.length}건 표시 (최대 100)</div>
            </div>
          )}
        </>
      )}

      {/* ━━━ 관심고객 탭 ━━━ */}
      {tab === 'interests' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#6B82A0' }}>총 {interests.length}건 (최근 100건)</span>
            <button onClick={exportCSV} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: 'none', background: '#3B7BF6', color: '#fff', fontWeight: 600 }}>📥 CSV 다운로드</button>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 20, color: '#6B82A0', fontSize: 12 }}>불러오는 중...</div> : (
            <div style={{ overflow: 'auto', maxHeight: 400 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ borderBottom: '1px solid #152240' }}>
                  {['현장','유형','이름','전화(마스킹)','거주지','등록일'].map(h => <th key={h} style={{ padding: '6px 4px', color: '#6B82A0', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {interests.map(i => (
                    <tr key={i.id} style={{ borderBottom: '1px solid #0F1A32' }}>
                      <td style={{ padding: '6px 4px', color: '#E8EDF5', fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.site_name || '-'}</td>
                      <td style={{ padding: '6px 4px' }}>
                        <span style={badge(i.is_member ? 'rgba(59,123,246,0.15)' : 'rgba(255,212,59,0.15)', i.is_member ? '#6CB4FF' : '#FFD43B')}>
                          {i.is_member ? '회원' : '비회원'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px', color: '#94A8C4' }}>{i.guest_name || '(회원)'}</td>
                      <td style={{ padding: '6px 4px', color: '#94A8C4' }}>{i.guest_phone_last4 ? `****${i.guest_phone_last4}` : '-'}</td>
                      <td style={{ padding: '6px 4px', color: '#94A8C4', whiteSpace: 'nowrap' }}>{[i.guest_city, i.guest_district].filter(Boolean).join(' ') || '-'}</td>
                      <td style={{ padding: '6px 4px', color: '#6B82A0', whiteSpace: 'nowrap' }}>{i.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ━━━ 동의 관리 탭 ━━━ */}
      {tab === 'consents' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: '수집이용 동의', count: consents.filter(c => c.consent_type === 'interest_collection' && c.is_agreed).length, color: '#2EE8A5' },
              { label: '마케팅 동의', count: consents.filter(c => c.consent_type === 'marketing' && c.is_agreed).length, color: '#3B7BF6' },
              { label: '제3자 제공', count: consents.filter(c => c.consent_type === 'third_party' && c.is_agreed).length, color: '#FFD43B' },
            ].map(c => (
              <div key={c.label} style={{ background: '#0F1A32', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.count}</div>
                <div style={{ fontSize: 10, color: '#6B82A0' }}>{c.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#6B82A0' }}>
              철회 요청: <span style={{ color: '#FF6B6B', fontWeight: 700 }}>{consents.filter(c => c.withdrawn_at).length}건</span>
            </span>
            <span style={{ fontSize: 10, color: '#6B82A0' }}>전화번호 원본 열람 불가 (마스킹)</span>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 20, color: '#6B82A0', fontSize: 12 }}>불러오는 중...</div> : (
            <div style={{ overflow: 'auto', maxHeight: 300 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ borderBottom: '1px solid #152240' }}>
                  {['유형','식별자','동의일','상태'].map(h => <th key={h} style={{ padding: '6px 4px', color: '#6B82A0', fontWeight: 600, textAlign: 'left' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {consents.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #0F1A32' }}>
                      <td style={{ padding: '6px 4px', color: '#E8EDF5' }}>
                        {{ interest_collection: '수집이용', marketing: '마케팅', third_party: '제3자제공' }[c.consent_type] || c.consent_type}
                      </td>
                      <td style={{ padding: '6px 4px', color: '#94A8C4' }}>****{c.guest_identifier || '-'}</td>
                      <td style={{ padding: '6px 4px', color: '#6B82A0', whiteSpace: 'nowrap' }}>{c.consented_at?.slice(0, 10)}</td>
                      <td style={{ padding: '6px 4px' }}>
                        <span style={badge(c.withdrawn_at ? 'rgba(255,107,107,0.12)' : 'rgba(46,232,165,0.12)', c.withdrawn_at ? '#FF6B6B' : '#2EE8A5')}>
                          {c.withdrawn_at ? '철회됨' : '유효'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#152240', borderRadius: 8, fontSize: 10, color: '#6B82A0', lineHeight: 1.6 }}>
            ⚖️ 개인정보보호법 제15조·제17조·제22조의2 준수<br/>
            · 동의 시점 약관 전문이 privacy_consents.consent_text에 스냅샷 저장됨<br/>
            · 철회 요청 시 5일 이내 파기 (동의 증빙 이력은 3년 보관)<br/>
            · 전화번호 원본은 AES-256 암호화 후 저장 (ENCRYPTION_KEY 필요)
          </div>
        </>
      )}
    </div>
  );
}
