'use client';
import { useState, useEffect, useCallback } from 'react';

export default function GrowthTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      fetch('/api/admin/v2?tab=growth').then(r => r.json()),
      fetch('/api/admin/v2?tab=focus').then(r => r.json()),
    ]).then(([growth, focus]) => {
      // growth 탭 응답에 focus의 extended/pushStats 병합
      setData({ ...growth, extended: focus?.extended, funnel: { ...growth.funnel, onboarded: focus?.kpi?.activeUsers, profileCompleted: focus?.growth?.profileCompleted } });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading || !data) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>로딩 중...</div>;

  const { funnel, ctaStats, topPages, hourlyTraffic, featureUsage, dailyTrend, referrers, signupTrend, deviceSplit, conversionMetrics, signupFunnel, deviceConv, ghostCtaCount } = data;
  const maxHour = Math.max(...(hourlyTraffic || []), 1);
  const maxFeature = Math.max(...(featureUsage || []).map((f: any) => f.views), 1);
  const maxDailyPv = Math.max(...(dailyTrend || []).map((d: any) => d.pv), 1);
  const totalRef = Object.values(referrers || {}).reduce((s: number, v: any) => s + v, 0) as number;
  const totalDevice = Object.values(deviceSplit || {}).reduce((s: number, v: any) => s + v, 0) as number;

  /* ── 전환 핵심 지표 계산 ── */
  const cm = conversionMetrics || {};
  const cgViews = cm.contentGate7d?.cta_view || ctaStats?.content_gate?.cta_view || 0;
  const cgClicks = cm.contentGate7d?.cta_click || ctaStats?.content_gate?.cta_click || 0;
  const cgCtr = cgViews > 0 ? (cgClicks / cgViews * 100) : 0;
  const biViews = cm.blogInlineCta7d?.cta_view || ctaStats?.blog_inline_cta?.cta_view || 0;
  const biClicks = cm.blogInlineCta7d?.cta_click || ctaStats?.blog_inline_cta?.cta_click || 0;
  const biCtr = biViews > 0 ? (biClicks / biViews * 100) : 0;
  // 전체 게이트 CTR (content_gate + blog_inline_cta 합산)
  const totalGateViews = cgViews + biViews;
  const totalGateClicks = cgClicks + biClicks;
  const totalGateCtr = totalGateViews > 0 ? (totalGateClicks / totalGateViews * 100) : 0;
  // OAuth 완료율 (signup_attempts 기반)
  const sf = signupFunnel || {};
  const totalAttempts = Object.values(sf).reduce((s: number, v: any) => s + v.attempts, 0);
  const totalCompletions = Object.values(sf).reduce((s: number, v: any) => s + v.completions, 0);
  const oauthRate = totalAttempts > 0 ? Math.round(totalCompletions / totalAttempts * 100) : 0;

  return (
    <div>
      {/* ── 전환 핵심 지표 (세션 98 개선 모니터링) ── */}
      <div className="adm-sec">🎯 전환 핵심 지표 (7일)</div>
      <div className="adm-card" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            {
              label: '게이트 CTR (합산)',
              value: `${totalGateCtr.toFixed(2)}%`,
              sub: `게이트 ${cgViews}뷰·${cgClicks}클 + 인라인 ${biViews}뷰·${biClicks}클`,
              good: totalGateCtr >= 2,
              target: '목표 3%+',
            },
            {
              label: 'OAuth 완료율',
              value: `${oauthRate}%`,
              sub: `시도 ${totalAttempts} · 완료 ${totalCompletions}`,
              good: oauthRate >= 40,
              target: '목표 40%+',
            },
            {
              label: '온보딩 완료율',
              value: `${cm.onboardRate ?? 0}%`,
              sub: `지역 ${cm.regionSetRate ?? 0}% · 마케팅 ${cm.marketingRate ?? 0}%`,
              good: (cm.onboardRate ?? 0) >= 80,
              target: '목표 85%+',
            },
          ].map((m, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '8px 6px', background: 'rgba(12,21,40,0.5)', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: m.good ? '#10B981' : '#EF4444' }}>{m.value}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: '2px 0' }}>{m.label}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>{m.sub}</div>
              <div style={{ fontSize: 10, color: m.good ? '#10B981' : '#F59E0B', marginTop: 3 }}>{m.target}</div>
            </div>
          ))}
        </div>
        {/* 관심단지 알림 등록 7일 신규 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 12 }}>
          <span style={{ color: 'var(--text-secondary)' }}>🔔 관심단지 알림 7일 신규 등록</span>
          <span style={{ fontWeight: 700, color: (cm.interestNew7d || 0) > 0 ? '#10B981' : 'var(--text-tertiary)' }}>
            {cm.interestNew7d ?? 0}건
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
          <span style={{ color: 'var(--text-secondary)' }}>📊 UV → 가입 전환율</span>
          <span style={{ fontWeight: 700, color: funnel?.conversionRate >= 1 ? '#10B981' : '#EF4444' }}>
            {funnel?.conversionRate ?? 0}%
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>(기준선 0.18%)</span>
          </span>
        </div>
        {/* ── Zero-Step 온보딩 분포 ── */}
        {cm.zeroStep && (() => {
          const zs = cm.zeroStep;
          const total = (zs.auto || 0) + (zs.manual || 0) + (zs.skip || 0) + (zs.notOnboarded || 0);
          if (total === 0) return null;
          const items = [
            { label: '⚡ 자동 (CTA)', value: zs.auto || 0, color: '#10B981' },
            { label: '📝 수동 (온보딩)', value: zs.manual || 0, color: '#3B82F6' },
            { label: '⏭️ 건너뛰기', value: zs.skip || 0, color: '#F59E0B' },
            { label: '❌ 미완료', value: zs.notOnboarded || 0, color: '#EF4444' },
          ];
          return (
            <div style={{ marginTop: 8, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                🚀 온보딩 방식 분포 ({total}명)
              </div>
              <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                {items.filter(i => i.value > 0).map((item, i) => (
                  <div key={i} style={{ width: `${(item.value / total) * 100}%`, background: item.color, minWidth: 2 }} title={`${item.label}: ${item.value}`} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 10 }}>
                {items.map((item, i) => (
                  <span key={i} style={{ color: item.color, fontWeight: 600 }}>
                    {item.label} {item.value} ({total > 0 ? Math.round(item.value / total * 100) : 0}%)
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
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

      {/* 프로필 완성 퍼널 */}
      {data.extended?.dataCollection && (() => {
        const dc = data.extended.dataCollection;
        const t = dc.total || 1;
        const items = [
          { label: '온보딩 완료', value: funnel.onboarded || 0, color: '#10B981' },
          { label: '관심사 설정', value: dc.interests || 0, color: '#8B5CF6' },
          { label: '지역 설정', value: dc.city || 0, color: dc.city / t > 0.5 ? '#10B981' : '#F59E0B' },
          { label: '마케팅 동의', value: dc.marketing || 0, color: dc.marketing / t > 0.3 ? '#F59E0B' : '#EF4444' },
          { label: '프로필 완성', value: funnel.profileCompleted || 0, color: '#3B82F6' },
        ];
        return (<>
          <div className="adm-sec">👤 프로필 완성 퍼널 ({t}명)</div>
          <div className="adm-card">
            {items.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ minWidth: 70, fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</span>
                <div style={{ flex: 1, height: 18, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(s.value / t * 100, 0.5)}%`, background: s.color, borderRadius: 4, transition: 'width .6s' }} />
                </div>
                <span style={{ minWidth: 70, textAlign: 'right', fontSize: 12, fontWeight: 600, color: s.color }}>
                  {s.value}/{t} ({Math.round(s.value / t * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </>);
      })()}

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
            <div key={i} style={{ flex: 1, fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>
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
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{d.date?.slice(5)}</div>
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

      {/* Source별 가입 퍼널 (30일) */}
      {signupFunnel && Object.keys(signupFunnel).length > 0 && (<>
        <div className="adm-sec">🎯 Source별 가입 퍼널 (30일)</div>
        <div className="adm-card" style={{ padding: '8px 14px' }}>
          <div style={{ display: 'flex', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
            <span style={{ flex: 1 }}>Source</span>
            <span style={{ width: 50, textAlign: 'right' }}>시도</span>
            <span style={{ width: 50, textAlign: 'right' }}>완료</span>
            <span style={{ width: 55, textAlign: 'right' }}>완료율</span>
          </div>
          {Object.entries(signupFunnel).sort((a: any, b: any) => b[1].completions - a[1].completions).map(([src, stats]: [string, any]) => {
            const rate = stats.attempts > 0 ? Math.round(stats.completions / stats.attempts * 100) : 0;
            return (
              <div key={src} style={{ display: 'flex', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12, alignItems: 'center' }}>
                <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src}</span>
                <span style={{ width: 50, textAlign: 'right', color: 'var(--text-secondary)' }}>{stats.attempts}</span>
                <span style={{ width: 50, textAlign: 'right', color: stats.completions > 0 ? '#10B981' : 'var(--text-tertiary)' }}>{stats.completions}</span>
                <span style={{ width: 55, textAlign: 'right', fontWeight: 600, color: rate >= 50 ? '#10B981' : rate >= 20 ? '#F59E0B' : '#EF4444' }}>{rate}%</span>
              </div>
            );
          })}
        </div>
      </>)}

      {/* Device별 전환 (7일) */}
      {deviceConv && Object.keys(deviceConv).length > 0 && (<>
        <div className="adm-sec">📱 Device별 전환 (7일)</div>
        <div className="adm-card" style={{ padding: '8px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
            {Object.entries(deviceConv).sort((a: any, b: any) => b[1].views - a[1].views).map(([dev, stats]: [string, any]) => {
              const ctr = stats.views > 0 ? (stats.clicks / stats.views * 100) : 0;
              const icon = dev === 'mobile' ? '📱' : dev === 'desktop' ? '🖥️' : '❓';
              return (
                <div key={dev} style={{ textAlign: 'center', padding: '8px 6px', background: 'rgba(12,21,40,0.5)', borderRadius: 8 }}>
                  <div style={{ fontSize: 18 }}>{icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: ctr >= 2 ? '#10B981' : '#EF4444', marginTop: 4 }}>{ctr.toFixed(1)}%</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{dev}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{stats.views}뷰 · {stats.clicks}클릭</div>
                </div>
              );
            })}
          </div>
        </div>
      </>)}

      {/* Ghost CTA 경고 */}
      {(ghostCtaCount || 0) > 0 && (
        <div style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', margin: '8px 0', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)', fontSize: 12, color: '#F59E0B' }}>
          ⚠ 삭제된 CTA에서 {ghostCtaCount.toLocaleString()}건의 유령 이벤트 감지 (브라우저 캐시)
        </div>
      )}

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
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
          {(hourlyTraffic || []).map((cnt: number, hr: number) => (
            <div key={hr} style={{ flex: 1 }}>
              <div style={{ width: '100%', height: `${(cnt / maxHour) * 60}px`, background: cnt === Math.max(...hourlyTraffic) ? '#3B82F6' : 'var(--bg-hover)', borderRadius: 2, minHeight: 2 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
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

      {/* 피드 커뮤니티 참여 */}
      {data.feedStats && (
        <>
          <div className="adm-sec">💬 피드 커뮤니티</div>
          <div className="adm-card" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
              {[
                { v: data.feedStats.totalVotes, l: '총 투표', c: '#3B82F6' },
                { v: data.feedStats.activePolls, l: '활성 투표', c: '#10B981' },
                { v: data.feedStats.pendingPredicts, l: '미결 예측', c: '#F59E0B' },
              ].map(s => (
                <div key={s.l} style={{ textAlign: 'center', padding: 6, background: 'rgba(12,21,40,0.5)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {[
                { icon: '📊', label: '투표', count: data.feedStats.polls, votes: data.feedStats.pollVotes },
                { icon: '⚔️', label: 'VS', count: data.feedStats.vs, votes: data.feedStats.vsVotes },
                { icon: '🔮', label: '예측', count: data.feedStats.predicts, votes: data.feedStats.predictVotes },
                { icon: '💬', label: '한마디', count: data.feedStats.shorts, votes: null },
              ].map(f => (
                <div key={f.label} style={{ textAlign: 'center', padding: '4px', fontSize: 11 }}>
                  <div>{f.icon}</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{f.count}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{f.label}</div>
                  {f.votes !== null && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{f.votes}표</div>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

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

      {/* 알림 채널 성과 */}
      {data.extended?.pushStats && (() => {
        const ps = data.extended.pushStats;
        return (<>
          <div className="adm-sec">🔔 알림 채널 성과</div>
          <div className="adm-card" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
              {[
                { v: ps.pushSubs || 0, l: '푸시 구독자', c: '#F59E0B' },
                { v: `${ps.avgCtr || 0}%`, l: '푸시 CTR', c: (ps.avgCtr || 0) > 5 ? '#10B981' : '#EF4444' },
                { v: `${ps.notifReadRate24 || 0}%`, l: '알림 읽음률', c: (ps.notifReadRate24 || 0) > 30 ? '#10B981' : '#EF4444' },
              ].map(s => (
                <div key={s.l} style={{ textAlign: 'center', padding: 6, background: 'rgba(12,21,40,0.5)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              채널: 웹 푸시(무료 3건/일) · 이메일(무료 1건/일) · 카카오(8.4원 1건/일)
            </div>
          </div>
        </>);
      })()}

      {/* 가입 귀속 (CTA별) — 원래 위치 */}
      {/* 재개발 현황 */}
      {data.redevStats && (() => {
        const rs = data.redevStats;
        const total = rs.total || 1;
        const items = [
          { l: '주택', v: rs.residential, p: Math.round(rs.residential / total * 100), c: '#8B5CF6' },
          { l: '도시정비', v: rs.dosi, p: Math.round(rs.dosi / total * 100), c: '#64748B' },
          { l: '세대수', v: rs.withHouseholds, p: Math.round(rs.withHouseholds / total * 100), c: rs.withHouseholds / total > 0.3 ? '#10B981' : '#EF4444' },
          { l: '좌표', v: rs.withGeo, p: Math.round(rs.withGeo / total * 100), c: rs.withGeo / total > 0.3 ? '#10B981' : '#EF4444' },
          { l: 'AI요약', v: rs.withAi, p: Math.round(rs.withAi / total * 100), c: rs.withAi / total > 0.5 ? '#10B981' : '#F59E0B' },
          { l: '시공사', v: rs.withConstructor, p: Math.round(rs.withConstructor / total * 100), c: '#3B82F6' },
        ];
        return (<>
          <div className="adm-sec">🏗️ 재개발 데이터 현황 ({rs.total}건)</div>
          <div className="adm-card" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ textAlign: 'center', flex: 1, padding: 6, background: 'rgba(139,92,246,0.1)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#8B5CF6' }}>{rs.residential}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>주택 재개발/재건축</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, padding: 6, background: 'rgba(100,116,139,0.1)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#64748B' }}>{rs.dosi}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>도시환경정비</div>
              </div>
            </div>
            {items.slice(2).map(s => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                <span style={{ fontSize: 11, minWidth: 44, color: 'var(--text-secondary)' }}>{s.l}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.p}%`, background: s.c, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, minWidth: 60, textAlign: 'right', color: s.c, fontWeight: 600 }}>{s.v}/{rs.total} ({s.p}%)</span>
              </div>
            ))}
          </div>
        </>);
      })()}

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
