'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface RegionData {
  name: string;
  sub: number;
  ongoing: number;
  unsold: number;
  redev: number;
  trade: number;
  total: number;
}

interface Props {
  apts: Record<string, any>[];
  ongoingApts: Record<string, any>[];
  unsold: Record<string, any>[];
  redevelopment: Record<string, any>[];
  transactions: Record<string, any>[];
  redevTotalCount?: number;
  tradeTotalCount?: number;
  tradeByRegion?: Record<string, number>;
  redevByRegion?: Record<string, number>;
  subTotalCount?: number;
  unsoldTotalCount?: number;
  ongoingTotalCount?: number;
  dataFreshness?: { sub: string; trade: string; unsold: string; redev: string };
  onRegionClick?: (region: string) => void;
  onTabChange?: (tab: string) => void;
  activeRegion?: string;
  activeTab?: string;
  redevRedevCount?: number;
  redevRebuildCount?: number;
  shareButton?: React.ReactNode;
}

const KPI_CFG = [
  { key: 'sub', label: '청약정보', c: 'var(--accent-blue, #3B82F6)' },
  { key: 'ongoing', label: '분양중', c: 'var(--accent-green, #22C55E)' },
  { key: 'unsold', label: '미분양', c: 'var(--accent-red, #EF4444)' },
  { key: 'redev', label: '재건축', c: 'var(--accent-purple, #8B5CF6)' },
  { key: 'trade', label: '실거래', c: 'var(--accent-yellow, #F59E0B)' },
  { key: 'complex', label: '단지백과', c: 'var(--brand, #3B7BF6)' },
] as const;

const DONUT_COLORS = ['#3B82F6', '#22C55E', '#EF4444', '#8B5CF6'];

function MiniDonut({ sub, ongoing, unsold, redev, name, total, size = 34, active = false }: { sub: number; ongoing: number; unsold: number; redev: number; name: string; total: number; size?: number; active?: boolean }) {
  const catTotal = sub + ongoing + unsold + redev;
  const r = size * 0.4, sw = size * 0.11, cx = size / 2, ci = 2 * Math.PI * r;
  const colors = DONUT_COLORS;
  const pcts = catTotal > 0 ? [sub / catTotal, ongoing / catTotal, unsold / catTotal, redev / catTotal] : [0, 0, 0, 0];
  let off = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} opacity={0.2} />
      {catTotal > 0 && pcts.map((p, i) => {
        const len = p * ci;
        if (len < 0.5) { off += len; return null; }
        const el = <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={colors[i]} strokeWidth={sw} strokeDasharray={`${len} ${ci - len}`} strokeDashoffset={-off} transform={`rotate(-90 ${cx} ${cx})`} />;
        off += len;
        return el;
      })}
      <text x={cx} y={cx + size * 0.08} textAnchor="middle" style={{ fontSize: size * 0.28, fill: active ? 'var(--brand)' : 'var(--text-primary)', fontWeight: 600 }}>{name}</text>
    </svg>
  );
}

