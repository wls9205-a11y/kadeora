'use client';
import { useState, useEffect, useCallback } from 'react';

function ago(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

function fmt(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function DataTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<'freshness' | 'stock' | 'realestate' | 'blog'>('freshness');

  const load = useCallback(() => {
    fetch('/api/admin/v2?tab=data').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading || !data || data.error) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>로딩 중...</div>;

  const { freshness, stock, realestate, blogCategories } = data;

  // 신선도 분류
  const fresh: [string, any][] = [];
  const stale: [string, any][] = [];
  const old: [string, any][] = [];
  for (const [name, info] of Object.entries(freshness || {}) as [string, any][]) {
    const ageMs = Date.now() - new Date(info.at).getTime();
    if (ageMs < 3600000) fresh.push([name, info]);
    else if (ageMs < 21600000) stale.push([name, info]);
    else old.push([name, info]);
  }

  const subTabs = [
    { key: 'freshness' as const, label: '신선도' },
    { key: 'stock' as const, label: '주식' },
    { key: 'realestate' as const, label: '부동산' },
    { key: 'blog' as const, label: '블로그' },
  ];

  return (
    <div>
      {/* 서브탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {subTabs.map(t => (
          <button key={t.key} className="adm-btn" style={sub === t.key ? { borderColor: 'var(--brand)', color: 'var(--brand)', fontWeight: 700 } : {}} onClick={() => setSub(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'freshness' && (
        <>
          <div className="adm-sec">🟢 실시간 (1시간 이내)</div>
          {fresh.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 8 }}>없음</div> : null}
          {fresh.map(([name, info]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
              <span style={{ color: '#10B981' }}>●</span>
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>{name}</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{ago(info.at)}</span>
              {info.records > 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{info.records}건</span>}
            </div>
          ))}

          <div className="adm-sec">🟡 최근 (1~6시간)</div>
          {stale.map(([name, info]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
              <span style={{ color: '#F59E0B' }}>●</span>
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>{name}</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{ago(info.at)}</span>
            </div>
          ))}

          <div className="adm-sec">🔴 오래됨 (6시간+)</div>
          {old.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 8 }}>없음</div> : null}
          {old.map(([name, info]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
              <span style={{ color: '#EF4444' }}>●</span>
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>{name}</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{ago(info.at)}</span>
            </div>
          ))}
        </>
      )}

      {sub === 'stock' && (
        <>
          <div className="adm-sec">📈 주식 데이터 커버리지</div>
          <div className="adm-card">
            {[
              { label: '총 종목', value: stock.total, max: stock.total },
              { label: '시세 有', value: stock.active, max: stock.total },
              { label: '섹터 有', value: stock.withSector, max: stock.total },
              { label: '설명 有', value: stock.withDesc, max: stock.total },
            ].map((s, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(s.value)} / {fmt(s.max)} ({Math.round(s.value / Math.max(s.max, 1) * 100)}%)</span>
                </div>
                <div className="adm-bar"><div className="adm-bar-fill" style={{ width: `${(s.value / Math.max(s.max, 1)) * 100}%`, background: s.value / Math.max(s.max, 1) > 0.8 ? '#10B981' : '#F59E0B' }} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      {sub === 'realestate' && (
        <>
          <div className="adm-sec">🏢 부동산 데이터</div>
          <div className="adm-kpi">
            {[
              { label: '분양사이트', value: realestate.sites },
              { label: '이미지有', value: realestate.withImages },
              { label: '매매거래', value: realestate.transactions },
              { label: '전월세', value: realestate.rentTransactions },
              { label: '단지백과', value: realestate.complexProfiles },
            ].map((s, i) => (
              <div key={i} className="adm-kpi-c">
                <div className="adm-kpi-v">{fmt(s.value)}</div>
                <div className="adm-kpi-l">{s.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {sub === 'blog' && (
        <>
          <div className="adm-sec">✍️ 블로그 품질</div>
          <div className="adm-card" style={{ padding: '8px 14px' }}>
            <div style={{ display: 'flex', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
              <span style={{ flex: 1 }}>카테고리</span>
              <span style={{ width: 55, textAlign: 'right' }}>총수</span>
              <span style={{ width: 55, textAlign: 'right' }}>리라이팅</span>
              <span style={{ width: 45, textAlign: 'right' }}>비율</span>
            </div>
            {(blogCategories || []).map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 600 }}>{c.category}</span>
                <span style={{ width: 55, textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(c.cnt)}</span>
                <span style={{ width: 55, textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(c.rewritten)}</span>
                <span style={{ width: 45, textAlign: 'right', fontWeight: 600, color: c.rewrite_pct >= 80 ? '#10B981' : c.rewrite_pct >= 40 ? '#F59E0B' : '#EF4444' }}>{c.rewrite_pct}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
