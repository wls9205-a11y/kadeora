'use client';
import { timeAgo as ago, fmt } from '@/lib/format';
import { useState, useEffect, useCallback } from 'react';



export default function DataTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<'freshness' | 'stock' | 'realestate' | 'blog' | 'seo'>('freshness');
  const [seoData, setSeoData] = useState<any>(null);

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
    { key: 'seo' as const, label: 'SEO/리라이트' },
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
          {/* 블로그 생산 속도 */}
          <div className="adm-kpi">
            <div className="adm-kpi-c">
              <div className="adm-kpi-v">{fmt(Object.values(blogCategories || []).reduce((s: number, c: any) => s + (c.cnt || 0), 0))}</div>
              <div className="adm-kpi-l">총 게시</div>
            </div>
            <div className="adm-kpi-c">
              <div className="adm-kpi-v">{fmt(Object.values(blogCategories || []).reduce((s: number, c: any) => s + (c.rewritten || 0), 0))}</div>
              <div className="adm-kpi-l">리라이팅 완료</div>
            </div>
            <div className="adm-kpi-c">
              <div className="adm-kpi-v">{fmt(Object.values(blogCategories || []).reduce((s: number, c: any) => s + (c.cnt || 0) - (c.rewritten || 0), 0))}</div>
              <div className="adm-kpi-l">대기</div>
            </div>
            <div className="adm-kpi-c">
              <div className="adm-kpi-v">72/일</div>
              <div className="adm-kpi-l">리라이팅 속도</div>
              <div className="adm-kpi-d" style={{ color: 'var(--text-tertiary)' }}>Haiku 6건×12회</div>
            </div>
          </div>

          {/* 카테고리별 품질 */}
          <div className="adm-sec">✍️ 카테고리별 리라이팅</div>
          <div className="adm-card" style={{ padding: '8px 14px' }}>
            {(blogCategories || []).map((c: any, i: number) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.category}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{fmt(c.rewritten)} / {fmt(c.cnt)} ({c.rewrite_pct}%)</span>
                </div>
                <div className="adm-bar" style={{ marginBottom: 0 }}>
                  <div className="adm-bar-fill" style={{ width: `${c.rewrite_pct}%`, background: c.rewrite_pct >= 80 ? '#10B981' : c.rewrite_pct >= 40 ? '#F59E0B' : '#EF4444' }} />
                </div>
              </div>
            ))}
          </div>
        </> 
      )}

      {sub === 'seo' && (() => {
        // Load SEO data on first view
        if (!seoData) {
          fetch('/api/admin/seo-status').then(r => r.json()).then(d => setSeoData(d)).catch(() => setSeoData({ error: true }));
          return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>SEO 데이터 로딩 중...</div>;
        }
        const { tierDist = [], batches = [], pruneStatus = {} } = seoData;
        return (
          <>
            <div className="adm-sec">📊 SEO Tier 분포</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
              {tierDist.map((t: any) => (
                <div key={t.tier} className="adm-kpi-c" style={{ padding: '8px 10px' }}>
                  <div className="adm-kpi-v" style={{ color: t.tier === 'S' ? '#10B981' : t.tier === 'A' ? '#3B82F6' : t.tier === 'B' ? '#F59E0B' : '#EF4444' }}>{fmt(t.cnt)}</div>
                  <div className="adm-kpi-l">{t.tier} tier</div>
                  <div className="adm-kpi-d">{t.published ? '게시' : '비공개'}</div>
                </div>
              ))}
            </div>

            <div className="adm-sec">🔄 Batch 리라이트 현황</div>
            <div className="adm-card" style={{ padding: '8px 14px' }}>
              {batches.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>배치 기록 없음</div>}
              {batches.map((b: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < batches.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.status === 'ended' ? '#10B981' : b.status === 'failed' ? '#EF4444' : '#F59E0B', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary)', minWidth: 60 }}>{ago(b.created_at)}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{b.batch_size}건</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{b.category}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ color: '#10B981', fontSize: 10 }}>✓{b.succeeded}</span>
                  {b.failed > 0 && <span style={{ color: '#EF4444', fontSize: 10 }}>✗{b.failed}</span>}
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>${b.cost_estimate}</span>
                </div>
              ))}
            </div>

            <div className="adm-sec">🗑️ 비공개 전환 현황</div>
            <div className="adm-card" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)' }}>게시 중</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(pruneStatus.published || 0)}편</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)' }}>비공개</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(pruneStatus.unpublished || 0)}편</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>B/C tier 남은 비공개 대상</span>
                <span style={{ color: '#F59E0B', fontWeight: 600 }}>{fmt(pruneStatus.remaining_prune || 0)}편</span>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
