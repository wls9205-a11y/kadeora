// Admin shared types, constants, and components
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';

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
export function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: active ? C.brand : C.card, color: active ? '#fff' : C.textSec, transition: 'all .15s' }}>{children}</button>;
}
export function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${color}20`, color }}>{children}</span>;
}
export function KPICard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color: string }) {
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
export function DataTable({ headers, rows, onRowClick }: { headers: string[]; rows: any[][]; onRowClick?: (i: number) => void }) {
  return (
    <div className="admin-table-wrap" style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${C.border}` }}>
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
export function Spinner() { return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.brand, borderRadius: '50%', animation: 'spin .6s linear infinite' }} /></div>; }
export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginBottom: 6, letterSpacing: '0.02em' }}>{title}</div>
      {children}
    </div>
  );
}
export function DetailGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="admin-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
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
export function ProgressBar({ value, max, color, label, sub }: { value: number; max: number; color: string; label: string; sub?: string }) {
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

export function StatBox({ icon, label, value, sub, color, accent }: { icon: string; label: string; value: string | number; sub?: string; color: string; accent?: boolean }) {
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

export { C, GRADE_EMOJI, PROVIDER_LABEL, SECTIONS, ago, fmt, dateStr };
export type { KPI, DailyStat, UserRow, Section };
