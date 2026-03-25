'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════
   🎛️ KADEORA MISSION CONTROL — 올인원 어드민 대시보드
   단일 페이지로 전체 시스템 관리
═══════════════════════════════════════════════════════════ */

// ── Types ──
interface KPI { users: number; posts: number; blogs: number; stocks: number; subscriptions: number; sites: number; interests: number; unsold: number; redev: number; trades: number; discussions: number; pendingReports: number; newUsersWeek: number; activeUsersWeek: number }
interface DailyStat { date: string; new_users: number; new_posts: number; page_views: number; [key: string]: any }
interface UserRow { id: string; nickname: string; full_name: string | null; grade: number; grade_title: string; provider: string | null; created_at: string; last_active_at: string | null; posts_count: number; likes_count: number; points: number; is_admin: boolean | null; is_banned: boolean | null; is_deleted: boolean | null; is_seed: boolean | null; is_premium: boolean; premium_expires_at: string | null; region_text: string | null; residence_city: string | null; bio: string | null; interests: string[] | null; influence_score: number; streak_days: number; followers_count: number; following_count: number; kakao_id: string | null; google_email: string | null; phone: string | null; age_group: string | null; gender: string | null; onboarded: boolean | null; profile_completed: boolean; marketing_agreed: boolean | null; consent_analytics: boolean | null; nickname_change_count: number }

// ── Palette ──
const C = {
  bg: '#050A18', surface: '#0B1425', card: '#0F1A2E', cardHover: '#132240',
  border: '#1B2B45', borderLight: '#243555',
  brand: '#3B82F6', brandDim: '#1E3A5F', brandBg: '#3B82F620',
  green: '#10B981', greenBg: '#10B98118', red: '#EF4444', redBg: '#EF444418',
  yellow: '#F59E0B', yellowBg: '#F59E0B18', purple: '#8B5CF6', purpleBg: '#8B5CF618',
  cyan: '#06B6D4', cyanBg: '#06B6D418',
  text: '#E2E8F0', textSec: '#94A3B8', textDim: '#64748B', textInv: '#0F172A',
};
const GRADE_EMOJI: Record<number, string> = {1:'🌱',2:'🌿',3:'🍀',4:'🌸',5:'🌻',6:'⭐',7:'🔥',8:'💎',9:'👑',10:'🚀'};
const PROVIDER_LABEL: Record<string, string> = { kakao: '카카오', google: '구글', email: '이메일', apple: '애플' };

// ── Sections ──
type Section = 'dashboard' | 'users' | 'content' | 'blog' | 'realestate' | 'system' | 'reports' | 'godmode';
const SECTIONS: { key: Section; icon: string; label: string }[] = [
  { key: 'dashboard', icon: '📊', label: '대시보드' },
  { key: 'users', icon: '👤', label: '유저 관리' },
  { key: 'content', icon: '📝', label: '콘텐츠' },
  { key: 'blog', icon: '✍️', label: '블로그' },
  { key: 'realestate', icon: '🏢', label: '부동산' },
  { key: 'system', icon: '⚙️', label: '시스템' },
  { key: 'reports', icon: '🚨', label: '신고/결제' },
  { key: 'godmode', icon: '⚡', label: 'GOD MODE' },
];

// ── Helpers ──
const ago = (d: string | null) => {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 2592000) return `${Math.floor(s / 86400)}일 전`;
  return new Date(d).toLocaleDateString('ko-KR');
};
const fmt = (n: number) => n >= 10000 ? `${(n/10000).toFixed(1)}만` : n >= 1000 ? `${(n/1000).toFixed(1)}천` : String(n);
const dateStr = (d: string | null) => d ? new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