export default function RegionStackedBar({ apts, ongoingApts, unsold, redevelopment, transactions, redevTotalCount, tradeTotalCount, tradeByRegion = {}, redevByRegion = {}, subTotalCount, unsoldTotalCount, ongoingTotalCount, onRegionClick, onTabChange, activeRegion, activeTab }: Props) {
  const router = useRouter();
  const [expRegion, setExpRegion] = useState<string | null>(null);

  const regions = useMemo(() => {
    const map: Record<string, RegionData> = {};
    const ensure = (n: string) => { if (!n || n === '기타') return; if (!map[n]) map[n] = { name: n, sub: 0, ongoing: 0, unsold: 0, redev: 0, trade: 0, total: 0 }; };
    const norm = (n: string) => n.replace(/특별시|광역시|특별자치시|특별자치도|도$/, '').trim();
    apts.forEach((a: Record<string, any>) => { const r = norm(a.region_nm || ''); if (!r) return; ensure(r); if (map[r]) { map[r].sub++; map[r].total++; } });
    ongoingApts.forEach((a: Record<string, any>) => { const r = norm(a.region_nm || ''); if (!r) return; ensure(r); if (map[r]) { map[r].ongoing++; map[r].total++; } });
    unsold.forEach((u: Record<string, any>) => { const r = norm(u.region_nm || ''); if (!r) return; ensure(r); if (map[r]) { map[r].unsold++; map[r].total++; } });
    if (Object.keys(redevByRegion).length > 0) { Object.entries(redevByRegion).forEach(([r, c]) => { ensure(r); if (map[r]) { map[r].redev = c; map[r].total += c; } }); }
    else { redevelopment.forEach((rd: Record<string, any>) => { const r = norm(rd.region || rd.region_nm || ''); if (!r) return; ensure(r); if (map[r]) { map[r].redev++; map[r].total++; } }); }
    if (Object.keys(tradeByRegion).length > 0) { Object.entries(tradeByRegion).forEach(([r, c]) => { ensure(r); if (map[r]) { map[r].trade = c; map[r].total += c; } }); }
    else { const ts: Record<string, Set<string>> = {}; transactions.forEach((t: Record<string, any>) => { let r = norm(t.region_nm || ''); if (!r) r = (t.sigungu_nm || '').slice(0, 2); if (!r) return; ensure(r); if (!ts[r]) ts[r] = new Set(); ts[r].add(t.apt_name || t.id); }); Object.entries(ts).forEach(([r, s]) => { if (map[r]) { map[r].trade = s.size; map[r].total += s.size; } }); }
    return Object.values(map).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  }, [apts, ongoingApts, unsold, redevelopment, transactions, tradeByRegion, redevByRegion]);

  const gc = {
    sub: subTotalCount || regions.reduce((s, r) => s + r.sub, 0),
    ongoing: ongoingTotalCount || regions.reduce((s, r) => s + r.ongoing, 0),
    unsold: unsoldTotalCount || regions.reduce((s, r) => s + r.unsold, 0),
    redev: redevTotalCount || regions.reduce((s, r) => s + r.redev, 0),
    trade: tradeTotalCount || regions.reduce((s, r) => s + r.trade, 0),
  };
  if (regions.length === 0) return null;

  const kv: Record<string, number | string> = { sub: gc.sub, ongoing: gc.ongoing, unsold: gc.unsold, redev: gc.redev, trade: gc.trade, complex: '34.5K' };
  const exp = expRegion ? regions.find(r => r.name === expRegion) : null;

  return (
    <div style={{ marginBottom: 'var(--sp-sm)', maxWidth: '100%', overflow: 'hidden' }}>
      {/* ── KPI 카드 (클릭 → 탭 전환) ── */}
      <div className="kd-region-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4, marginBottom: 6 }}>
        {KPI_CFG.map(k => {
          const isAct = activeTab === k.key;
          return (
            <button key={k.key} onClick={() => k.key === 'complex' ? router.push('/apt/complex') : onTabChange?.(k.key)}
              style={{
                padding: '8px 4px', borderRadius: 'var(--radius-sm)', textAlign: 'center', cursor: 'pointer',
                background: isAct ? 'var(--bg-hover)' : 'var(--bg-surface)',
                border: `1px solid ${isAct ? 'var(--brand)' : 'var(--border)'}`,
                transition: 'all 0.15s',
              }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: k.c, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                {typeof kv[k.key] === 'number' ? (kv[k.key] as number).toLocaleString() : kv[k.key]}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500 }}>{k.label}</div>
            </button>
          );
        })}
      </div>

      {/* ── 지역별 미니 도넛 그리드 (도넛 내부에 지역명+숫자) ── */}
      <div className="kd-region-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 3,
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '4px 3px',
      }}>
        {regions.map((r) => {
          const isAct = activeRegion === r.name;
          return (
            <button key={r.name} onClick={() => { onRegionClick?.(isAct ? '전체' : r.name); setExpRegion(expRegion === r.name ? null : r.name); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '2px 0', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: isAct ? 'var(--bg-hover)' : 'transparent',
                border: `1px solid ${isAct ? 'var(--brand)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}>
              <MiniDonut sub={r.sub} ongoing={r.ongoing} unsold={r.unsold} redev={r.redev} name={r.name} total={r.total} size={36} active={isAct} />
            </button>
          );
        })}
      </div>

      {/* ── 상세 패널 ── */}
      {exp && (
        <div style={{
          marginTop: 4, padding: '6px 10px', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          animation: 'kd-fadeIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{exp.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>총 {exp.total.toLocaleString()}건</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4 }}>
            {([
              { v: exp.sub, l: '청약', c: 'var(--accent-blue, #3B82F6)', tab: 'sub' },
              { v: exp.ongoing, l: '분양', c: 'var(--accent-green, #22C55E)', tab: 'ongoing' },
              { v: exp.unsold, l: '미분양', c: 'var(--accent-red, #EF4444)', tab: 'unsold' },
              { v: exp.redev, l: '재건축', c: 'var(--accent-purple, #8B5CF6)', tab: 'redev' },
              { v: exp.trade, l: '실거래', c: 'var(--accent-yellow, #F59E0B)', tab: 'trade' },
            ] as const).map((item, idx) => (
              <button key={idx} onClick={() => onTabChange?.(item.tab)} style={{
                textAlign: 'center', padding: '3px 2px', borderRadius: 'var(--radius-sm)',
                background: activeTab === item.tab ? 'var(--bg-hover)' : 'var(--bg-hover)',
                border: activeTab === item.tab ? '1px solid var(--brand)' : '1px solid transparent',
                cursor: 'pointer', transition: 'all 0.12s',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: item.c }}>{item.v.toLocaleString()}</div>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{item.l}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes kd-fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:640px){.kd-region-kpi{grid-template-columns:repeat(3,minmax(0,1fr))!important}.kd-region-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important}}`}</style>
    </div>
  );
}
