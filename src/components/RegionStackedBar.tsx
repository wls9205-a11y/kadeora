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
  { key: 'sub', label: '청약', bg: 'rgba(59,123,246,0.1)', bc: 'rgba(59,123,246,0.12)', c: '#60A5FA', glow: '0 0 10px rgba(59,123,246,0.3)' },
  { key: 'ongoing', label: '분양', bg: 'rgba(34,197,94,0.1)', bc: 'rgba(34,197,94,0.12)', c: '#4ADE80', glow: '0 0 10px rgba(34,197,94,0.3)' },
  { key: 'unsold', label: '미분양', bg: 'rgba(239,68,68,0.1)', bc: 'rgba(239,68,68,0.12)', c: '#F87171', glow: '0 0 10px rgba(239,68,68,0.3)' },
  { key: 'redev', label: '재건축', bg: 'rgba(168,85,247,0.1)', bc: 'rgba(168,85,247,0.12)', c: '#C084FC', glow: '0 0 10px rgba(168,85,247,0.3)' },
  { key: 'trade', label: '실거래', bg: 'rgba(255,255,255,0.02)', bc: 'rgba(255,255,255,0.06)', c: '#FBBF24', glow: 'none' },
  { key: 'complex', label: '단지백과', bg: 'rgba(255,255,255,0.02)', bc: 'rgba(255,255,255,0.06)', c: '#22D3EE', glow: 'none' },
] as const;

const DC = ['#3B82F6', '#22C55E', '#EF4444', '#A855F7'];
const RC = ['#3B82F6','#8B5CF6','#06B6D4','#22C55E','#F59E0B','#EF4444','#EC4899','#14B8A6','#F97316','#A855F7','#6366F1','#0EA5E9','#84CC16','#E879F9','#FB923C','#2DD4BF','#818CF8'];

function MiniDonut({ sub, ongoing, unsold, redev, size = 34 }: { sub: number; ongoing: number; unsold: number; redev: number; size?: number }) {
  const tot = sub + ongoing + unsold + redev;
  const r = size * 0.38, sw = size * 0.13, cx = size / 2, ci = 2 * Math.PI * r;
  if (tot <= 0) return <svg width={size} height={size}><circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} opacity={0.3} /></svg>;
  const pcts = [sub / tot, ongoing / tot, unsold / tot, redev / tot];
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} opacity={0.15} />
      {pcts.map((p, i) => { const len = p * ci; if (len < 0.5) { off += len; return null; } const el = <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={DC[i]} strokeWidth={sw} strokeDasharray={`${len} ${ci - len}`} strokeDashoffset={-off} transform={`rotate(-90 ${cx} ${cx})`} />; off += len; return el; })}
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
      {/* KPI 카드 (클릭 → 탭 전환) */}
      <div className="kd-region-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4, marginBottom: 6 }}>
        {KPI_CFG.map(k => {
          const isAct = activeTab === k.key;
          return (
            <button key={k.key} onClick={() => k.key === 'complex' ? router.push('/apt/complex') : onTabChange?.(k.key)}
              style={{ padding: '6px 4px', borderRadius: 8, textAlign: 'center', cursor: 'pointer', background: `linear-gradient(135deg, ${k.bg}, transparent)`, border: `1px solid ${isAct ? k.c + '60' : k.bc}`, transition: 'all 0.15s', transform: isAct ? 'scale(1.03)' : 'none' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: k.c, textShadow: k.glow, fontVariantNumeric: 'tabular-nums' }}>
                {typeof kv[k.key] === 'number' ? (kv[k.key] as number).toLocaleString() : kv[k.key]}
              </div>
              <div style={{ fontSize: 9, color: k.c, opacity: 0.5, marginTop: 1 }}>{k.label}</div>
            </button>
          );
        })}
      </div>

      {/* 지역별 미니 도넛 그리드 */}
      <div className="kd-region-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 3 }}>
        {regions.map((r, i) => {
          const isAct = activeRegion === r.name;
          const isExp = expRegion === r.name;
          return (
            <button key={r.name} onClick={() => { onRegionClick?.(isAct ? '전체' : r.name); setExpRegion(isExp ? null : r.name); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '4px 2px', borderRadius: 8, cursor: 'pointer', background: isAct ? 'rgba(59,123,246,0.08)' : 'transparent', border: `1px solid ${isAct ? 'rgba(59,123,246,0.25)' : 'transparent'}`, transition: 'all 0.15s' }}>
              <MiniDonut sub={r.sub} ongoing={r.ongoing} unsold={r.unsold} redev={r.redev} size={34} />
              <span style={{ fontSize: 12, fontWeight: 700, color: RC[i % RC.length], fontVariantNumeric: 'tabular-nums' }}>{r.total.toLocaleString()}</span>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{r.name}</span>
            </button>
          );
        })}
      </div>

      {/* 상세 패널 */}
      {exp && (
        <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(59,123,246,0.04)', border: '1px solid rgba(59,123,246,0.1)', animation: 'kd-fadeIn 0.2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{exp.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{exp.total.toLocaleString()}건</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4 }}>
            {[{ v: exp.sub, l: '청약', c: '#60A5FA', bg: 'rgba(59,130,246,0.08)' }, { v: exp.ongoing, l: '분양', c: '#4ADE80', bg: 'rgba(34,197,94,0.08)' }, { v: exp.unsold, l: '미분양', c: '#F87171', bg: 'rgba(239,68,68,0.08)' }, { v: exp.redev, l: '재건축', c: '#C084FC', bg: 'rgba(168,85,247,0.08)' }, { v: exp.trade, l: '실거래', c: '#FBBF24', bg: 'rgba(245,158,11,0.08)' }].map((item, idx) => (
              <div key={idx} style={{ textAlign: 'center', padding: '4px', borderRadius: 6, background: item.bg }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: item.c }}>{item.v.toLocaleString()}</div>
                <div style={{ fontSize: 8, color: item.c, opacity: 0.6 }}>{item.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes kd-fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:640px){.kd-region-kpi{grid-template-columns:repeat(3,minmax(0,1fr))!important}.kd-region-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}`}</style>
    </div>
  );
}
