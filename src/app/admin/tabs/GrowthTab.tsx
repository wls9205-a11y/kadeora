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

  const { funnel, ctaStats, topPages, hourlyTraffic, featureUsage, dailyTrend, referrers, signupTrend, deviceSplit } = data;
  const maxHour = Math.max(...(hourlyTraffic || []), 1);
  const maxFeature = Math.max(...(featureUsage || []).map((f: any) => f.views), 1);
  const maxDailyPv = Math.max(...(dailyTrend || []).map((d: any) => d.pv), 1);
  const totalRef = Object.values(referrers || {}).reduce((s: number, v: any) => s + v, 0) as number;
  const totalDevice = Object.values(deviceSplit || {}).reduce((s: number, v: any) => s + v, 0) as number;

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
            <span style={{ minWidth: 60, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{s.value.toLocaleString()}</span>
          </div>
        ))}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
          전환율: <strong style={{ color: funnel.conversionRate >= 2 ? '#10B981' : '#F59E0B' }}>{funnel.conversionRate}%</strong> (목표 2.0%)
        </div>
      </div>

      {/* 14일 PV/UV 추이 차트 */}
      <div className="adm-sec">📊 14일 트래픽 추이</div>
      <div className="adm-card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
          {(dailyTrend || []).map((d: any, i: number) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{d.pv}</div>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <div style={{ height: `${(d.pv / maxDailyPv) * 70}px`, background: 'var(--brand)', borderRadius: 2, minHeight: 2, opacity: 0.3 }} />
                <div style={{ height: `${(d.uv / maxDailyPv) * 70}px`, background: 'var(--brand)', borderRadius: 2, minHeight: 2 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: 4 }}>
          {(dailyTrend || []).map((d: any, i: number) => (
            <div key={i} style={{ flex: 1, fontSize: 7, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              {i % 3 === 0 ? d.date?.slice(5) : ''}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--brand)', opacity: 0.3, borderRadius: 2, marginRight: 4 }} />PV</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--brand)', borderRadius: 2, marginRight: 4 }} />UV</span>
        </div>
      </div>

      {/* 유입 경로 + 디바이스 분포 */}
      <div className="adm-kpi">
        <div className="adm-kpi-c">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>유입 경로</div>
          {referrers && Object.entries(referrers).sort((a: any, b: any) => b[1] - a[1]).map(([src, cnt]: [string, any]) => (
            <div key={src} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{src}</span>
                <span style={{ fontWeight: 600 }}>{totalRef > 0 ? Math.round((cnt / totalRef) * 100) : 0}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${totalRef > 0 ? (cnt / totalRef) * 100 : 0}%`, background: src.includes('Google') ? '#4285F4' : src.includes('Naver') ? '#03C75A' : src.includes('Kakao') ? '#FEE500' : src.includes('Daum') ? '#F59E0B' : src === 'Direct' ? 'var(--brand)' : src.includes('Bing') ? '#00809D' : src.includes('DCinside') ? '#1E90FF' : src.includes('Instagram') ? '#E1306C' : src.includes('Facebook') ? '#1877F2' : src.includes('YouTube') ? '#FF0000' : src.includes('Zum') ? '#FF6B00' : 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="adm-kpi-c">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>디바이스</div>
          {deviceSplit && Object.entries(deviceSplit).sort((a: any, b: any) => b[1] - a[1]).map(([dev, cnt]: [string, any]) => (
            <div key={dev} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{dev === 'mobile' ? '📱 모바일' : dev === 'desktop' ? '🖥️ 데스크탑' : '🤖 봇'}</span>
                <span style={{ fontWeight: 600 }}>{totalDevice > 0 ? Math.round((cnt / totalDevice) * 100) : 0}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${totalDevice > 0 ? (cnt / totalDevice) * 100 : 0}%`, background: dev === 'mobile' ? '#10B981' : dev === 'desktop' ? 'var(--brand)' : '#F59E0B', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 일별 가입자 추이 */}
      {signupTrend && signupTrend.length > 0 && (
        <>
          <div className="adm-sec">👤 일별 가입자 (14일)</div>
          <div className="adm-card" style={{ padding: '8px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 50 }}>
              {signupTrend.map((d: any, i: number) => {
                const max = Math.max(...signupTrend.map((s: any) => s.count), 1);
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {d.count > 0 && <div style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>{d.count}</div>}
                    <div style={{ width: '100%', height: `${(d.count / max) * 35}px`, background: '#10B981', borderRadius: 2, minHeight: d.count > 0 ? 4 : 1, opacity: d.count > 0 ? 1 : 0.2 }} />
                    <div style={{ fontSize: 7, color: 'var(--text-tertiary)', marginTop: 2 }}>{d.date?.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* CTA 성과 */}
      <div className="adm-sec">🎪 CTA 성과 (7일)</div>
      <div className="adm-card" style={{ padding: '8px 14px' }}>
        {/* 요약 메트릭 */}
        {(() => {
          const allViews = Object.values(ctaStats || {}).reduce((s: number, e: any) => s + (e.cta_view || 0), 0);
          const allClicks = Object.values(ctaStats || {}).reduce((s: number, e: any) => s + (e.cta_click || 0), 0);
          const avgCtr = allViews > 0 ? (allClicks / allViews * 100).toFixed(2) : '0';
          return (
            <div style={{ display: 'flex', gap: 12, padding: '8px 0 12px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{allViews.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>총 노출</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{allClicks.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>총 클릭</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: parseFloat(avgCtr) > 1 ? '#10B981' : '#EF4444' }}>{avgCtr}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>평균 CTR</div>
              </div>
            </div>
          );
        })()}
        <div style={{ display: 'flex', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
          <span style={{ flex: 1 }}>CTA</span>
          <span style={{ width: 45, textAlign: 'right' }}>노출</span>
          <span style={{ width: 45, textAlign: 'right' }}>클릭</span>
          <span style={{ width: 55, textAlign: 'right' }}>CTR</span>
          <span style={{ width: 30, textAlign: 'right' }}>상태</span>
        </div>
        {Object.entries(ctaStats || {}).sort((a: any, b: any) => (b[1].cta_view || 0) - (a[1].cta_view || 0)).slice(0, 15).map(([name, events]: [string, any]) => {
          const views = events.cta_view || 0;
          const clicks = events.cta_click || 0;
          const ctr = views > 0 ? (clicks / views * 100) : 0;
          const status = ctr > 2 ? '🟢' : ctr > 0.5 ? '🟡' : views > 0 ? '🔴' : '⚪';
          return (
            <div key={name} style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12, alignItems: 'center' }}>
              <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ width: 45, textAlign: 'right', color: 'var(--text-secondary)' }}>{views || '—'}</span>
              <span style={{ width: 45, textAlign: 'right', color: 'var(--text-secondary)' }}>{clicks || '—'}</span>
              <span style={{ width: 55, textAlign: 'right', color: ctr > 1 ? '#10B981' : '#EF4444', fontWeight: 600 }}>{ctr.toFixed(1)}%</span>
              <span style={{ width: 30, textAlign: 'right', fontSize: 10 }}>{status}</span>
            </div>
          );
        })}
        {Object.keys(ctaStats || {}).length === 0 && (
          <div style={{ textAlign: 'center', padding: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>데이터 수집 중</div>
        )}
      </div>

      {/* 기능 사용 히트맵 */}
      <div className="adm-sec">🗺️ 기능 사용 히트맵</div>
      <div className="adm-card" style={{ padding: '8px 14px' }}>
        {(featureUsage || []).map((f: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span style={{ minWidth: 60, fontSize: 12, color: 'var(--text-secondary)' }}>{f.feature}</span>
            <div style={{ flex: 1, height: 14, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(f.views / maxFeature) * 100}%`, background: f.views > 100 ? '#10B981' : f.views > 20 ? '#F59E0B' : '#EF4444', borderRadius: 4, minWidth: f.views > 0 ? 4 : 0 }} />
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
            <div key={hr} style={{ flex: 1 }}>
              <div style={{ width: '100%', height: `${(cnt / maxHour) * 60}px`, background: cnt === Math.max(...hourlyTraffic) ? '#3B82F6' : 'var(--bg-hover)', borderRadius: 2, minHeight: 2 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
          {[0, 6, 12, 18, 23].map(h => (
            <span key={h} style={{ flex: 1, fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>{h}시</span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'center' }}>
          피크: {hourlyTraffic.indexOf(Math.max(...hourlyTraffic))}시 ({Math.max(...hourlyTraffic)}뷰)
        </div>
      </div>

      {/* 인기 페이지 */}
      <div className="adm-sec">📄 인기 페이지 TOP 10</div>
      <div className="adm-card" style={{ padding: '8px 14px' }}>
        {(topPages || []).slice(0, 10).map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: i < 9 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
            <span style={{ width: 18, color: 'var(--text-tertiary)', fontSize: 10 }}>#{i + 1}</span>
            <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{decodeURIComponent(p.path)}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{p.views}</span>
          </div>
        ))}
      </div>

      {/* 리텐션 코호트 */}
      {data.retentionCohort && data.retentionCohort.length > 0 && (<>
        <div className="adm-sec">🔄 리텐션 코호트 (주간)</div>
        <div className="adm-card" style={{ padding: '8px 14px', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 50px 50px 50px', gap: 4, fontSize: 11, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>코호트</span>
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>가입</span>
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>D7</span>
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>D30</span>
          </div>
          {data.retentionCohort.map((c: any, i: number) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 50px 50px 50px', gap: 4, fontSize: 11, padding: '3px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{c.cohort_week?.slice(5, 10)}</span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>{c.cohort_size}</span>
              <span style={{ textAlign: 'right', color: c.d7_retained > 0 ? '#10B981' : '#EF4444' }}>
                {c.cohort_size > 0 ? Math.round((c.d7_retained / c.cohort_size) * 100) : 0}%
              </span>
              <span style={{ textAlign: 'right', color: c.d30_retained > 0 ? '#10B981' : '#EF4444' }}>
                {c.cohort_size > 0 ? Math.round((c.d30_retained / c.cohort_size) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </>)}

      {/* 가입 귀속 (CTA별) */}
      {data.signupSources && Object.keys(data.signupSources).length > 0 && (<>
        <div className="adm-sec">🎯 가입 귀속 (signup_source)</div>
        <div className="adm-card" style={{ padding: '8px 14px' }}>
          {Object.entries(data.signupSources).sort((a: any, b: any) => b[1] - a[1]).map(([src, cnt]: [string, any], i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>{src}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{cnt}명</span>
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}