// ── Reusable Components ──
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: active ? C.brand : C.card, color: active ? '#fff' : C.textSec, transition: 'all .15s' }}>{children}</button>;
}
function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${color}20`, color }}>{children}</span>;
}
function KPICard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center', transition: 'border-color .15s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, color: C.textDim, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>{typeof value === 'number' ? fmt(value) : value}</div>
        {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}
function DataTable({ headers, rows, onRowClick }: { headers: string[]; rows: any[][]; onRowClick?: (i: number) => void }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${C.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>{headers.map((h, i) => <th key={i} style={{ padding: '10px 12px', textAlign: 'left', background: C.card, color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} onClick={() => onRowClick?.(ri)}
              style={{ cursor: onRowClick ? 'pointer' : 'default', transition: 'background .1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = C.cardHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {row.map((cell, ci) => <td key={ci} style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}08`, color: C.text, whiteSpace: 'nowrap' }}>{cell}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={headers.length} style={{ padding: 30, textAlign: 'center', color: C.textDim }}>데이터 없음</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
function Spinner() { return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.brand, borderRadius: '50%', animation: 'spin .6s linear infinite' }} /></div>; }

// ══════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════
export default function MissionControl() {
  const [section, setSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .5 } }
        * { scrollbar-width: thin; scrollbar-color: ${C.border} transparent; }
        *::-webkit-scrollbar { width: 6px; height: 6px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        input, select { outline: none; }
        input:focus, select:focus { border-color: ${C.brand} !important; }
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarOpen ? 220 : 60, minHeight: '100vh', background: C.surface, borderRight: `1px solid ${C.border}`,
        transition: 'width .2s', overflow: 'hidden', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ padding: sidebarOpen ? '20px 16px 12px' : '20px 12px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {sidebarOpen && <div style={{ fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>🎛️ Mission Control</div>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18, padding: 4 }}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav style={{ padding: sidebarOpen ? '4px 8px' : '4px' }}>
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setSection(s.key)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: sidebarOpen ? '10px 12px' : '10px 0',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2, fontSize: 13, fontWeight: 600,
              background: section === s.key ? C.brandBg : 'transparent',
              color: section === s.key ? C.brand : C.textSec,
              transition: 'all .15s',
            }}>
              <span style={{ fontSize: 17 }}>{s.icon}</span>
              {sidebarOpen && <span>{s.label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, padding: 'clamp(16px, 2vw, 28px)', overflow: 'auto', animation: 'fadeIn .3s ease' }}>
        {section === 'dashboard' && <DashboardSection />}
        {section === 'users' && <UsersSection />}
        {section === 'content' && <ContentSection />}
        {section === 'blog' && <BlogSection />}
        {section === 'realestate' && <RealEstateSection />}
        {section === 'system' && <SystemSection />}
        {section === 'reports' && <ReportsSection />}
        {section === 'godmode' && <GodModeSection />}
      </main>
    </div>
  );
}

