"use client";
import { useState, useEffect, useMemo } from "react";

const ago = (d: string) => { if(!d) return '—'; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분' : s < 86400 ? Math.floor(s / 3600) + '시간' : Math.floor(s / 86400) + '일'; };
const fmt = (d: string) => d ? new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '—';
const fmtFull = (d: string) => d ? new Date(d).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '—';
const Badge = ({ ok, label }: { ok: boolean; label: string }) => <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 600, background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)', color: ok ? '#10B981' : 'rgba(255,255,255,0.12)' }}>{ok ? '✓' : '✗'}{label}</span>;
const Tag = ({ text, color = 'rgba(255,255,255,0.25)', bg = 'rgba(255,255,255,0.04)' }: { text: string; color?: string; bg?: string }) => <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: bg, color, whiteSpace: 'nowrap', lineHeight: 1.6 }}>{text}</span>;

const pIcon: Record<string, string> = { kakao: '💬', google: '🔵', naver: '🟢', apple: '🍎' };
const gLabel: Record<number, { n: string; c: string }> = { 1:{n:'새싹',c:'#10B981'}, 2:{n:'묘목',c:'#34D399'}, 3:{n:'나무',c:'#06B6D4'}, 4:{n:'숲',c:'#3B82F6'}, 5:{n:'산',c:'#8B5CF6'}, 6:{n:'달',c:'#F59E0B'}, 7:{n:'별',c:'#EC4899'}, 8:{n:'VIP',c:'#EF4444'} };
const iLabel: Record<string, string> = { stock:'📈주식', apt:'🏠부동산', redev:'🏗재개발', news:'📰뉴스', tax:'🧾세금', crypto:'₿암호화폐', side:'💼부업', saving:'🐷저축', finance:'💰재테크' };
const aLabel: Record<string, string> = { '20s':'20대', '30s':'30대', '40s':'40대', '50s':'50대', '60+':'60대+' };
const srcLabel: Record<string, string> = {
  direct:'직접방문', nav:'네비바', kakao_hero:'홈CTA', action_bar:'액션바',
  apt_alert_cta:'청약알림', content_gate:'콘텐츠게이트', content_lock:'콘텐츠락',
  login_gate_blog_compare:'FG 시세비교', login_gate_apt_analysis:'FG 단지분석',
  login_gate_ai_analysis:'FG AI분석', login_gate_calc_save:'FG 계산저장',
  login_gate_feed_write:'FG 피드', login_gate_apt_trade_alert:'FG 실거래',
  login_gate_apt_sub_alert:'FG 청약', signup_cta:'가입CTA', calc_cta:'계산기CTA',
  blog_cta:'블로그CTA', sidebar:'사이드바',
};

type Sort = 'newest' | 'oldest' | 'active' | 'points' | 'engagement';
type Filter = 'all' | 'real' | 'seed' | 'ghost' | 'active7d';

function getActions(u: any): number {
  return (u.posts_count||0) + (u.comments_count||0) + (u.watchlist_count||0) + (u.apt_bm_count||0) + (u.blog_bm_count||0) + (u.attendance_count||0);
}

