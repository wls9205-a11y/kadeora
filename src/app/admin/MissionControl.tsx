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
type Section = 'dashboard' | 'analytics' | 'users' | 'content' | 'blog' | 'realestate' | 'system' | 'reports' | 'godmode' | 'seo';
const SECTIONS: { key: Section; icon: string; label: string }[] = [
  { key: 'dashboard', icon: '📊', label: '대시보드' },
  { key: 'analytics', icon: '📈', label: '방문자' },
  { key: 'seo', icon: '🔍', label: 'SEO · 점수' },
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
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginBottom: 6, letterSpacing: '0.02em' }}>{title}</div>
      {children}
    </div>
  );
}
function DetailGrid({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
      {items.map(([l, v]) => (
        <div key={l}>
          <div style={{ color: C.textDim, marginBottom: 1 }}>{l}</div>
          <div style={{ color: C.text, fontWeight: 500 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════
export default function MissionControl() {
  const [section, setSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => { if (window.innerWidth < 769) setSidebarOpen(false); }, []);

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
        .mc-mob-hdr { display: none; }
        @media (max-width: 768px) {
          .mc-sb { position: fixed !important; left: 0; top: 0; z-index: 200 !important; height: 100dvh !important; }
          .mc-sb.mc-closed { width: 0 !important; padding: 0 !important; border: none !important; overflow: hidden !important; }
          .mc-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 199; }
          .mc-mob-hdr { display: flex !important; }
          .mc-main { padding: 12px !important; padding-top: 52px !important; }
          .mc-g4 { grid-template-columns: repeat(2, 1fr) !important; }
          .mc-g2 { grid-template-columns: 1fr !important; }
          .mc-g6 { grid-template-columns: repeat(3, 1fr) !important; }
          .mc-hour-grid { grid-template-columns: repeat(8, 1fr) !important; }
        }
        @media (min-width: 769px) { .mc-overlay { display: none !important; } }
      `}</style>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && <div className="mc-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Mobile top bar ── */}
      <div className="mc-mob-hdr" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 198, background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '10px 14px', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: C.text, cursor: 'pointer', fontSize: 20, padding: 4 }}>☰</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{SECTIONS.find(s => s.key === section)?.icon} {SECTIONS.find(s => s.key === section)?.label}</span>
      </div>

      {/* ── Sidebar ── */}
      <aside className={`mc-sb ${sidebarOpen ? '' : 'mc-closed'}`} style={{
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
            <button key={s.key} onClick={() => { setSection(s.key); if (typeof window !== 'undefined' && window.innerWidth < 769) setSidebarOpen(false); }} style={{
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
      <main className="mc-main" style={{ flex: 1, padding: 'clamp(16px, 2vw, 28px)', overflow: 'auto', animation: 'fadeIn .3s ease' }}>
        {section === 'dashboard' && <DashboardSection />}
        {section === 'analytics' && <AnalyticsSection />}
        {section === 'seo' && <SEOSection />}
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
function ProgressBar({ value, max, color, label, sub }: { value: number; max: number; color: string; label: string; sub?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>{value}{sub ? ` ${sub}` : ''}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width .6s ease' }} />
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, sub, color, accent }: { icon: string; label: string; value: string | number; sub?: string; color: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? `${color}10` : C.card, border: `1px solid ${accent ? color + '30' : C.border}`, borderRadius: 14, padding: '14px 16px', transition: 'border-color .15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600, letterSpacing: '.03em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent ? color : C.text, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
        {typeof value === 'number' ? fmt(value) : value}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function DashboardSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard?section=overview').then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <div style={{ color: C.red }}>로드 실패</div>;

  const { kpi, visitors, recentUsers, recentPosts, dailyStats, cron, seo } = data;
  const typeColors: Record<string, string> = { subscription: C.green, trade: C.yellow, redevelopment: C.purple, unsold: C.red, landmark: C.cyan };
  const typeLabels: Record<string, string> = { subscription: '청약', trade: '실거래', redevelopment: '재개발', unsold: '미분양', landmark: '대장' };
  const totalSites = seo?.totalSites || 0;
  const catIcons: Record<string, string> = { stock: '📈', apt: '🏢', local: '📍', free: '💬', finance: '💰' };

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>Mission Control</h1>
          <p style={{ fontSize: 11, color: C.textDim, margin: '2px 0 0' }}>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</p>
        </div>
        <button onClick={() => window.location.reload()} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.textSec, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>🔄 새로고침</button>
      </div>

      {/* ── Row 1: 핵심 KPI 6카드 (2행) ── */}
      <div className="mc-g6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { icon: '👁️', label: '오늘 PV', value: visitors?.todayPV ?? 0, color: C.brand },
          { icon: '👤', label: '오늘 UV', value: visitors?.todayUV ?? 0, color: C.cyan },
          { icon: '📊', label: '주간 PV', value: visitors?.weekPV ?? 0, color: C.brand },
          { icon: '🧑‍🤝‍🧑', label: '전체 유저', value: kpi.users, color: C.green },
          { icon: '📝', label: '게시글', value: kpi.posts, color: C.purple },
          { icon: '🚨', label: '미처리 신고', value: kpi.pendingReports, color: kpi.pendingReports > 0 ? C.red : C.green },
        ].map(item => (
          <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>{item.icon} {item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{fmt(item.value)}</div>
          </div>
        ))}
      </div>

      {/* ── Row 2: 서비스 상태 카드 (4열) ── */}
      <div className="mc-g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        {/* 크론 헬스 */}
        <div style={{ background: C.card, border: `1px solid ${cron.fail > 0 ? C.red + '40' : C.border}`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: C.textDim }}>⚡ 크론 24h</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: cron.fail > 0 ? C.red : C.green }}>{cron.success}/{cron.total}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: cron.fail > 0 ? C.red : C.green, width: `${cron.total > 0 ? (cron.success / cron.total) * 100 : 100}%` }} />
          </div>
          {cron.failNames?.length > 0 && <div style={{ marginTop: 4, display: 'flex', gap: 3, flexWrap: 'wrap' }}>{cron.failNames.slice(0, 2).map((n: string) => <Badge key={n} color={C.red}>{n}</Badge>)}</div>}
        </div>
        {/* 유저 활동 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>👤 유저 활동</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div><div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{kpi.newUsersWeek}</div><div style={{ fontSize: 9, color: C.textDim }}>신규(주)</div></div>
            <div><div style={{ fontSize: 16, fontWeight: 800, color: C.cyan }}>{kpi.activeUsersWeek}</div><div style={{ fontSize: 9, color: C.textDim }}>활성(주)</div></div>
          </div>
        </div>
        {/* 콘텐츠 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>📝 콘텐츠</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.posts)}</span><span style={{ fontSize: 9, color: C.textDim }}> 글</span></div>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.discussions)}</span><span style={{ fontSize: 9, color: C.textDim }}> 토론</span></div>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.blogs)}</span><span style={{ fontSize: 9, color: C.textDim }}> 블로그</span></div>
          </div>
        </div>
        {/* 부동산 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>🏢 부동산</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.subscriptions)}</span><span style={{ fontSize: 9, color: C.textDim }}> 청약</span></div>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.unsold)}</span><span style={{ fontSize: 9, color: C.textDim }}> 미분양</span></div>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.redev)}</span><span style={{ fontSize: 9, color: C.textDim }}> 재개발</span></div>
          </div>
        </div>
      </div>

      {/* ── Row 3: 트래픽 + 사이트맵 + 주요 유입 (3열) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 12 }} className="mc-g2">
        {/* 일일 차트 (14일) */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>일일 트래픽 (14일)</span>
            <div style={{ display: 'flex', gap: 8, fontSize: 9 }}>
              <span style={{ color: C.brand }}>■ PV</span><span style={{ color: C.green }}>■ 신규</span>
            </div>
          </div>
          <MiniChart data={(dailyStats || []).reverse()} />
        </div>
        {/* 사이트맵 + 유입 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>사이트 현황</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: C.textSec }}>전체 페이지</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.brand }}>{fmt(totalSites)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: C.textSec }}>사이트맵</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.green }}>{seo?.sitemapPct || 0}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: C.textSec }}>블로그 리라이트</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.purple }}>{seo?.blogRewrittenPct || 0}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: C.textSec }}>주요 유입</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.cyan }}>{visitors?.topReferrer?.source || '—'} ({visitors?.topReferrer?.count || 0})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: C.textSec }}>주식 종목</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.yellow }}>{fmt(kpi.stocks)}</span>
          </div>
        </div>
      </div>

      {/* ── Row 4: 페이지 타입 분포 바 ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>페이지 타입 분포</span>
          <span style={{ fontSize: 10, color: C.textDim }}>{fmt(totalSites)}건</span>
        </div>
        <div style={{ display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
          {Object.entries(seo?.siteTypeBreakdown || {}).sort((a: any, b: any) => b[1].count - a[1].count).map(([type, info]: [string, any]) => (
            <div key={type} style={{ width: `${(info.count / totalSites) * 100}%`, background: typeColors[type] || C.textDim }}
              title={`${typeLabels[type] || type}: ${info.count}건`} />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(seo?.siteTypeBreakdown || {}).sort((a: any, b: any) => b[1].count - a[1].count).map(([type, info]: [string, any]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 6, height: 6, borderRadius: 2, background: typeColors[type] || C.textDim }} />
              <span style={{ color: C.textSec }}>{typeLabels[type] || type}</span>
              <span style={{ color: C.text, fontWeight: 700 }}>{fmt(info.count)}</span>
              <span style={{ color: C.textDim, fontSize: 10 }}>({info.avgScore}점)</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 5: 최근 가입 + 최근 게시글 ── */}
      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* 최근 가입 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>최근 가입</div>
          {(recentUsers || []).map((u: any) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${C.border}08` }}>
              <span style={{ fontSize: 13 }}>{GRADE_EMOJI[u.grade] || '🌱'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.nickname} {u.is_seed && <span style={{ fontSize: 9, color: C.textDim }}>(시드)</span>}
                </div>
                <div style={{ fontSize: 9, color: C.textDim }}>{PROVIDER_LABEL[u.provider] || '—'} · {u.region_text || '미설정'}</div>
              </div>
              <div style={{ fontSize: 9, color: C.textDim, flexShrink: 0 }}>{ago(u.created_at)}</div>
            </div>
          ))}
        </div>
        {/* 최근 게시글 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>최근 게시글</div>
          {(recentPosts || []).map((p: any) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: `1px solid ${C.border}08` }}>
              <span style={{ fontSize: 12 }}>{catIcons[p.category] || '📄'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                <div style={{ fontSize: 9, color: C.textDim }}>{p.profiles?.nickname || '—'} · ♥{p.likes_count || 0} · 💬{p.comments_count || 0}</div>
              </div>
              <div style={{ fontSize: 9, color: C.textDim, flexShrink: 0 }}>{ago(p.created_at)}</div>
            </div>
          ))}
          {(!recentPosts || recentPosts.length === 0) && <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center', padding: 16 }}>게시글 없음</div>}
        </div>
      </div>
    </div>
  );
}

function MiniChart({ data }: { data: DailyStat[] }) {
  if (!data.length) return <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', padding: 20 }}>데이터 없음</div>;
  const maxPV = Math.max(...data.map(d => d.page_views || 0), 1);
  const maxUsers = Math.max(...data.map(d => d.new_users || 0), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
        {data.map((d, i) => {
          const h = Math.max(((d.page_views || 0) / maxPV) * 70, 4);
          const uh = Math.max(((d.new_users || 0) / maxUsers) * 70, 2);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative' }}>
              <div style={{ width: '100%', height: h, borderRadius: 2, background: C.brand, opacity: .7, transition: 'height .3s' }}
                title={`${d.date}: PV ${d.page_views || 0} · 신규 ${d.new_users || 0}`} />
              <div style={{ width: '60%', height: uh, borderRadius: 2, background: C.green, opacity: .8, position: 'absolute', bottom: 0 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 9, color: C.textDim }}>{data[0]?.date?.slice(5)}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 9, color: C.brand }}>■ PV</span>
          <span style={{ fontSize: 9, color: C.green }}>■ 신규유저</span>
        </div>
        <span style={{ fontSize: 9, color: C.textDim }}>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// 📈 방문자 분석
// ══════════════════════════════════════
function AnalyticsSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7d');

  const load = useCallback((r: string) => {
    setLoading(true);
    fetch(`/api/admin/analytics?range=${r}`).then(res => res.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: C.textSec }}>방문자 데이터 로딩 중...</div>;
  if (!data || data.error) return <div style={{ textAlign: 'center', padding: 60, color: C.red }}>데이터 로드 실패: {data?.error || '알 수 없음'}</div>;

  const { kpi, topPages, referrers, hourly, daily, devices, recentViews } = data;
  const maxHour = Math.max(...(hourly || []).map((h: any) => h.count), 1);
  const maxDaily = Math.max(...(daily || []).map((d: any) => d.views), 1);
  const totalDevices = (devices?.mobile || 0) + (devices?.desktop || 0) + (devices?.bot || 0);

  return (
    <div>
      {/* Range selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['1d', '오늘'], ['7d', '7일'], ['30d', '30일']].map(([k, l]) => (
          <Pill key={k} active={range === k} onClick={() => setRange(k)}>{l}</Pill>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="mc-g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: '총 조회수', value: kpi.totalViews.toLocaleString(), color: C.brand, icon: '👁️' },
          { label: '순 방문자', value: kpi.uniqueVisitors.toLocaleString(), color: C.green, icon: '👤' },
          { label: '로그인 사용자', value: kpi.withUser.toLocaleString(), color: C.purple, icon: '🔑' },
          { label: '평균 조회/방문자', value: kpi.avgViewsPerVisitor, color: C.cyan, icon: '📊' },
        ].map(item => (
          <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>{item.icon} {item.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Daily trend chart */}
      {daily && daily.length > 1 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>일별 추이</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100 }}>
            {daily.map((d: any, i: number) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: 9, color: C.textDim }}>{d.views}</div>
                <div style={{ width: '100%', borderRadius: 3, background: `linear-gradient(to top, ${C.brand}, ${C.brandDim})`, height: `${(d.views / maxDaily) * 80}px`, minHeight: 2, transition: 'height .3s' }} />
                <div style={{ fontSize: 9, color: C.textDim }}>{d.date}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: C.textSec }}>
            <span>🔵 조회수</span>
            <span>평균 {daily.length > 0 ? Math.round(daily.reduce((s: number, d: any) => s + d.views, 0) / daily.length) : 0}/일</span>
          </div>
        </div>
      )}

      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Top pages */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>인기 페이지</div>
          {(topPages || []).slice(0, 10).map((p: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: i < 9 ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, minWidth: 16 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.brand, flexShrink: 0 }}>{p.count}</span>
              <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0, minWidth: 32 }}>{p.pct}%</span>
            </div>
          ))}
        </div>

        {/* Referrers */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>유입 경로</div>
          {(referrers || []).map((r: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: i < referrers.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ flex: 1, fontSize: 12, color: C.text }}>{r.source}</span>
              <div style={{ width: 60, height: 6, background: C.surface, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${Math.min(parseFloat(r.pct), 100)}%`, height: '100%', background: r.source === 'Google' ? '#4285F4' : r.source === 'Naver' ? '#03C75A' : r.source.includes('Kakao') ? '#FEE500' : r.source === 'Facebook' ? '#1877F2' : C.brand, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textSec, flexShrink: 0, minWidth: 28 }}>{r.count}</span>
              <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0, minWidth: 32 }}>{r.pct}%</span>
            </div>
          ))}
          {(!referrers || referrers.length === 0) && <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: 20 }}>유입 데이터 없음</div>}
        </div>
      </div>

      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Hourly heatmap */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>시간대별 분포 (KST)</div>
          <div className="mc-hour-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
            {(hourly || []).map((h: any) => {
              const intensity = maxHour > 0 ? h.count / maxHour : 0;
              return (
                <div key={h.hour} style={{ textAlign: 'center' }}>
                  <div style={{
                    height: 28, borderRadius: 4,
                    background: intensity > 0.7 ? C.brand : intensity > 0.3 ? C.brandDim : intensity > 0 ? `${C.brand}30` : C.surface,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 600, color: intensity > 0.3 ? '#fff' : C.textDim,
                  }}>{h.count > 0 ? h.count : ''}</div>
                  <div style={{ fontSize: 8, color: C.textDim, marginTop: 2 }}>{h.hour}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 8 }}>0시~23시 · 진할수록 방문 많음</div>
        </div>

        {/* Device breakdown */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>디바이스</div>
          {totalDevices > 0 ? (
            <>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ width: `${(devices.mobile / totalDevices) * 100}%`, background: C.brand }} />
                <div style={{ width: `${(devices.desktop / totalDevices) * 100}%`, background: C.green }} />
                <div style={{ width: `${(devices.bot / totalDevices) * 100}%`, background: C.yellow }} />
              </div>
              {[
                { label: '📱 모바일', count: devices.mobile, color: C.brand },
                { label: '🖥️ 데스크톱', count: devices.desktop, color: C.green },
                { label: '🤖 봇/크롤러', count: devices.bot, color: C.yellow },
              ].map(d => (
                <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 12, color: C.text }}>{d.label}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: d.color }}>{d.count.toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: C.textDim }}>{totalDevices > 0 ? ((d.count / totalDevices) * 100).toFixed(0) : 0}%</span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: 20 }}>데이터 없음</div>
          )}
        </div>
      </div>

      {/* Recent views log */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>최근 방문 로그</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: C.textDim, fontWeight: 600 }}>시간</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: C.textDim, fontWeight: 600 }}>페이지</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: C.textDim, fontWeight: 600 }}>유입</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', color: C.textDim, fontWeight: 600 }}>기기</th>
              </tr>
            </thead>
            <tbody>
              {(recentViews || []).map((v: any, i: number) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '5px 8px', color: C.textSec, whiteSpace: 'nowrap' }}>{ago(v.time)}</td>
                  <td style={{ padding: '5px 8px', color: C.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.path}</td>
                  <td style={{ padding: '5px 8px', color: v.referrer === '직접' ? C.textDim : C.brand }}>{v.referrer}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>{v.device === 'M' ? '📱' : '🖥️'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// 🔍 SEO · 점수
// ══════════════════════════════════════
function SEOSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scoreDetail, setScoreDetail] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/dashboard?section=overview').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  // content_score 상세 분포 로드
  useEffect(() => {
    if (!data) return;
    fetch('/api/admin/dashboard?section=seo-detail')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setScoreDetail(d))
      .catch(() => {});
  }, [data]);

  if (loading) return <Spinner />;
  if (!data) return <div style={{ color: C.red }}>로드 실패</div>;

  const { seo, kpi } = data;
  const typeColors: Record<string, string> = { subscription: C.green, trade: C.yellow, redevelopment: C.purple, unsold: C.red, landmark: C.cyan };
  const typeLabels: Record<string, string> = { subscription: '청약', trade: '실거래', redevelopment: '재개발', unsold: '미분양', landmark: '대장' };
  const maxScore = 103;

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 8px' }}>🔍 SEO · 콘텐츠 점수</h1>
      <p style={{ fontSize: 12, color: C.textDim, margin: '0 0 24px' }}>5,420개 현장 페이지의 데이터 풍부도 현황</p>

      {/* ── Hero Stats ── */}
      <div className="mc-g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatBox icon="📄" label="전체 페이지" value={seo?.totalSites || 0} color={C.brand} accent />
        <StatBox icon="🗺️" label="사이트맵" value={seo?.totalSitemap || 0} sub={`${seo?.sitemapPct || 0}% 커버리지`} color={C.green} accent />
        <StatBox icon="✍️" label="블로그 리라이트" value={`${seo?.blogRewrittenPct || 0}%`} sub={`${fmt(kpi.blogs)}건 중`} color={C.purple} accent />
        <StatBox icon="🏆" label="최대 점수" value="97" sub="/ 103점 만점" color={C.yellow} accent />
      </div>

      {/* ── Type Score Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {Object.entries(seo?.siteTypeBreakdown || {}).sort((a: any, b: any) => b[1].count - a[1].count).map(([type, info]: [string, any]) => (
          <div key={type} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: typeColors[type] || C.text }}>{typeLabels[type] || type}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{fmt(info.count)}</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: C.textDim }}>평균 점수</span>
                <span style={{ color: typeColors[type], fontWeight: 700 }}>{info.avgScore} / {maxScore}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: C.border, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: typeColors[type] || C.brand, width: `${(info.avgScore / maxScore) * 100}%`, transition: 'width .6s' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: C.textDim }}>사이트맵</span>
              <span style={{ color: C.green, fontWeight: 600 }}>{info.sitemapCount}건 ({info.count > 0 ? Math.round(info.sitemapCount / info.count * 100) : 0}%)</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Score Formula Reference ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 14px' }}>📐 점수 산정 공식 (최대 103점)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { title: '기본 정보 (30)', items: ['이름 3자+ (+10)', '지역+시군구 (+10)', '세대수 (+10)'] },
            { title: '데이터 소스 (36)', items: ['가격 정보 (+5)', '청약 연결 (+10)', '재개발 연결 (+15)', '실거래 존재 (+10/+5/+3)', '미분양 연결 (+8)'] },
            { title: '콘텐츠 (28)', items: ['설명 100자+ (+10)', '설명 200자+ (+3)', 'FAQ 3개+ (+10)', 'FAQ 5개+ (+3)', 'key_features (+2)'] },
            { title: '위치 (13)', items: ['좌표 (+5)', '지하철역 (+5)', '상세 주소 (+3)'] },
            { title: '미디어 (5)', items: ['이미지 1장+ (+5)'] },
            { title: '부가 정보 (11)', items: ['시공사 (+3)', '준공년도 (+3)', '시행사 (+2)', '입주예정 (+3)'] },
          ].map(g => (
            <div key={g.title}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginBottom: 6 }}>{g.title}</div>
              {g.items.map(item => (
                <div key={item} style={{ fontSize: 11, color: C.textSec, padding: '2px 0' }}>{item}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
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
  const [userDetail, setUserDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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

  const selectUser = (user: UserRow) => {
    setSelected(user);
    setDetailLoading(true);
    setUserDetail(null);
    fetch(`/api/admin/dashboard?section=user-detail&id=${user.id}`)
      .then(r => r.json()).then(setUserDetail).finally(() => setDetailLoading(false));
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
              headers={['', '닉네임', '등급', '가입경로', '연령대', '지역', '포인트', '게시글', '가입일', '최근활동', '상태']}
              rows={users.map(u => [
                GRADE_EMOJI[u.grade] || '🌱',
                <span key="n" style={{ fontWeight: 600 }}>{u.nickname}</span>,
                u.grade_title,
                <Badge key="p" color={u.provider === 'kakao' ? C.yellow : u.provider === 'google' ? C.green : C.brand}>{PROVIDER_LABEL[u.provider || ''] || u.provider || '—'}</Badge>,
                u.age_group ? <Badge key="ag" color={C.cyan}>{u.age_group}</Badge> : <span key="ag" style={{ color: C.textDim }}>—</span>,
                u.region_text || u.residence_city || '—',
                <span key="pt" style={{ color: C.yellow, fontWeight: 600 }}>{fmt(u.points)}</span>,
                u.posts_count,
                dateStr(u.created_at),
                ago(u.last_active_at),
                u.is_banned ? <Badge key="b" color={C.red}>정지</Badge> : u.is_seed ? <Badge key="s" color={C.textDim}>시드</Badge> : u.is_premium ? <Badge key="pr" color={C.purple}>프리미엄</Badge> : <Badge key="a" color={C.green}>활성</Badge>,
              ])}
              onRowClick={(i) => selectUser(users[i])}
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
            <div style={{ width: 370, flexShrink: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, alignSelf: 'flex-start', position: 'sticky', top: 20, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{GRADE_EMOJI[selected.grade]} {selected.nickname}</h3>
                <button onClick={() => { setSelected(null); setUserDetail(null); }} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>

              {/* ── 기본 정보 ── */}
              <DetailSection title="🪪 기본 정보">
                <DetailGrid items={[
                  ['ID', selected.id.slice(0, 8) + '...'],
                  ['실명', selected.full_name || '—'],
                  ['등급', `${selected.grade_title} (Lv.${selected.grade})`],
                  ['가입경로', PROVIDER_LABEL[selected.provider || ''] || '—'],
                  ['카카오ID', selected.kakao_id || '—'],
                  ['구글', selected.google_email || '—'],
                  ['전화번호', selected.phone || '—'],
                  ['지역', selected.region_text || selected.residence_city || '—'],
                  ['성별', selected.gender === 'male' ? '👨 남성' : selected.gender === 'female' ? '👩 여성' : '—'],
                  ['연령대', selected.age_group || '—'],
                  ['가입일', dateStr(selected.created_at)],
                  ['최근활동', ago(selected.last_active_at)],
                ]} />
              </DetailSection>

              {/* ── 활동 지표 ── */}
              <DetailSection title="📊 활동 지표">
                <DetailGrid items={[
                  ['포인트', `${fmt(selected.points)}P`],
                  ['영향력', String(selected.influence_score)],
                  ['게시글', String(selected.posts_count)],
                  ['좋아요', String(selected.likes_count)],
                  ['팔로워', String(selected.followers_count)],
                  ['팔로잉', String(selected.following_count)],
                  ['연속출석', `${selected.streak_days}일`],
                  ['닉변횟수', String(selected.nickname_change_count)],
                ]} />
              </DetailSection>

              {/* ── 확장 정보 (API에서 로드) ── */}
              {detailLoading ? (
                <div style={{ padding: 16, textAlign: 'center' }}><Spinner /></div>
              ) : userDetail ? (
                <>
                  {/* 출석 */}
                  {userDetail.attendance && (
                    <DetailSection title="📅 출석">
                      <DetailGrid items={[
                        ['총 출석', `${userDetail.attendance.total_days}일`],
                        ['연속', `${userDetail.attendance.streak}일`],
                        ['마지막', dateStr(userDetail.attendance.last_date)],
                      ]} />
                    </DetailSection>
                  )}

                  {/* 관심 활동 */}
                  <DetailSection title="❤️ 관심 활동">
                    <DetailGrid items={[
                      ['관심종목', `${userDetail.counts?.watchlist ?? 0}개`],
                      ['청약북마크', `${userDetail.counts?.bookmarks ?? 0}개`],
                      ['가격알림', `${userDetail.counts?.priceAlerts ?? 0}개`],
                    ]} />
                  </DetailSection>

                  {/* 알림 설정 */}
                  <DetailSection title="🔔 알림 설정">
                    {userDetail.notifications ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {[
                          ['댓글', userDetail.notifications.push_comments],
                          ['좋아요', userDetail.notifications.push_likes],
                          ['팔로우', userDetail.notifications.push_follows],
                          ['인기글', userDetail.notifications.push_hot_post],
                          ['뉴스', userDetail.notifications.push_news],
                          ['주식알림', userDetail.notifications.push_stock_alert],
                          ['청약마감', userDetail.notifications.push_apt_deadline],
                          ['일일요약', userDetail.notifications.push_daily_digest],
                          ['출석', userDetail.notifications.push_attendance],
                        ].map(([label, on]) => (
                          <Badge key={label as string} color={on ? C.green : C.textDim}>
                            {on ? '✓' : '✗'} {label}
                          </Badge>
                        ))}
                        {userDetail.notifications.quiet_start && (
                          <div style={{ width: '100%', fontSize: 11, color: C.textDim, marginTop: 4 }}>
                            🌙 방해금지: {userDetail.notifications.quiet_start} ~ {userDetail.notifications.quiet_end}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: C.textDim }}>알림 설정 없음 (기본값)</div>
                    )}
                  </DetailSection>

                  {/* 푸시 & 앱 설치 */}
                  <DetailSection title="📱 푸시 & 앱">
                    <DetailGrid items={[
                      ['푸시 등록', userDetail.pushSubscriptions > 0 ? `✅ ${userDetail.pushSubscriptions}대` : '❌ 미등록'],
                      ['PWA 설치', userDetail.pwaInstalls?.length > 0 ? '✅ 설치됨' : '❌ 미설치'],
                    ]} />
                    {userDetail.pushDevices?.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        {userDetail.pushDevices.map((d: any) => (
                          <div key={d.id} style={{ fontSize: 11, color: C.textSec, padding: '2px 0' }}>
                            📍 {d.browser} · {ago(d.created_at)}
                          </div>
                        ))}
                      </div>
                    )}
                    {userDetail.pwaInstalls?.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {userDetail.pwaInstalls.map((p: any, i: number) => (
                          <div key={i} style={{ fontSize: 11, color: C.textSec, padding: '2px 0' }}>
                            📱 {p.platform || 'unknown'} · {p.browser} · {ago(p.installed_at)}
                          </div>
                        ))}
                      </div>
                    )}
                  </DetailSection>

                  {/* 동의 현황 */}
                  <DetailSection title="📋 동의 현황">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      <Badge color={selected.profile_completed ? C.green : C.textDim}>{selected.profile_completed ? '✓' : '✗'} 프로필완성</Badge>
                      <Badge color={selected.onboarded ? C.green : C.textDim}>{selected.onboarded ? '✓' : '✗'} 온보딩</Badge>
                      <Badge color={selected.marketing_agreed ? C.green : C.textDim}>{selected.marketing_agreed ? '✓' : '✗'} 마케팅</Badge>
                      <Badge color={selected.consent_analytics ? C.green : C.textDim}>{selected.consent_analytics ? '✓' : '✗'} 분석</Badge>
                      <Badge color={selected.is_premium ? C.purple : C.textDim}>
                        {selected.is_premium ? `✓ 프리미엄 (~${dateStr(selected.premium_expires_at)})` : '✗ 프리미엄'}
                      </Badge>
                    </div>
                  </DetailSection>
                </>
              ) : null}

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
    { key: 'sites' as const, label: `통합 현장 (${data?.sites?.length || 0})`, icon: '🏢' },
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
      const body: any = { mode: m };
      // 실패 재시도 시 이전 실패 목록 전달
      if (m === 'failed' && results.length > 0) {
        body.failedOnly = results.filter(r => !r.ok).map(r => r.endpoint).filter(Boolean);
      }
      const res = await fetch('/api/admin/god-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    { key: 'full', label: '⚡ 전체 실행', desc: '42개 전 크론', color: C.brand },
    { key: 'data', label: '📊 데이터 수집', desc: '청약/실거래/주식/재개발 15개', color: C.green },
    { key: 'process', label: '⚙️ 데이터 가공', desc: '집계/싱크/테마/검증 6개', color: C.cyan },
    { key: 'ai', label: '🤖 AI 생성', desc: '요약/이미지/트렌드/리라이트 6개', color: C.purple },
    { key: 'content', label: '📝 콘텐츠', desc: '시드/블로그/채팅 6개', color: C.yellow },
    { key: 'system', label: '🔧 시스템', desc: '헬스/통계/알림/정리 10개', color: C.textSec },
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
            headers={['크론', '상태', 'HTTP', '소요시간', '에러']}
            rows={results.map(r => [
              <span key="n" style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{r.name}</span>,
              r.ok ? <Badge key="s" color={C.green}>✓ OK</Badge> : <Badge key="s" color={C.red}>✗ FAIL</Badge>,
              r.status ? <span key="h" style={{ color: r.status >= 400 ? C.red : r.status >= 200 ? C.green : C.textDim, fontFamily: 'monospace', fontSize: 12 }}>{r.status}</span> : '—',
              r.duration ? `${(r.duration / 1000).toFixed(1)}s` : '—',
              r.error ? <span key="e" style={{ color: C.red, fontSize: 11, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{r.error}</span> : '—',
            ])}
          />
        </>
      )}
    </div>
  );
}
