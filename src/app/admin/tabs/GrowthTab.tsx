'use client';
import { useState, useEffect, useCallback } from 'react';

export default function GrowthTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch('/api/admin/v2?tab=growth').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading || !data) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>로딩 중...</div>;

  const { funnel, ctaStats, topPages, hourlyTraffic, featureUsage } = data;
  const maxHour = Math.max(...(hourlyTraffic || []), 1);
  const maxFeature = Math.max(...(featureUsage || []).map((f: any) => f.views), 1);

  return (
    <div>
      {/* 전환 퍼널 */}
      <div className="adm-sec">📈 전환 퍼널 (7일)</div>
      <div className="adm-card">
        {[
          { label: '페이지뷰', value: funnel.pv, pct: 100 },
          { label: '고유 방문자', value: funnel.uv, pct: funnel.pv > 0 ? (funnel.uv / funnel.pv) * 100 : 0 },
          { label: '가입', value: funnel.signups, pct: funnel.pv > 0 ? (funnel.signups / funnel.pv) * 100 : 0 },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ minWidth: 70, fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</span>
            <div style={{ flex: 1, height: 20, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(s.pct, 0.5)}%`, background: i === 0 ? 'var(--brand)' : i === 1 ? '#8B5CF6' : '#10B981', borderRadius: 4, transition: 'width .6s' }} />
            </div>
            <span style={{ minWidth: 60, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.value.toLocaleString()}</span>
          </div>
        ))}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
          전환율: <strong style={{ color: funnel.conversionRate >= 2 ? '#10B981' : '#F59E0B' }}>{funnel.conversionRate}%</strong> (목표 2.0%)
        </div>
      </div>

      {/* CTA별 성과 */}
      <div className="adm-sec">🎪 CTA 성과</div>
      <div className="adm-card" style={{ padding: '8px 14px' }}>
        <div style={{ display: 'flex', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
          <span style={{ flex: 1 }}>CTA</span>
          <span style={{ width: 45, textAlign: 'right' }}>노출</span>
          <span style={{ width: 45, textAlign: 'right' }}>클릭</span>
          <span style={{ width: 45, textAlign: 'right' }}>완료</span>
        </div>
        {['two_step', 'smart_gate', 'newsletter', 'exit_intent', 'return_banner', 'push_prompt'].map(name => {
          const s = (ctaStats || {})[name] || {};
          return (
            <div key={name} style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>{name}</span>
              <span style={{ width: 45, textAlign: 'right', color: 'var(--text-secondary)' }}>{s.cta_view || '—'}</span>
              <span style={{ width: 45, textAlign: 'right', color: 'var(--text-secondary)' }}>{s.cta_click || '—'}</span>
              <span style={{ width: 45, textAlign: 'right', color: 'var(--text-secondary)' }}>{s.cta_complete || '—'}</span>
            </div>
          );
        })}
        {Object.keys(ctaStats || {}).length === 0 && (
          <div style={{ textAlign: 'center', padding: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>추적 시스템 방금 배포 — 데이터 수집 대기 중</div>
        )}
      </div>

      {/* 기능 사용 히트맵 */}
      <div className="adm-sec">🗺️ 기능 사용 히트맵</div>
      <div className="adm-card" style={{ padding: '8px 14px' }}>
        {(featureUsage || []).map((f: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span style={{ minWidth: 60, fontSize: 12, color: 'var(--text-secondary)' }}>{f.feature}</span>
            <div style={{ flex: 1, height: 14, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(f.views / maxFeature) * 100}%`, background: f.views > 100 ? '#10B981' : f.views > 20 ? '#F59E0B' : '#EF4444', borderRadius: 3, minWidth: f.views > 0 ? 4 : 0 }} />
            </div>
            <span style={{ minWidth: 40, textAlign: 'right', fontSize: 11, color: 'var(--text-tertiary)' }}>{f.views}</span>
          </div>
        ))}
      </div>

      {/* 시간대별 트래픽 */}
      <div className="adm-sec">🕐 시간대별 트래픽 (KST)</div>
      <div className="adm-card" style={{ padding: '8px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
          {(hourlyTraffic || []).map((cnt: number, hr: number) => (
            <div key={hr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', height: `${(cnt / maxHour) * 60}px`, background: cnt === Math.max(...hourlyTraffic) ? '#3B82F6' : 'var(--bg-hover)', borderRadius: 2, minHeight: 2 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
          {[0, 6, 12, 18, 23].map(h => (
            <span key={h} style={{ flex: 1, fontSize: 9, color: 'var(--text-tertiary)', textAlign: 'center' }}>{h}시</span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, textAlign: 'center' }}>
          피크: {hourlyTraffic.indexOf(Math.max(...hourlyTraffic))}시 ({Math.max(...hourlyTraffic)}뷰)
        </div>
      </div>

      {/* 인기 페이지 */}
      <div className="adm-sec">📄 인기 페이지 TOP 10</div>
      <div className="adm-card" style={{ padding: '8px 14px' }}>
        {(topPages || []).slice(0, 10).map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: i < 9 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
            <span style={{ width: 18, color: 'var(--text-tertiary)', fontSize: 10, textAlign: 'center' }}>#{i + 1}</span>
            <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{p.views}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