function getUserStatus(u: any): { label: string; color: string; bg: string } {
  if (u.is_seed) return { label: '시드', color: '#6B7280', bg: 'rgba(107,114,128,0.1)' };
  const actions = getActions(u);
  const daysSinceJoin = (Date.now() - new Date(u.created_at).getTime()) / 86400000;
  const daysSinceActive = u.last_active_at ? (Date.now() - new Date(u.last_active_at).getTime()) / 86400000 : 999;
  if (actions === 0 && !u.onboarded) return { label: '이탈', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' };
  if (actions === 0 && daysSinceJoin > 3) return { label: '유령', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' };
  if (daysSinceActive < 1) return { label: '활성', color: '#10B981', bg: 'rgba(16,185,129,0.1)' };
  if (daysSinceActive < 7) return { label: '최근', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' };
  if (daysSinceActive < 30) return { label: '이완', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' };
  return { label: '휴면', color: '#6B7280', bg: 'rgba(107,114,128,0.08)' };
}

const Bar = ({ v, mx, c }: { v: number; mx: number; c: string }) => (
  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${Math.max((v / mx) * 100, 0.5)}%`, background: c, borderRadius: 2 }} />
  </div>
);

export default function UsersTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [d, setD] = useState<any>(null);
  const [ld, setLd] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  // s186: 펼친 유저 상세 캐시 (userId → { loading | data })
  const [detail, setDetail] = useState<Record<string, { loading: boolean; data?: any }>>({});

  useEffect(() => { fetch('/api/admin/v2?tab=users').then(r => r.json()).then(v => { setD(v); setLd(false); }).catch(() => setLd(false)); }, []);

  // s186: 카드 펼치면 v2?tab=users&userId=xxx 호출 (1회 캐시).
  useEffect(() => {
    if (!expanded) return;
    if (detail[expanded]) return; // 이미 로드/요청됨
    setDetail(p => ({ ...p, [expanded]: { loading: true } }));
    fetch(`/api/admin/v2?tab=users&userId=${encodeURIComponent(expanded)}`)
      .then(r => r.json())
      .then(data => setDetail(p => ({ ...p, [expanded]: { loading: false, data } })))
      .catch(() => setDetail(p => ({ ...p, [expanded]: { loading: false, data: { error: 'fetch failed' } } })));
  }, [expanded, detail]);

  const users = useMemo(() => {
    if (!d?.users) return [];
    let list = [...d.users];

    // Filter
    if (filter === 'real') list = list.filter((u: any) => !u.is_seed);
    else if (filter === 'seed') list = list.filter((u: any) => u.is_seed);
    else if (filter === 'ghost') list = list.filter((u: any) => !u.is_seed && getActions(u) === 0);
    else if (filter === 'active7d') list = list.filter((u: any) => !u.is_seed && u.last_active_at && (Date.now() - new Date(u.last_active_at).getTime()) < 7 * 86400000);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u: any) => (u.nickname || '').toLowerCase().includes(q) || (u.signup_source || '').toLowerCase().includes(q) || (u.residence_city || '').toLowerCase().includes(q));
    }

    // Sort
    if (sort === 'oldest') list.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sort === 'active') list.sort((a: any, b: any) => new Date(b.last_active_at || 0).getTime() - new Date(a.last_active_at || 0).getTime());
    else if (sort === 'points') list.sort((a: any, b: any) => (b.points || 0) - (a.points || 0));
    else if (sort === 'engagement') list.sort((a: any, b: any) => getActions(b) - getActions(a));

    return list;
  }, [d, filter, sort, search]);

  if (ld) return <div style={{ textAlign: 'center', padding: 80, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>불러오는 중...</div>;
  if (!d) return <div style={{ textAlign: 'center', padding: 80 }}>⚠️ 로드 실패</div>;

  const { lifecycle: lc = {} as any, interests: ints = [], engagement: eng = {} as any } = d;
  const allUsers = d.users || [];
  const realAll = allUsers.filter((u: any) => !u.is_seed);
  const seedAll = allUsers.filter((u: any) => u.is_seed);
  const ghostCount = realAll.filter((u: any) => getActions(u) === 0).length;
  const active7d = realAll.filter((u: any) => u.last_active_at && (Date.now() - new Date(u.last_active_at).getTime()) < 7 * 86400000).length;

  // Status distribution
  const statusDist: Record<string, number> = {};
  for (const u of realAll) {
    const s = getUserStatus(u);
    statusDist[s.label] = (statusDist[s.label] || 0) + 1;
  }

  // Grade distribution
  const gradeMap: Record<number, number> = {};
  for (const u of realAll) gradeMap[u.grade || 1] = (gradeMap[u.grade || 1] || 0) + 1;
  const maxGrade = Math.max(...Object.values(gradeMap), 1);

  // Demographics
  const cityMap: Record<string, number> = {};
  const ageMap: Record<string, number> = {};
  const sourceMap: Record<string, number> = {};
  let onbRate = 0, profRate = 0, mktRate = 0;
  for (const u of realAll) {
    if (u.residence_city) cityMap[u.residence_city] = (cityMap[u.residence_city] || 0) + 1;
    if (u.age_group) ageMap[u.age_group] = (ageMap[u.age_group] || 0) + 1;
    if (u.signup_source) sourceMap[u.signup_source] = (sourceMap[u.signup_source] || 0) + 1;
    if (u.onboarded) onbRate++;
    if (u.profile_completed) profRate++;
    if (u.marketing_agreed) mktRate++;
  }
  const r = realAll.length || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* ═══ 1. 유저 라이프사이클 퍼널 ═══ */}
      <div style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>📊 유저 라이프사이클 (실유저 {realAll.length}명)</div>
        {[
          { l: '가입', v: realAll.length, c: '#3B82F6' },
          { l: '온보딩', v: onbRate, c: '#10B981' },
          { l: '프로필', v: profRate, c: '#8B5CF6' },
          { l: '활동 1+', v: realAll.length - ghostCount, c: '#F59E0B' },
          { l: '7일 활성', v: active7d, c: '#EC4899' },
        ].map((s, i, a) => {
          const pct = realAll.length > 0 ? (s.v / realAll.length * 100) : 0;
          return (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ minWidth: 48, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{s.l}</span>
              <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${Math.max(pct, 0.5)}%`, background: s.c, borderRadius: 3, transition: 'width .5s' }} />
                <span style={{ position: 'absolute', right: 4, top: 0, fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: '14px' }}>{pct.toFixed(0)}%</span>
              </div>
              <span style={{ minWidth: 28, textAlign: 'right', fontSize: 11, fontWeight: 700, color: s.c }}>{s.v}</span>
            </div>
          );
        })}
      </div>

      {/* ═══ 2. 상태 분포 + 등급 분포 나란히 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {/* 상태 분포 */}
        <div style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, padding: '6px 8px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>유저 상태</div>
          {Object.entries(statusDist).map(([label, count]) => {
            const colors: Record<string, string> = { '활성':'#10B981', '최근':'#3B82F6', '이완':'#8B5CF6', '유령':'#F59E0B', '이탈':'#EF4444', '휴면':'#6B7280' };
            return (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
                <span style={{ color: colors[label] || '#999' }}>● {label}</span>
                <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{count}</span>
              </div>
            );
          })}
        </div>
        {/* 등급 분포 */}
        <div style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, padding: '6px 8px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>등급 분포</div>
          {Object.entries(gradeMap).sort((a, b) => Number(a[0]) - Number(b[0])).map(([g, c]) => {
            const gl = gLabel[Number(g)] || gLabel[1];
            return (
              <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                <span style={{ fontSize: 9, color: gl.c, minWidth: 24, fontWeight: 600 }}>{gl.n}</span>
                <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(c / maxGrade) * 100}%`, background: gl.c, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', minWidth: 16, textAlign: 'right' }}>{c}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ 3. 가입경로 + 지역 + 나이 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
        {[
          { t: '가입경로', data: Object.entries(sourceMap).sort((a, b) => b[1] - a[1]).slice(0, 6), fmt: (k: string) => srcLabel[k] || k },
          { t: '지역 TOP5', data: Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 5), fmt: (k: string) => k },
          { t: '나이대', data: Object.entries(ageMap).sort((a, b) => b[1] - a[1]), fmt: (k: string) => aLabel[k] || k },
        ].map(sec => (
          <div key={sec.t} style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, padding: '6px 8px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>{sec.t}</div>
            {sec.data.length > 0 ? sec.data.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, padding: '1px 0' }}>
                <span style={{ color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{sec.fmt(k)}</span>
                <span style={{ fontWeight: 700, color: '#E2E8F0' }}>{v}</span>
              </div>
            )) : <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)' }}>미설정</div>}
          </div>
        ))}
      </div>

      {/* ═══ 4. 참여 지표 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 3 }}>
        {[
          { l: '온보딩', v: `${(onbRate/r*100).toFixed(0)}%`, c: onbRate/r > 0.7 },
          { l: '프로필', v: `${(profRate/r*100).toFixed(0)}%`, c: profRate/r > 0.5 },
          { l: '마케팅', v: `${(mktRate/r*100).toFixed(0)}%`, c: mktRate/r > 0.3 },
          { l: '이메일', v: eng.emailSubs || 0, c: (eng.emailSubs||0) > 0 },
          { l: '북마크', v: eng.bookmarks || 0, c: (eng.bookmarks||0) > 0 },
          { l: 'PWA', v: eng.pwaInstalls || 0, c: (eng.pwaInstalls||0) > 0 },
        ].map(k => (
          <div key={k.l} style={{ textAlign: 'center', background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '4px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: k.c ? '#10B981' : 'rgba(255,255,255,0.12)', lineHeight: 1 }}>{k.v}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* ═══ 5. 검색 + 필터 + 정렬 ═══ */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
        <input
          type="text" placeholder="🔍 이름·경로·지역" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, padding: '5px 8px', fontSize: 11, borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', color: '#E2E8F0', outline: 'none' }}
        />
        <select value={sort} onChange={e => setSort(e.target.value as Sort)}
          style={{ padding: '5px 4px', fontSize: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(12,21,40,0.65)', color: 'rgba(255,255,255,0.5)', outline: 'none' }}>
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="active">최근활동</option>
          <option value="points">포인트</option>
          <option value="engagement">활동량</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {([
          ['all', `전체 ${allUsers.length}`],
          ['real', `실유저 ${realAll.length}`],
          ['active7d', `활성 ${active7d}`],
          ['ghost', `유령 ${ghostCount}`],
          ['seed', `시드 ${seedAll.length}`],
        ] as const).map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            flex: 1, padding: '4px 0', fontSize: 9, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: filter === f ? 'rgba(59,123,246,0.15)' : 'rgba(255,255,255,0.03)',
            color: filter === f ? '#3B7BF6' : 'rgba(255,255,255,0.2)',
          }}>{l}</button>
        ))}
      </div>

      {/* ═══ 6. 유저 카드 목록 ═══ */}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'right' }}>{users.length}명 표시</div>
      {users.map((u: any) => {
        const g = gLabel[u.grade || 1] || gLabel[1];
        const st = getUserStatus(u);
        const actions = getActions(u);
        const isExpanded = expanded === u.id;
        return (
          <div key={u.id} onClick={() => setExpanded(isExpanded ? null : u.id)} style={{
            background: u.is_seed ? 'rgba(107,114,128,0.04)' : 'rgba(12,21,40,0.65)',
            borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
            border: `1px solid ${st.label === '활성' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)'}`,
            opacity: u.is_seed ? 0.6 : 1,
          }}>
            {/* Row 1: 이름 + 상태 + 메타 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: u.is_seed ? '#9CA3AF' : '#E2E8F0' }}>{u.nickname}</span>
              <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: st.bg, color: st.color, fontWeight: 700 }}>{st.label}</span>
              {!u.is_seed && <span style={{ fontSize: 9, color: g.c, fontWeight: 600 }}>{g.n}</span>}
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>{pIcon[u.provider]||'🔑'}</span>
              <div style={{ flex: 1 }} />
              {/* 활동 요약 — 한눈에 */}
              {!u.is_seed && (
                <span style={{ fontSize: 9, color: actions > 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)' }}>
                  {actions > 0 ? `${actions}활동` : '0활동'}
                </span>
              )}
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)' }}>{fmt(u.created_at)}</span>
              {u.last_active_at && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.1)' }}>→{ago(u.last_active_at)}</span>}
            </div>

            {/* Row 2: 태그 (compact) */}
            {!u.is_seed && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
                <Badge ok={u.onboarded} label="온보딩" />
                <Badge ok={u.profile_completed} label="프로필" />
                {u.signup_source && <Tag text={srcLabel[u.signup_source] || u.signup_source} color="#8B5CF6" bg="rgba(139,92,246,0.08)" />}
                {u.residence_city && <Tag text={`📍${u.residence_city}`} color="#3B82F6" bg="rgba(59,123,246,0.06)" />}
                {u.age_group && <Tag text={aLabel[u.age_group]||u.age_group} />}
                {u.streak_days > 0 && <Tag text={`🔥${u.streak_days}일`} color="#EF4444" bg="rgba(239,68,68,0.06)" />}
                {u.points > 0 && <Tag text={`💰${u.points}P`} color="#F59E0B" bg="rgba(245,158,11,0.06)" />}
              </div>
            )}

            {/* Expanded: 활동 상세 */}
            {isExpanded && !u.is_seed && (
              <div style={{ marginTop: 6, padding: '6px 0 2px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, marginBottom: 4 }}>
                  {[
                    { i: '📝', v: u.posts_count||0, l: '글' },
                    { i: '💬', v: u.comments_count||0, l: '댓글' },
                    { i: '⭐', v: u.watchlist_count||0, l: '종목' },
                    { i: '🏠', v: u.apt_bm_count||0, l: '단지' },
                    { i: '📌', v: u.blog_bm_count||0, l: '저장' },
                    { i: '📅', v: u.attendance_count||0, l: '출석' },
                    { i: '💰', v: u.points||0, l: 'P' },
                    { i: '⚡', v: u.influence_score||0, l: '영향력' },
                  ].map(s => (
                    <div key={s.l} style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 9 }}>{s.i}</span>
                      <div style={{ fontSize: 11, fontWeight: 800, color: s.v > 0 ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }}>{s.v}</div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>{s.l}</div>
                    </div>
                  ))}
                </div>
                {u.interests?.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {(u.interests as string[]).map((i: string) => <Tag key={i} text={iLabel[i]||i} />)}
                  </div>
                )}
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)', marginTop: 4 }}>
                  가입: {fmtFull(u.created_at)} · 마지막: {u.last_active_at ? fmtFull(u.last_active_at) : '없음'}
                  {u.birth_year && ` · 출생: ${u.birth_year}`}
                  {u.gender && ` · ${u.gender === 'male' ? '남' : u.gender === 'female' ? '여' : u.gender}`}
                  {u.marketing_agreed && ' · 마케팅✓'}
                  {u.is_premium && ' · 프리미엄'}
                </div>

                {/* s186: 상세 패널 — 포인트 이력 / 활동 로그 / 최근 글 (server fetch 1회 캐시) */}
                {(() => {
                  const dt = detail[u.id];
                  if (!dt) return null;
                  if (dt.loading) {
                    return <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>상세 불러오는 중…</div>;
                  }
                  if (!dt.data || dt.data.error) {
                    return <div style={{ marginTop: 6, fontSize: 10, color: '#EF4444' }}>상세 로드 실패</div>;
                  }
                  const { pointHistory = [], recentEvents = [], recentPosts = [] } = dt.data;
                  const subSec: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: 8, marginBottom: 3, letterSpacing: 0.3 };
                  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 9, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' };
                  return (
                    <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.04)' }}>
                      <div style={subSec}>💰 포인트 이력 ({pointHistory.length})</div>
                      {pointHistory.length === 0 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)' }}>없음</div>}
                      {pointHistory.map((p: any, i: number) => (
                        <div key={i} style={row}>
                          <span style={{ color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.reason || '—'}</span>
                          <span style={{ color: (p.amount || 0) >= 0 ? '#10B981' : '#EF4444', fontWeight: 700, flexShrink: 0 }}>{(p.amount || 0) >= 0 ? '+' : ''}{p.amount}P</span>
                          <span style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }}>{ago(p.created_at)}</span>
                        </div>
                      ))}

                      <div style={subSec}>⚡ 활동 로그 ({recentEvents.length})</div>
                      {recentEvents.length === 0 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)' }}>없음</div>}
                      {recentEvents.map((e: any, i: number) => (
                        <div key={i} style={row}>
                          <span style={{ color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{e.event_name}</span>
                          <span style={{ color: 'rgba(255,255,255,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.page_path}</span>
                          <span style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }}>{ago(e.created_at)}</span>
                        </div>
                      ))}

                      <div style={subSec}>📝 최근 글 ({recentPosts.length})</div>
                      {recentPosts.length === 0 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)' }}>없음</div>}
                      {recentPosts.map((p: any) => (
                        <div key={p.id} style={row}>
                          <span style={{ color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.title}</span>
                          {p.category && <Tag text={p.category} />}
                          <span style={{ color: '#F59E0B', flexShrink: 0 }}>♥{p.likes_count ?? 0}</span>
                          <span style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }}>{ago(p.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}

      {users.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>조건에 맞는 유저가 없습니다</div>}

      {/* ═══ 7. 관심 등록 ═══ */}
      {ints.length > 0 && <>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#E2E8F0', marginTop: 4 }}>❤️ 관심 등록 ({ints.length})</div>
        {ints.map((i: any, idx: number) => (
          <div key={idx} style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
            <div><span style={{ color: '#E2E8F0', fontWeight: 600 }}>{i.siteName}</span><span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>{i.siteRegion}</span></div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {i.notification_enabled && <span style={{ fontSize: 10, color: '#10B981' }}>🔔</span>}
              <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10 }}>{ago(i.created_at)}</span>
            </div>
          </div>
        ))}
      </>}
    </div>
  );
}