// ══════════════════════════════════════
// 📊 DASHBOARD
// ══════════════════════════════════════
function DashboardSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard?section=overview').then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <div style={{ color: C.red }}>로드 실패</div>;

  const { kpi, recentUsers, payments, dailyStats, cron } = data;

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 24px' }}>📊 대시보드</h1>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KPICard icon="👤" label="전체 유저" value={kpi.users} sub={`이번주 +${kpi.newUsersWeek}`} color={C.brand} />
        <KPICard icon="🟢" label="주간 활성" value={kpi.activeUsersWeek} color={C.green} />
        <KPICard icon="📝" label="게시글" value={kpi.posts} color={C.cyan} />
        <KPICard icon="✍️" label="블로그" value={kpi.blogs} color={C.purple} />
        <KPICard icon="📈" label="주식 종목" value={kpi.stocks} color={C.green} />
        <KPICard icon="🏠" label="청약 현장" value={kpi.subscriptions} color={C.yellow} />
        <KPICard icon="🏢" label="SEO 현장" value={kpi.sites} sub={`관심 ${kpi.interests}건`} color={C.brand} />
        <KPICard icon="🏗️" label="재개발" value={kpi.redev} color={C.cyan} />
        <KPICard icon="📉" label="미분양" value={kpi.unsold} color={C.red} />
        <KPICard icon="💰" label="실거래" value={kpi.trades} color={C.green} />
        <KPICard icon="💬" label="토론" value={kpi.discussions} color={C.purple} />
        <KPICard icon="🚨" label="미처리 신고" value={kpi.pendingReports} color={kpi.pendingReports > 0 ? C.red : C.green} />
      </div>

      {/* Cron Health Bar */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 15 }}>⚡</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 4 }}>24시간 크론 실행</div>
          <div style={{ height: 8, borderRadius: 4, background: C.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, background: cron.fail > 0 ? `linear-gradient(90deg, ${C.green} ${(cron.success / (cron.total || 1)) * 100}%, ${C.red} 0)` : C.green, width: '100%', transition: 'width .5s' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>✓ {cron.success}</span>
          <span style={{ fontSize: 13, color: cron.fail > 0 ? C.red : C.textDim, fontWeight: 700 }}>✗ {cron.fail}</span>
        </div>
      </div>

      {/* Recent Users + Daily Stats side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent Users */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>최근 가입</h3>
          {(recentUsers || []).map((u: any) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}08` }}>
              <span style={{ fontSize: 16 }}>{GRADE_EMOJI[u.grade] || '🌱'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{u.nickname} {u.is_seed && <Badge color={C.textDim}>시드</Badge>}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{PROVIDER_LABEL[u.provider] || u.provider || '—'} · {u.region_text || '미설정'}</div>
              </div>
              <div style={{ fontSize: 11, color: C.textDim }}>{ago(u.created_at)}</div>
            </div>
          ))}
        </div>

        {/* Daily Stats Chart (Mini) */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>일일 통계 (14일)</h3>
          <MiniChart data={(dailyStats || []).reverse()} />
        </div>
      </div>
    </div>
  );
}

function MiniChart({ data }: { data: DailyStat[] }) {
  if (!data.length) return <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', padding: 20 }}>데이터 없음</div>;
  const maxPV = Math.max(...data.map(d => d.page_views || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
      {data.map((d, i) => {
        const h = Math.max(((d.page_views || 0) / maxPV) * 90, 4);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', height: h, borderRadius: 3, background: `linear-gradient(180deg, ${C.brand}, ${C.brandDim})`, transition: 'height .3s' }}
              title={`${d.date}: PV ${d.page_views || 0}`} />
            {i % 3 === 0 && <span style={{ fontSize: 9, color: C.textDim }}>{d.date?.slice(5)}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════
// 👤 USERS
// ══════════════════════════════════════
function UsersSection() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const searchTimeout = useRef<any>(null);

  const load = useCallback((p = 1, s = search, f = filter) => {
    setLoading(true);
    fetch(`/api/admin/dashboard?section=users&page=${p}&search=${encodeURIComponent(s)}&filter=${f}`)
      .then(r => r.json()).then(d => { setUsers(d.users ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [search, filter]);

  useEffect(() => { load(1); }, [filter]); // eslint-disable-line

  const doSearch = (val: string) => {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setPage(1); load(1, val, filter); }, 400);
  };

  const userAction = async (id: string, action: string) => {
    const msg = action === 'ban' ? '정지하시겠습니까?' : action === 'unban' ? '정지 해제하시겠습니까?' : action === 'makeAdmin' ? '관리자로 변경하시겠습니까?' : '삭제하시겠습니까?';
    if (!confirm(msg)) return;
    await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    load(page);
    if (selected?.id === id) setSelected(null);
  };

  const setPoints = async (id: string, current: number) => {
    const val = prompt('새 포인트 값', String(current));
    if (val === null) return;
    await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setPoints', points: parseInt(val) }) });
    load(page);
  };

  const filters = [
    { key: 'all', label: '전체' }, { key: 'real', label: '실유저' }, { key: 'seed', label: '시드' },
    { key: 'premium', label: '프리미엄' }, { key: 'banned', label: '정지' }, { key: 'admin', label: '관리자' },
  ];

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 20px' }}>👤 유저 관리 <span style={{ fontSize: 14, color: C.textDim, fontWeight: 400 }}>({fmt(total)}명)</span></h1>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => doSearch(e.target.value)} placeholder="닉네임 / 이름 검색..."
          style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, width: 240, fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {filters.map(f => <Pill key={f.key} active={filter === f.key} onClick={() => { setFilter(f.key); setPage(1); }}>{f.label}</Pill>)}
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ display: 'flex', gap: 16 }}>
          {/* User List */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <DataTable
              headers={['', '닉네임', '등급', '가입경로', '지역', '포인트', '게시글', '가입일', '최근활동', '상태']}
              rows={users.map(u => [
                GRADE_EMOJI[u.grade] || '🌱',
                <span key="n" style={{ fontWeight: 600 }}>{u.nickname}</span>,
                u.grade_title,
                <Badge key="p" color={C.brand}>{PROVIDER_LABEL[u.provider || ''] || u.provider || '—'}</Badge>,
                u.region_text || u.residence_city || '—',
                <span key="pt" style={{ color: C.yellow, fontWeight: 600 }}>{fmt(u.points)}</span>,
                u.posts_count,
                dateStr(u.created_at),
                ago(u.last_active_at),
                u.is_banned ? <Badge key="b" color={C.red}>정지</Badge> : u.is_seed ? <Badge key="s" color={C.textDim}>시드</Badge> : u.is_premium ? <Badge key="pr" color={C.purple}>프리미엄</Badge> : <Badge key="a" color={C.green}>활성</Badge>,
              ])}
              onRowClick={(i) => setSelected(users[i])}
            />
            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }}
                style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>← 이전</button>
              <span style={{ padding: '6px 14px', color: C.textSec, fontSize: 13 }}>{page} / {Math.ceil(total / 50) || 1}</span>
              <button disabled={page * 50 >= total} onClick={() => { setPage(page + 1); load(page + 1); }}
                style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: page * 50 >= total ? 'not-allowed' : 'pointer', opacity: page * 50 >= total ? 0.4 : 1 }}>다음 →</button>
            </div>
          </div>

          {/* User Detail Panel */}
          {selected && (
            <div style={{ width: 340, flexShrink: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, alignSelf: 'flex-start', position: 'sticky', top: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{GRADE_EMOJI[selected.grade]} {selected.nickname}</h3>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                {[
                  ['ID', selected.id.slice(0, 8) + '...'],
                  ['실명', selected.full_name || '—'],
                  ['등급', `${selected.grade_title} (Lv.${selected.grade})`],
                  ['가입경로', PROVIDER_LABEL[selected.provider || ''] || '—'],
                  ['카카오ID', selected.kakao_id || '—'],
                  ['구글', selected.google_email || '—'],
                  ['전화번호', selected.phone || '—'],
                  ['지역', selected.region_text || selected.residence_city || '—'],
                  ['성별', selected.gender || '—'],
                  ['연령대', selected.age_group || '—'],
                  ['포인트', `${fmt(selected.points)}P`],
                  ['영향력', String(selected.influence_score)],
                  ['연속출석', `${selected.streak_days}일`],
                  ['팔로워/잉', `${selected.followers_count}/${selected.following_count}`],
                  ['게시글', String(selected.posts_count)],
                  ['좋아요', String(selected.likes_count)],
                  ['닉변횟수', String(selected.nickname_change_count)],
                  ['프로필완성', selected.profile_completed ? '✅' : '❌'],
                  ['온보딩', selected.onboarded ? '✅' : '❌'],
                  ['마케팅동의', selected.marketing_agreed ? '✅' : '❌'],
                  ['분석동의', selected.consent_analytics ? '✅' : '❌'],
                  ['프리미엄', selected.is_premium ? `✅ (~${dateStr(selected.premium_expires_at)})` : '❌'],
                  ['가입일', dateStr(selected.created_at)],
                  ['최근활동', ago(selected.last_active_at)],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <div style={{ color: C.textDim, marginBottom: 2 }}>{l}</div>
                    <div style={{ color: C.text, fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>

              {selected.bio && <div style={{ marginTop: 12, padding: 10, background: C.surface, borderRadius: 8, fontSize: 12, color: C.textSec }}>{selected.bio}</div>}
              {selected.interests && selected.interests.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {selected.interests.map(i => <Badge key={i} color={C.brand}>{i}</Badge>)}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
                <button onClick={() => setPoints(selected.id, selected.points)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: C.yellow, color: C.textInv, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>포인트 변경</button>
                {selected.is_banned
                  ? <button onClick={() => userAction(selected.id, 'unban')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: C.green, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>정지 해제</button>
                  : <button onClick={() => userAction(selected.id, 'ban')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: C.red, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>정지</button>
                }
                {!selected.is_admin && <button onClick={() => userAction(selected.id, 'makeAdmin')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: C.purple, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>관리자 부여</button>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
// 📝 CONTENT
// ══════════════════════════════════════
function ContentSection() {
  const [tab, setTab] = useState<'posts' | 'comments' | 'discuss' | 'chat'>('posts');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback((t = tab, p = 1) => {
    setLoading(true);
    fetch(`/api/admin/dashboard?section=content&tab=${t}&page=${p}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(tab, 1); setPage(1); }, [tab]); // eslint-disable-line

  const deletePost = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/admin/posts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_deleted: true }) });
    load(tab, page);
  };

  const deleteComment = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/admin/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_deleted: true }) });
    load(tab, page);
  };

  const tabs = [
    { key: 'posts' as const, label: '게시글', icon: '📝' },
    { key: 'comments' as const, label: '댓글', icon: '💬' },
    { key: 'discuss' as const, label: '토론', icon: '🗳️' },
    { key: 'chat' as const, label: '채팅', icon: '💭' },
  ];

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 20px' }}>📝 콘텐츠 관리</h1>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {tabs.map(t => <Pill key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>{t.icon} {t.label}</Pill>)}
      </div>

      {loading ? <Spinner /> : (
        <>
          {tab === 'posts' && (
            <DataTable
              headers={['제목', '카테고리', '작성자', '조회', '좋아요', '댓글', '작성일', '삭제']}
              rows={(data?.posts ?? []).map((p: any) => [
                <span key="t" style={{ fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{p.title || '(제목 없음)'}</span>,
                <Badge key="c" color={C.cyan}>{p.category}</Badge>,
                p.profiles?.nickname || '—',
                p.view_count || 0,
                p.likes_count || 0,
                p.comments_count || 0,
                ago(p.created_at),
                p.is_deleted ? <Badge key="d" color={C.red}>삭제됨</Badge> : <button key="del" onClick={() => deletePost(p.id)} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.redBg, color: C.red, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>삭제</button>,
              ])}
            />
          )}
          {tab === 'comments' && (
            <DataTable
              headers={['내용', '작성자', '작성일', '삭제']}
              rows={(data?.comments ?? []).map((c: any) => [
                <span key="co" style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', whiteSpace: 'nowrap' }}>{c.content}</span>,
                c.profiles?.nickname || '—',
                ago(c.created_at),
                c.is_deleted ? <Badge key="d" color={C.red}>삭제됨</Badge> : <button key="del" onClick={() => deleteComment(c.id)} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.redBg, color: C.red, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>삭제</button>,
              ])}
            />
          )}
          {tab === 'discuss' && (
            <DataTable
              headers={['제목', '카테고리', 'A vs B', '투표', '댓글', '조회', '🔥', '작성일']}
              rows={(data?.discussions ?? []).map((d: any) => [
                d.title,
                <Badge key="c" color={C.purple}>{d.category}</Badge>,
                `${d.option_a} vs ${d.option_b}`,
                (d.vote_a || 0) + (d.vote_b || 0),
                d.comment_count || 0,
                d.view_count || 0,
                d.is_hot ? '🔥' : '',
                ago(d.created_at),
              ])}
            />
          )}
          {tab === 'chat' && (
            <DataTable
              headers={['내용', '작성자', '시간']}
              rows={(data?.messages ?? []).map((m: any) => [
                <span key="co" style={{ maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{m.content}</span>,
                m.profiles?.nickname || '—',
                ago(m.created_at),
              ])}
            />
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════
// ✍️ BLOG
// ══════════════════════════════════════
function BlogSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/dashboard?section=blog').then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  const runCron = async (path: string, label: string) => {
    setRunning(label);
    try {
      const cronSecret = ''; // god-mode 경유
      await fetch(`/api/admin/god-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', endpoint: path }),
      });
      alert(`${label} 실행 완료`);
    } catch { alert('실행 실패'); }
    finally { setRunning(null); }
  };

  if (loading) return <Spinner />;

  const blog = data?.blog ?? {};
  const rewritePct = blog.total > 0 ? Math.round((blog.rewritten / blog.total) * 100) : 0;

  const CRON_BTNS = [
    { label: '주식 시황', path: '/api/cron/blog-daily', icon: '📈' },
    { label: '청약/미분양', path: '/api/cron/blog-apt-new', icon: '🏠' },
    { label: '대장 아파트', path: '/api/cron/blog-apt-landmark', icon: '🏢' },
    { label: '재개발', path: '/api/cron/blog-redevelopment', icon: '🏗️' },
    { label: '가이드', path: '/api/cron/blog-seed-guide', icon: '📖' },
    { label: '리라이트', path: '/api/cron/blog-rewrite', icon: '✨' },
    { label: '시리즈 배정', path: '/api/cron/blog-series-assign', icon: '📚' },
    { label: '발행 큐', path: '/api/cron/blog-publish-queue', icon: '🚀' },
  ];

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 20px' }}>✍️ 블로그 관리</h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KPICard icon="📄" label="전체 블로그" value={blog.total} color={C.brand} />
        <KPICard icon="👁" label="총 조회수" value={blog.totalViews} color={C.cyan} />
        <KPICard icon="✨" label="리라이팅" value={`${rewritePct}%`} sub={`${blog.rewritten}/${blog.total}`} color={C.green} />
        <KPICard icon="📝" label="미리라이팅" value={blog.unrewritten} color={C.yellow} />
      </div>

      {/* Category breakdown */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>카테고리별 분포</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(blog.byCat || {}).sort(([, a], [, b]) => (b as number) - (a as number)).map(([cat, cnt]) => (
            <div key={cat} style={{ padding: '8px 14px', background: C.surface, borderRadius: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: C.text }}>{cat}</span>
              <span style={{ color: C.textDim, marginLeft: 6 }}>{fmt(cnt as number)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rewrite Progress Bar */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>리라이팅 진행률</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{rewritePct}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: C.border, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 5, background: `linear-gradient(90deg, ${C.green}, ${C.brand})`, width: `${rewritePct}%`, transition: 'width .5s' }} />
        </div>
      </div>

      {/* Cron Buttons */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>블로그 크론 실행</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {CRON_BTNS.map(b => (
            <button key={b.path} onClick={() => runCron(b.path, b.label)} disabled={running !== null}
              style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: running === b.label ? C.brandBg : C.surface, color: C.text, fontSize: 12, fontWeight: 600, cursor: running ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{b.icon}</span> {running === b.label ? '실행중...' : b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent blogs */}
      <DataTable
        headers={['제목', '카테고리', '조회', '리라이팅', '작성일']}
        rows={(data?.recentBlogs ?? []).map((b: any) => [
          <span key="t" style={{ maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', fontWeight: 500 }}>{b.title}</span>,
          <Badge key="c" color={C.purple}>{b.category}</Badge>,
          b.view_count || 0,
          b.rewritten_at ? <Badge key="r" color={C.green}>완료</Badge> : <Badge key="r" color={C.yellow}>대기</Badge>,
          ago(b.created_at),
        ])}
      />
    </div>
  );
}

// ══════════════════════════════════════
// 🏢 REAL ESTATE
// ══════════════════════════════════════
function RealEstateSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sites' | 'subscriptions' | 'unsold' | 'redev' | 'interests'>('sites');

  useEffect(() => {
    fetch('/api/admin/dashboard?section=realestate').then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const tabs = [
    { key: 'sites' as const, label: `SEO 현장 (${data?.sites?.length || 0})`, icon: '🏢' },
    { key: 'subscriptions' as const, label: `청약 (${data?.subscriptions?.length || 0})`, icon: '📋' },
    { key: 'unsold' as const, label: `미분양 (${data?.unsold?.length || 0})`, icon: '📉' },
    { key: 'redev' as const, label: `재개발 (${data?.redevelopment?.length || 0})`, icon: '🏗️' },
    { key: 'interests' as const, label: `관심고객 (${data?.interests?.length || 0})`, icon: '❤️' },
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
          rows={(data?.unsold ?? []).map((u: any) => [
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
function SystemSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  const load = useCallback((h = hours) => {
    setLoading(true);
    fetch(`/api/admin/dashboard?section=system&hours=${h}`).then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [hours]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  if (loading) return <Spinner />;

  const crons: any[] = data?.crons ?? [];
  const totalRuns = data?.totalRuns ?? 0;
  const successRate = totalRuns > 0 ? Math.round((crons.reduce((s, c) => s + c.success, 0) / totalRuns) * 100) : 100;

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0 }}>⚙️ 시스템</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {[6, 12, 24, 48].map(h => <Pill key={h} active={hours === h} onClick={() => { setHours(h); load(h); }}>{h}시간</Pill>)}
        </div>
      </div>

      {/* Health Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPICard icon="🔄" label="총 실행" value={totalRuns} color={C.brand} />
        <KPICard icon="✅" label="성공률" value={`${successRate}%`} color={successRate >= 90 ? C.green : C.yellow} />
        <KPICard icon="❌" label="실패 크론" value={crons.filter(c => c.failed > 0).length} color={C.red} />
      </div>

      {/* Cron Table */}
      <DataTable
        headers={['크론', '실행', '성공', '실패', '평균시간', '마지막 실행', '상태', '에러']}
        rows={crons.map(c => [
          <span key="n" style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{c.name}</span>,
          c.runs,
          <span key="s" style={{ color: C.green }}>{c.success}</span>,
          <span key="f" style={{ color: c.failed > 0 ? C.red : C.textDim, fontWeight: c.failed > 0 ? 700 : 400 }}>{c.failed}</span>,
          c.avgDuration ? `${(c.avgDuration / 1000).toFixed(1)}s` : '—',
          ago(c.lastRun),
          c.lastStatus === 'success' ? <Badge key="st" color={C.green}>OK</Badge> : <Badge key="st" color={C.red}>FAIL</Badge>,
          c.lastError ? <span key="e" style={{ color: C.red, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{c.lastError}</span> : '—',
        ])}
      />
    </div>
  );
}

// ══════════════════════════════════════
// 🚨 REPORTS & PAYMENTS
// ══════════════════════════════════════
function ReportsSection() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard?section=reports').then(r => r.json()).then(d => setReports(d.reports ?? [])).finally(() => setLoading(false));
  }, []);

  const action = async (id: number, act: string) => {
    await fetch(`/api/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act }) });
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: act === 'resolve' ? 'resolved' : 'dismissed' } : r));
  };

  if (loading) return <Spinner />;

  const pending = reports.filter(r => r.status === 'pending');
  const resolved = reports.filter(r => r.status !== 'pending');

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 20px' }}>🚨 신고 관리 <span style={{ fontSize: 14, color: C.textDim, fontWeight: 400 }}>({pending.length}건 미처리)</span></h1>

      <DataTable
        headers={['사유', '상세', '유형', '신고자', '상태', '신고일', '조치']}
        rows={reports.map(r => [
          r.reason,
          <span key="d" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{r.details || '—'}</span>,
          <Badge key="t" color={C.cyan}>{r.content_type}</Badge>,
          r.profiles?.nickname || '—',
          r.status === 'pending' ? <Badge key="s" color={C.yellow}>미처리</Badge> : r.status === 'resolved' ? <Badge key="s" color={C.green}>처리</Badge> : <Badge key="s" color={C.textDim}>기각</Badge>,
          ago(r.created_at),
          r.status === 'pending' ? (
            <div key="a" style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => action(r.id, 'resolve')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.greenBg, color: C.green, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>처리</button>
              <button onClick={() => action(r.id, 'dismiss')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.redBg, color: C.red, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>기각</button>
            </div>
          ) : '—',
        ])}
      />
    </div>
  );
}

// ══════════════════════════════════════
// ⚡ GOD MODE
// ══════════════════════════════════════
function GodModeSection() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<string>('full');
  const timerRef = useRef<any>(null);

  const run = async (m: string) => {
    setRunning(true);
    setResults([]);
    setElapsed(0);
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - start), 100);

    try {
      const res = await fetch('/api/admin/god-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: m }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (e: any) {
      setResults([{ name: 'ERROR', ok: false, error: e.message }]);
    } finally {
      clearInterval(timerRef.current);
      setElapsed(Date.now() - start);
      setRunning(false);
    }
  };

  const modes = [
    { key: 'full', label: '⚡ 전체 실행', desc: '33개 전 크론', color: C.brand },
    { key: 'data', label: '📊 데이터 수집', desc: '청약/실거래/주식', color: C.green },
    { key: 'process', label: '⚙️ 데이터 가공', desc: '집계/싱크/테마', color: C.cyan },
    { key: 'ai', label: '🤖 AI 생성', desc: '요약/이미지/트렌드', color: C.purple },
    { key: 'content', label: '📝 콘텐츠', desc: '시드/블로그/채팅', color: C.yellow },
    { key: 'system', label: '🔧 시스템', desc: '헬스/통계/정리', color: C.textSec },
    { key: 'failed', label: '🔴 실패 재시도', desc: '실패한 것만', color: C.red },
  ];

  const successCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 8px' }}>⚡ GOD MODE</h1>
      <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 24px' }}>병렬 10x 실행 — 전체 시스템을 원클릭으로 갱신</p>

      {/* Mode Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
        {modes.map(m => (
          <button key={m.key} onClick={() => { setMode(m.key); run(m.key); }} disabled={running}
            style={{
              padding: '16px 14px', borderRadius: 12, border: `1px solid ${running ? C.border : m.color}40`,
              background: C.card, cursor: running ? 'wait' : 'pointer', textAlign: 'left', transition: 'all .15s',
            }}
            onMouseEnter={e => { if (!running) e.currentTarget.style.borderColor = m.color; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${m.color}40`; }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 11, color: C.textDim }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Progress */}
      {running && (
        <div style={{ background: C.card, border: `1px solid ${C.brand}40`, borderRadius: 12, padding: 20, marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8, animation: 'pulse 1.5s infinite' }}>⚡</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{mode.toUpperCase()} 실행 중...</div>
          <div style={{ fontSize: 14, color: C.brand, fontWeight: 600, marginTop: 4 }}>{(elapsed / 1000).toFixed(1)}초</div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <KPICard icon="✅" label="성공" value={successCount} color={C.green} />
            <KPICard icon="❌" label="실패" value={failCount} color={C.red} />
            <KPICard icon="⏱" label="소요시간" value={`${(elapsed / 1000).toFixed(1)}s`} color={C.brand} />
          </div>
          <DataTable
            headers={['크론', '상태', '소요시간', '에러']}
            rows={results.map(r => [
              <span key="n" style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{r.name}</span>,
              r.ok ? <Badge key="s" color={C.green}>✓ OK</Badge> : <Badge key="s" color={C.red}>✗ FAIL</Badge>,
              r.duration ? `${(r.duration / 1000).toFixed(1)}s` : '—',
              r.error || '—',
            ])}
          />
        </>
      )}
    </div>
  );
}
