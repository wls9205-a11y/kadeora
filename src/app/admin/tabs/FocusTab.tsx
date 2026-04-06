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
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{data?.error || '서버 응답 없음'}</div>
      <button className="adm-btn" style={{ marginTop: 12 }} onClick={load}>다시 시도</button>
    </div>
  );

  const { healthScore = 0, kpi = {} as any, failedCrons = {}, recentActivity = [], dailyTrend = [] } = data;
  const failCount = Object.keys(failedCrons || {}).length;

  // 건강 점수 색상
  const scoreColor = healthScore >= 71 ? '#10B981' : healthScore >= 41 ? '#F59E0B' : '#EF4444';
  const scoreLabel = healthScore >= 71 ? '양호' : healthScore >= 41 ? '주의' : '위험';

  // 이번 주 할 일 자동 생성
  const actions: { priority: string; color: string; title: string; desc: string; action?: string }[] = [];
  if (kpi.returnRate === 0) {
    actions.push({ priority: '1순위', color: '#EF4444', title: '재방문율 0% 해결', desc: `실유저 ${kpi.users}명 전원 가입 후 재방문 없음. D+1 웰컴 푸시 + 관심 지역 맞춤 알림 필요.`, action: '상세' });
  }
  if (kpi.interests <= 1) {
    actions.push({ priority: actions.length === 0 ? '1순위' : '2순위', color: '#F59E0B', title: `관심단지 등록 ${kpi.interests}건`, desc: `청약 ${fmt(kpi.apts)}건 중 관심등록 ${kpi.interests}건(${(kpi.interests / Math.max(kpi.apts, 1) * 100).toFixed(2)}%). CTA 위치/메시지 재검토.` });
  }
  if (kpi.rewriteRate < 50) {
    actions.push({ priority: actions.length < 2 ? `${actions.length + 1}순위` : '3순위', color: '#3B82F6', title: `블로그 리라이팅 ${kpi.rewriteRate}%`, desc: `${fmt(kpi.blogs - kpi.rewritten)}건 대기. 현재 36건/일 → ${Math.round((kpi.blogs - kpi.rewritten) / 36)}일 소요.` });
  }
  if (actions.length < 3 && kpi.emailSubs === 0 && kpi.pushSubs === 0) {
    actions.push({ priority: `${actions.length + 1}순위`, color: '#8B5CF6', title: '구독자 0명', desc: '이메일 + 푸시 구독 시스템 배포 직후. 첫 구독자 확보가 재방문 엔진의 시작.' });
  }

  // 14일 추이에서 전주 대비
  const prevWeek = (dailyTrend || [])[7];
  const thisWeek = (dailyTrend || [])[0];

  return (
    <div>
      {/* 건강 점수 */}
      <div className="adm-card" style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 12px' }}>
          <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none" stroke={scoreColor} strokeWidth="8"
              strokeDasharray={`${healthScore * 3.27} 327`} strokeLinecap="round" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: scoreColor }}>{healthScore}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>/ 100</div>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: scoreColor }}>{scoreLabel}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          카더라 건강 점수
          {prevWeek && thisWeek && (
            <span> · 전주 대비 {thisWeek.total_users > prevWeek.total_users ? '▲' : '▼'}</span>
          )}
        </div>
      </div>

      {/* 핵심 KPI */}
      <div className="adm-kpi">
        <div className="adm-kpi-c">
          <div className="adm-kpi-v">{kpi.users}</div>
          <div className="adm-kpi-l">실유저</div>
          <div className="adm-kpi-d" style={{ color: kpi.newUsers > 0 ? '#10B981' : 'var(--text-tertiary)' }}>+{kpi.newUsers} 이번 주</div>
        </div>
        <div className="adm-kpi-c">
          <div className="adm-kpi-v">{fmt(kpi.blogs)}</div>
          <div className="adm-kpi-l">블로그</div>
          <div className="adm-kpi-d" style={{ color: '#10B981' }}>리라이팅 {kpi.rewriteRate}%</div>
        </div>
        <div className="adm-kpi-c">
          <div className="adm-kpi-v">{fmt(kpi.stocks)}</div>
          <div className="adm-kpi-l">종목</div>
          <div className="adm-kpi-d" style={{ color: 'var(--text-tertiary)' }}>부동산 {fmt(kpi.apts)}</div>
        </div>
        <div className="adm-kpi-c">
          <div className="adm-kpi-v">{kpi.returnRate}%</div>
          <div className="adm-kpi-l">재방문율</div>
          <div className="adm-kpi-d" style={{ color: kpi.returnRate === 0 ? '#EF4444' : '#10B981' }}>
            {kpi.returnRate === 0 ? '⚠️ 위험' : '목표 20%'}
          </div>
        </div>
      </div>

      {/* 14일 트래픽 미니 차트 */}
      {dailyTrend && dailyTrend.length > 1 && (() => {
        const trend = [...dailyTrend].reverse();
        const maxPv = Math.max(...trend.map((d: any) => d.total_page_views || 0), 1);
        return (
          <div className="adm-card" style={{ padding: '8px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
              <span>일별 PV (14일)</span>
              <span>오늘 {trend[trend.length - 1]?.total_page_views || 0}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
              {trend.map((d: any, i: number) => (
                <div key={i} style={{ flex: 1, height: `${((d.total_page_views || 0) / maxPv) * 35}px`, background: i === trend.length - 1 ? 'var(--brand)' : 'var(--bg-hover)', borderRadius: 2, minHeight: 2 }} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* 긴급 알림 */}
      {kpi.returnRate === 0 && (
        <div className="adm-alert adm-alert-red">
          🔴 실유저 {kpi.users}명 전원 가입 후 재방문 0회 (last_active_at = NULL)
        </div>
      )}
      {failCount > 0 && (
        <div className="adm-alert adm-alert-yellow">
          ⚠️ 크론 {failCount}개 실패 (24h): {Object.entries(failedCrons).map(([k, v]: [string, any]) => `${k}(${v.count}회)`).join(', ')}
          <br /><button className="adm-btn" style={{ marginTop: 6, fontSize: 11 }} onClick={() => onNavigate('ops')}>운영 탭에서 확인</button>
        </div>
      )}
      {(kpi.emailSubs + kpi.pushSubs + kpi.conversions) === 0 && (
        <div className="adm-alert adm-alert-green">
          ✅ 전환 추적 + 이메일/푸시 구독 시스템 배포 완료 — 데이터 수집 시작 대기 중
        </div>
      )}

      {/* 이번 주 할 일 */}
      <div className="adm-sec">🎯 이번 주 집중</div>
      {actions.map((a, i) => (
        <div key={i} className="adm-card" style={{ borderLeft: `3px solid ${a.color}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: a.color, background: `${a.color}15`, padding: '2px 6px', borderRadius: 4 }}>{a.priority}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{a.title}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{a.desc}</div>
        </div>
      ))}

      {/* 크론 + 리소스 */}
      <div className="adm-sec">🔧 시스템</div>
      <div className="adm-card">
        <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 6 }}>
          <span><span style={{ color: '#10B981', fontWeight: 700 }}>{kpi.cronSuccess}</span> 성공</span>
          <span><span style={{ color: '#EF4444', fontWeight: 700 }}>{kpi.cronFail}</span> 실패</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: 'var(--text-tertiary)' }}>24시간</span>
        </div>
        <div className="adm-bar">
          <div className="adm-bar-fill" style={{ width: `${(kpi.cronSuccess / Math.max(kpi.cronSuccess + kpi.cronFail, 1)) * 100}%`, background: '#10B981' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          DB {Math.round(kpi.dbMb / 81.92) / 10}% ({fmt(kpi.dbMb)} MB / 8,192 MB) · 관심등록 {kpi.interests} · 이메일 {kpi.emailSubs} · 푸시 {kpi.pushSubs}
        </div>
      </div>

      {/* 일일 추이 미니차트 */}
      {(dailyTrend || []).length > 3 && (() => {
        const d = (dailyTrend || []).slice(0, 7).reverse();
        const maxPv = Math.max(...d.map((s: any) => s.total_page_views || s.dau || 1), 1);
        return (
          <>
            <div className="adm-sec">📊 7일 추이</div>
            <div className="adm-card" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 50, marginBottom: 4 }}>
                {d.map((s: any, i: number) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', height: Math.max(((s.dau || 0) / maxPv) * 40, 3), background: 'var(--brand)', borderRadius: 2, opacity: i === d.length - 1 ? 1 : 0.5 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-tertiary)' }}>
                <span>{d[0]?.stat_date?.slice(5)}</span>
                <span>DAU</span>
                <span>{d[d.length - 1]?.stat_date?.slice(5)}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>유저 {d[d.length - 1]?.total_users || '?'}</span>
                <span>블로그 {((d[d.length - 1]?.total_blogs || 0) / 1000).toFixed(1)}K</span>
                <span>PV {d[d.length - 1]?.total_page_views || 0}</span>
              </div>
            </div>
          </>
        );
      })()}

      {/* 💡 자동 인사이트 */}
      <div className="adm-sec">💡 인사이트</div>
      <div className="adm-card" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {kpi.users > 0 && kpi.returnRate === 0 && (
          <div style={{ marginBottom: 8 }}>📌 실유저 {kpi.users}명 중 재방문자 0명. 가입 직후 이탈률 100%. 가장 시급한 해결 과제는 D+1 웰컴 알림 + 관심 지역 콘텐츠 매칭.</div>
        )}
        {kpi.interests <= 1 && (
          <div style={{ marginBottom: 8 }}>🏢 관심단지 등록 {kpi.interests}건. 청약 {fmt(kpi.apts)}건 현장 중 등록률 {(kpi.interests / Math.max(kpi.apts, 1) * 100).toFixed(3)}%. 상세페이지 CTA 위치/메시지 재점검 필요.</div>
        )}
        <div>📈 블로그 14일간 {fmt(kpi.blogs)}편 도달. 리라이팅 {kpi.rewriteRate}% ({fmt(kpi.rewritten)}편). 하루 36건 속도로 {Math.round((kpi.blogs - kpi.rewritten) / 36)}일 후 완료.</div>
      </div>

      {/* 최근 활동 */}
      <div className="adm-sec">🕐 최근 활동</div>
      <div className="adm-card" style={{ padding: '8px 14px' }}>
        {(recentActivity || []).map((a: any, i: number) => (
          <div key={i} className="adm-feed-i">
            <span style={{ minWidth: 52, fontSize: 10, color: 'var(--text-tertiary)' }}>{ago(a.at)}</span>
            {a.type === 'cron' ? (
              <>
                <span style={{ color: a.status === 'success' ? '#10B981' : '#EF4444' }}>{a.status === 'success' ? '✓' : '✗'}</span>
                <span>{a.name}</span>
                {a.count > 0 && <span style={{ color: 'var(--text-tertiary)' }}>· {a.count}건</span>}
              </>
            ) : (
              <>
                <span style={{ color: 'var(--brand)' }}>●</span>
                <span>신규 가입: {a.name}</span>
                {a.city && <span style={{ color: 'var(--text-tertiary)' }}>· {a.city}</span>}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
