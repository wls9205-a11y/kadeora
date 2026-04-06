'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

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

export default function FocusTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/v2?tab=focus').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>로딩 중...</div>;
  if (!data || data.error) return (
    <div className="adm-card" style={{ textAlign: 'center', padding: 30 }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>데이터 로드 실패</div>
      <button className="adm-btn" style={{ marginTop: 12 }} onClick={load}>다시 시도</button>
    </div>
  );

  const { healthScore = 0, scoreBreakdown = {}, kpi = {} as any, failedCrons = {}, recentActivity = [], dailyTrend = [], trafficDetail = {} as any } = data;
  const failCount = Object.keys(failedCrons || {}).length;
  const scoreColor = healthScore >= 71 ? '#10B981' : healthScore >= 41 ? '#F59E0B' : '#EF4444';
  const scoreLabel = healthScore >= 71 ? '양호' : healthScore >= 41 ? '주의' : '위험';
  const cronRate = Math.round((kpi.cronSuccess / Math.max(kpi.cronSuccess + kpi.cronFail, 1)) * 100);
  const dbPct = Math.round(kpi.dbMb / 81.92) / 10;

  // 이번 주 할 일
  const actions: { color: string; title: string; desc: string; tab?: string }[] = [];
  if (kpi.returnRate === 0) actions.push({ color: '#EF4444', title: '재방문율 0%', desc: `${kpi.users}명 전원 이탈. D+1 웰컴 배포 완료 — 효과 모니터링`, tab: 'users' });
  if (kpi.interests <= 1) actions.push({ color: '#F59E0B', title: `관심등록 ${kpi.interests}건`, desc: `청약 ${fmt(kpi.apts)}건 중 등록 ${kpi.interests}건. CTA 재검토`, tab: 'users' });
  if (kpi.rewriteRate < 50) actions.push({ color: '#3B82F6', title: `리라이팅 ${kpi.rewriteRate}%`, desc: `${fmt(kpi.blogs - kpi.rewritten)}건 대기 → ${Math.round((kpi.blogs - kpi.rewritten) / 36)}일`, tab: 'data' });
  if (kpi.emailSubs + kpi.pushSubs === 0) actions.push({ color: '#8B5CF6', title: '구독자 0명', desc: '이메일+푸시 배포 직후. 첫 구독자 대기', tab: 'growth' });

  // 14일 트렌드
  const trend = [...(dailyTrend || [])].reverse();
  const todayPv = trend.length > 0 ? (trend[trend.length - 1]?.total_page_views || 0) : 0;
  const maxPv = Math.max(...trend.map((d: any) => d.total_page_views || 0), 1);
  const todayDau = trend.length > 0 ? (trend[trend.length - 1]?.dau || 0) : 0;

  // 점수 상세 항목
  const breakdownItems = [
    { label: '크론', score: scoreBreakdown.cronHealth || 0, max: 15, color: '#10B981' },
    { label: '신규유저', score: scoreBreakdown.newUsers || 0, max: 15, color: '#3B82F6' },
    { label: '재방문', score: scoreBreakdown.returnRate || 0, max: 15, color: '#EF4444' },
    { label: '전환율', score: scoreBreakdown.conversionRate || 0, max: 10, color: '#F59E0B' },
    { label: '리라이팅', score: scoreBreakdown.rewriteRate || 0, max: 10, color: '#8B5CF6' },
    { label: '구독', score: scoreBreakdown.subscriptions || 0, max: 10, color: '#EC4899' },
    { label: '데이터', score: scoreBreakdown.dataFreshness || 0, max: 10, color: '#06B6D4' },
    { label: 'DB여유', score: scoreBreakdown.dbHeadroom || 0, max: 5, color: '#6B7280' },
  ];

  return (
    <div>
      {/* ═══ 건강 점수 + 점수 분해 ═══ */}
      <div className="adm-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {/* 원형 게이지 */}
          <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
            <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="7" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="7"
                strokeDasharray={`${healthScore * 2.64} 264`} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{healthScore}</div>
              <div style={{ fontSize: 10, color: scoreColor, fontWeight: 600 }}>{scoreLabel}</div>
            </div>
          </div>
          {/* 점수 분해 바 */}
          <div style={{ flex: 1 }}>
            {breakdownItems.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ minWidth: 42, fontSize: 9, color: 'var(--text-tertiary)' }}>{b.label}</span>
                <div style={{ flex: 1, height: 5, background: 'var(--bg-hover)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${(b.score / b.max) * 100}%`, background: b.color, borderRadius: 3, transition: 'width .5s' }} />
                </div>
                <span style={{ minWidth: 20, fontSize: 9, color: 'var(--text-tertiary)', textAlign: 'right' }}>{Math.round(b.score)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ 시스템 상태 스트립 ═══ */}
      <div style={{ display: 'flex', gap: 6, margin: '8px 0', flexWrap: 'wrap' }}>
        {[
          { label: `크론 ${cronRate}%`, ok: cronRate >= 90, warn: cronRate >= 70 },
          { label: `DB ${dbPct}%`, ok: dbPct < 70, warn: dbPct < 90 },
          { label: `유저 ${kpi.users}`, ok: kpi.users > 0, warn: true },
          { label: `재방문 ${kpi.returnRate}%`, ok: kpi.returnRate > 0, warn: false },
          { label: `푸시 ${kpi.pushSubs}`, ok: kpi.pushSubs > 0, warn: false },
          { label: `이메일 ${kpi.emailSubs}`, ok: kpi.emailSubs > 0, warn: false },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-secondary)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.ok ? '#10B981' : s.warn ? '#F59E0B' : '#EF4444' }} />
            {s.label}
          </div>
        ))}
      </div>

      {/* ═══ 6-KPI 그리드 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '8px 0' }}>
        {[
          { v: kpi.users, l: '실유저', d: `+${kpi.newUsers} 주간`, c: kpi.newUsers > 0 ? '#10B981' : '' },
          { v: fmt(kpi.blogs), l: '블로그', d: `RW ${kpi.rewriteRate}%`, c: '#10B981' },
          { v: `${kpi.returnRate}%`, l: '재방문율', d: kpi.returnRate === 0 ? '위험' : '목표20%', c: kpi.returnRate === 0 ? '#EF4444' : '#10B981' },
          { v: fmt(kpi.stocks), l: '종목', d: `부동산 ${fmt(kpi.apts)}`, c: '' },
          { v: todayPv, l: 'PV 오늘', d: `DAU ${todayDau}`, c: todayPv > 0 ? '#10B981' : '' },
          { v: kpi.interests, l: '관심등록', d: `전환 ${kpi.conversions}`, c: kpi.interests > 0 ? '#10B981' : '#EF4444' },
        ].map((k, i) => (
          <div key={i} className="adm-kpi-c" style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{k.v}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{k.l}</div>
            <div style={{ fontSize: 9, color: k.c || 'var(--text-tertiary)', marginTop: 1 }}>{k.d}</div>
          </div>
        ))}
      </div>

      {/* ═══ 14일 트래픽 차트 ═══ */}
      {trend.length > 1 && (
        <div className="adm-card" style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
            <span>14일 PV 추이</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>오늘 {todayPv}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 55 }}>
            {trend.map((d: any, i: number) => {
              const pv = d.total_page_views || 0;
              const isToday = i === trend.length - 1;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {isToday && <div style={{ fontSize: 8, color: 'var(--brand)', fontWeight: 700, marginBottom: 1 }}>{pv}</div>}
                  <div style={{
                    width: '100%', borderRadius: 2, minHeight: 3,
                    height: `${(pv / maxPv) * 42}px`,
                    background: isToday ? 'var(--brand)' : pv > 0 ? 'rgba(59,130,246,0.25)' : 'var(--bg-hover)',
                  }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-tertiary)', marginTop: 2 }}>
            <span>{trend[0]?.stat_date?.slice(5)}</span>
            <span>{trend[Math.floor(trend.length / 2)]?.stat_date?.slice(5)}</span>
            <span>오늘</span>
          </div>
        </div>
      )}

      {/* ═══ 트래픽 실시간 요약 ═══ */}
      {trafficDetail && (trafficDetail.todayTotal > 0 || (trafficDetail.recent || []).length > 0) && (
        <>
          <div className="adm-sec">📊 트래픽 상세 (오늘)</div>
          {/* PV/UV + 시간대 분포 */}
          <div className="adm-card" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{trafficDetail.todayTotal || 0}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>PV 오늘</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand)' }}>{trafficDetail.todayUV || 0}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>UV 오늘</div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 9, color: 'var(--text-tertiary)' }}>
                30초마다 갱신
              </div>
            </div>
            {/* 시간대 막대 */}
            {(trafficDetail.hourly || []).length > 0 && (() => {
              const maxH = Math.max(...(trafficDetail.hourly || []).map((h: any) => h.c), 1);
              const currentHour = new Date().getHours();
              return (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>시간대별 PV</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 32 }}>
                    {(trafficDetail.hourly || []).map((h: any) => (
                      <div key={h.h} style={{
                        flex: 1, borderRadius: 1, minHeight: 2,
                        height: `${(h.c / maxH) * 28}px`,
                        background: h.h === currentHour ? 'var(--brand)' : h.c > 0 ? 'rgba(59,130,246,0.3)' : 'var(--bg-hover)',
                      }} title={`${h.h}시: ${h.c}건`} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    <span>0시</span><span>6</span><span>12</span><span>18</span><span>23시</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 인기 페이지 TOP 10 */}
          {(trafficDetail.topPages || []).length > 0 && (
            <div className="adm-card" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>🔥 인기 페이지 (오늘)</div>
              {(trafficDetail.topPages || []).map((p: any, i: number) => {
                const maxC = trafficDetail.topPages[0]?.count || 1;
                const label = p.path.length > 40 ? p.path.slice(0, 40) + '…' : p.path;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ minWidth: 14, fontSize: 9, fontWeight: 700, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)', textAlign: 'right' }}>{i + 1}</span>
                    <div style={{ flex: 1, position: 'relative', height: 18, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(p.count / maxC) * 100}%`, background: i < 3 ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.07)', borderRadius: 3 }} />
                      <span style={{ position: 'absolute', left: 6, top: 2, fontSize: 9, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</span>
                    </div>
                    <span style={{ minWidth: 24, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>{p.count}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 최근 조회 내역 (1시간) */}
          {(trafficDetail.recent || []).length > 0 && (
            <div className="adm-card" style={{ padding: '6px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', padding: '4px 0 6px' }}>🕐 최근 조회 (1시간)</div>
              {(trafficDetail.recent || []).map((r: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: i < trafficDetail.recent.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 10 }}>
                  <span style={{ fontSize: 12 }}>{r.device}</span>
                  <span style={{ minWidth: 36, fontSize: 8, color: 'var(--text-tertiary)' }}>{ago(r.at)}</span>
                  <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.path.length > 35 ? r.path.slice(0, 35) + '…' : r.path}
                  </span>
                  <span style={{
                    fontSize: 8, padding: '1px 4px', borderRadius: 3,
                    background: r.ref === 'Google' ? '#10B98115' : r.ref === 'Naver' ? '#06B6D415' : r.ref === 'Kakao' ? '#FEE50030' : 'var(--bg-hover)',
                    color: r.ref === 'Google' ? '#10B981' : r.ref === 'Naver' ? '#06B6D4' : r.ref === 'Kakao' ? '#D97706' : 'var(--text-tertiary)',
                  }}>{r.ref}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ 긴급 알림 (컴팩트) ═══ */}
      {(kpi.returnRate === 0 || failCount > 0) && (
        <div className="adm-card" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>알림</div>
          {kpi.returnRate === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)' }}>재방문율 0% — {kpi.users}명 전원 이탈</span>
              <span style={{ flex: 1 }} />
              <button className="adm-btn" style={{ fontSize: 9, padding: '2px 6px' }} onClick={() => onNavigate('users')}>확인</button>
            </div>
          )}
          {failCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)' }}>크론 {failCount}개 실패: {Object.keys(failedCrons).slice(0, 2).join(', ')}</span>
              <span style={{ flex: 1 }} />
              <button className="adm-btn" style={{ fontSize: 9, padding: '2px 6px' }} onClick={() => onNavigate('ops')}>확인</button>
            </div>
          )}
        </div>
      )}

      {/* ═══ 이번 주 집중 ═══ */}
      <div className="adm-sec">🎯 이번 주 집중</div>
      {actions.map((a, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${a.color}`, borderRadius: '0 10px 10px 0', cursor: a.tab ? 'pointer' : 'default' }}
          onClick={() => a.tab && onNavigate(a.tab)}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${a.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: a.color, flexShrink: 0 }}>
            {i + 1}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{a.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{a.desc}</div>
          </div>
          {a.tab && <span style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>›</span>}
        </div>
      ))}

      {/* ═══ 시스템 요약 ═══ */}
      <div className="adm-sec">🔧 시스템</div>
      <div className="adm-card" style={{ padding: '10px 14px' }}>
        {/* 크론 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 32 }}>크론</span>
          <div style={{ flex: 1, height: 8, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${cronRate}%`, background: cronRate >= 95 ? '#10B981' : '#F59E0B', borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: cronRate >= 95 ? '#10B981' : '#F59E0B', minWidth: 36, textAlign: 'right' }}>{cronRate}%</span>
        </div>
        {/* DB 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 32 }}>DB</span>
          <div style={{ flex: 1, height: 8, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${dbPct}%`, background: dbPct < 50 ? '#10B981' : dbPct < 80 ? '#F59E0B' : '#EF4444', borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 36, textAlign: 'right' }}>{dbPct}%</span>
        </div>
        {/* 하단 숫자들 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-tertiary)' }}>
          <span>성공 {kpi.cronSuccess}</span>
          <span style={{ color: kpi.cronFail > 0 ? '#EF4444' : '' }}>실패 {kpi.cronFail}</span>
          <span>·</span>
          <span>{fmt(kpi.dbMb)}MB / 8.2GB</span>
        </div>
      </div>

      {/* ═══ 인사이트 ═══ */}
      <div className="adm-sec">💡 인사이트</div>
      <div className="adm-card" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {kpi.returnRate === 0 && (
          <div style={{ marginBottom: 6 }}>📌 실유저 {kpi.users}명 전원 이탈 — D+1 웰컴 알림 배포 완료. 내일부터 재방문율 변화 모니터링.</div>
        )}
        {kpi.interests <= 1 && (
          <div style={{ marginBottom: 6 }}>🏢 관심단지 등록 {kpi.interests}건 (청약 {fmt(kpi.apts)}건 중 {(kpi.interests / Math.max(kpi.apts, 1) * 100).toFixed(2)}%). CTA 메시지/위치 재점검.</div>
        )}
        <div>📈 블로그 {fmt(kpi.blogs)}편 (RW {kpi.rewriteRate}%). 36건/일 속도 → {Math.round((kpi.blogs - kpi.rewritten) / 36)}일 후 완료.</div>
      </div>

      {/* ═══ 최근 활동 ═══ */}
      <div className="adm-sec">🕐 최근 활동</div>
      <div className="adm-card" style={{ padding: '6px 14px' }}>
        {(recentActivity || []).map((a: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 11 }}>
            <span style={{ minWidth: 46, fontSize: 9, color: 'var(--text-tertiary)' }}>{ago(a.at)}</span>
            {a.type === 'cron' ? (
              <>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.status === 'success' ? '#10B981' : '#EF4444', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>{a.name}</span>
                {a.count > 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{a.count}건</span>}
              </>
            ) : (
              <>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)' }}>{a.name}</span>
                {a.city && <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{a.city}</span>}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
