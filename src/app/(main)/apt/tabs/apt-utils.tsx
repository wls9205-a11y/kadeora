// 부동산 탭 공유 타입/유틸/상수
export { generateAptSlug } from '@/lib/apt-slug';

export interface Apt {
  id: number; house_nm: string; house_manage_no?: string; region_nm: string;
  hssply_adres: string; tot_supply_hshld_co: number;
  rcept_bgnde: string; rcept_endde: string; przwner_presnatn_de: string;
  cntrct_cncls_bgnde: string; cntrct_cncls_endde: string;
  spsply_rcept_bgnde: string; spsply_rcept_endde: string;
  mvn_prearnge_ym: string; pblanc_url: string; mdatrgbn_nm: string;
  competition_rate_1st: number | null; competition_rate_2nd?: number | null;
  view_count?: number;
  [key: string]: any;
}

export const NEW_HOURS: Record<string, number> = { subscription: 24, ongoing: 168, unsold: 168, redevelopment: 168, transaction: 72 };

export function isNew(item: any, type: string): boolean {
  const h = NEW_HOURS[type] || 72;
  const ts = item.created_at || item.fetched_at;
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < h * 60 * 60 * 1000;
}

export function kstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

export function getStatus(apt: Apt): 'open' | 'upcoming' | 'closed' {
  const today = kstToday();
  if (!apt.rcept_bgnde) return 'upcoming';
  if (today >= String(apt.rcept_bgnde) && today <= String(apt.rcept_endde)) return 'open';
  if (today < String(apt.rcept_bgnde)) return 'upcoming';
  return 'closed';
}

export function fmtD(d: string | null | undefined): string {
  if (!d) return '-';
  const s = String(d).slice(0, 10);
  const [, m, dd] = s.split('-');
  return `${m}.${dd}`;
}

export function fmtAmount(amt: number): string {
  if (!amt) return '-';
  if (amt >= 10000) return `${(amt / 10000).toFixed(1)}억`;
  return `${amt.toLocaleString()}만`;
}

export function dDay(apt: Apt): string {
  const today = kstToday();
  const status = getStatus(apt);
  if (status === 'open') {
    const diff = Math.ceil((new Date(String(apt.rcept_endde)).getTime() - new Date(today).getTime()) / 86400000);
    return diff <= 0 ? 'D-Day' : `D-${diff}`;
  }
  if (status === 'upcoming') {
    const diff = Math.ceil((new Date(String(apt.rcept_bgnde)).getTime() - new Date(today).getTime()) / 86400000);
    return `D-${diff}`;
  }
  return '마감';
}

export const STATUS_BADGE = {
  open: { label: '접수중', bg: 'rgba(52,211,153,0.2)', color: 'var(--accent-green)', border: 'var(--accent-green)' },
  upcoming: { label: '접수예정', bg: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)', border: 'var(--accent-yellow)' },
  closed: { label: '마감', bg: 'transparent', color: 'var(--text-tertiary)', border: 'var(--border)' },
} as const;

export const STAGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  '정비구역지정': { bg: 'rgba(107,114,128,0.15)', color: 'var(--text-secondary)', border: 'var(--text-tertiary)' },
  '조합설립': { bg: 'rgba(96,165,250,0.2)', color: '#93C5FD', border: 'var(--accent-blue)' },
  '사업시행인가': { bg: 'rgba(251,191,36,0.2)', color: '#FDE047', border: 'var(--accent-yellow)' },
  '관리처분': { bg: 'rgba(251,146,60,0.2)', color: '#FDBA74', border: 'var(--accent-orange)' },
  '착공': { bg: 'rgba(52,211,153,0.2)', color: '#86EFAC', border: 'var(--accent-green)' },
  '준공': { bg: 'var(--brand-border)', color: 'var(--brand)', border: 'var(--brand)' },
};

export const STAGE_ORDER = ['정비구역지정', '조합설립', '사업시행인가', '관리처분', '착공', '준공'];

export function NewBadge() {
  return <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: 'var(--accent-red)', color: 'var(--text-inverse)', marginRight: 4, animation: 'pulse 2s infinite' }}>NEW</span>;
}

export function Pill({ value, selected, onSelect, label }: { value: string; selected: string; onSelect: (v: string) => void; label?: string }) {
  return (
    <button onClick={() => onSelect(value)} style={{
      padding: '5px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: 600,
      background: selected === value ? 'var(--brand)' : 'var(--bg-hover)',
      color: selected === value ? 'var(--text-inverse)' : 'var(--text-secondary)',
      border: 'none', cursor: 'pointer', flexShrink: 0,
    }}>
      {label || value}
    </button>
  );
}

export interface SharedTabProps {
  aptUser: any;
  watchlist: Set<string>;
  toggleWatchlist: (type: string, id: string) => void;
  setCommentTarget: (t: { houseKey: string; houseNm: string; houseType: 'sub' | 'unsold' | 'redev' } | null) => void;
  showToast: (msg: string) => void;
  globalRegion?: string;
  globalSearch?: string;
}
