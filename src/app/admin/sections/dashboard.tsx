'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, C, DailyStat, GRADE_EMOJI, KPI, PROVIDER_LABEL, Spinner, ago, fmt } from '../admin-shared';

export default function DashboardSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showCronDetail, setShowCronDetail] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // GOD MODE 전체실행 상태
  const [godRunning, setGodRunning] = useState(false);
  const [godResults, setGodResults] = useState<any[] | null>(null);
  const [godElapsed, setGodElapsed] = useState(0);
  const godTimerRef = useRef<NodeJS.Timeout | null>(null);

  const runGodMode = async (mode = 'full') => {
    if (godRunning) return;
    setGodRunning(true);
    setGodResults(null);
    setGodElapsed(0);
    const start = Date.now();
    godTimerRef.current = setInterval(() => setGodElapsed(Date.now() - start), 200);
    try {
      const res = await fetch('/api/admin/god-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const d = await res.json();
      setGodResults(d.results || []);
    } catch {
      setGodResults([{ name: 'ERROR', ok: false }]);
    } finally {
      if (godTimerRef.current) clearInterval(godTimerRef.current);
      setGodElapsed(Date.now() - start);
      setGodRunning(false);
      setTimeout(loadData, 2000); // 2초 후 대시보드 새로고침
    }
  };

  const loadData = useCallback(() => {
    fetch('/api/admin/dashboard?section=overview').then(r => r.json()).then(d => {
      setData(d);
      setLastUpdate(new Date());
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 30초 자동 새로고침
  useEffect(() => {
    if (!autoRefresh) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(loadData, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, loadData]);

  if (loading) return <Spinner />;
  if (!data) return <div style={{ color: C.red }}>로드 실패</div>;

  const { kpi, visitors, yesterday, topPages, categoryDistribution, cronDetail, totalRecordsCreated, recentUsers, recentPosts, recentComments, recentReports, dailyStats, cron, seo, stockKpi, premiumKpi, blogProduction, commentStats, cronByCategory } = data as any;
  const typeColors: Record<string, string> = { subscription: C.green, trade: C.yellow, redevelopment: C.purple, unsold: C.red, landmark: C.cyan };
  const typeLabels: Record<string, string> = { subscription: '청약', trade: '실거래', redevelopment: '재개발', unsold: '미분양', landmark: '대장' };
  const totalSites = seo?.totalSites || 0;
  const catIcons: Record<string, string> = { stock: '📈', apt: '🏢', local: '📍', free: '💬', finance: '💰' };

  // 어제 대비 증감 계산 함수
  const delta = (today: number, yest: number) => {
    if (!yest) return null;
    const d = today - yest;
    const pct = Math.round((d / yest) * 100);
    return { d, pct, color: d > 0 ? C.green : d < 0 ? C.red : C.textDim, arrow: d > 0 ? '▲' : d < 0 ? '▼' : '—' };
  };

  const pvDelta = delta(visitors?.todayPV ?? 0, yesterday?.pv ?? 0);
  const postsDelta = delta(data?.recentPosts?.length ?? 0, yesterday?.posts ?? 0);

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      {/* ── Header + Auto-refresh ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>Mission Control</h1>
          <p style={{ fontSize: 11, color: C.textDim, margin: '2px 0 0' }}>
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            {lastUpdate && <span> · {lastUpdate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 업데이트</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => runGodMode('full')} disabled={godRunning} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none',
            background: godRunning ? C.yellow : 'linear-gradient(135deg, #2563EB, #7C3AED)',
            color: '#fff', cursor: godRunning ? 'wait' : 'pointer', fontSize: 11, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
            animation: godRunning ? 'pulse 1s infinite' : 'none',
          }}>
            {godRunning ? `⏳ ${(godElapsed / 1000).toFixed(1)}s` : '⚡ 전체실행'}
          </button>
          <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${autoRefresh ? C.green + '40' : C.border}`, background: autoRefresh ? C.green + '15' : C.card, color: autoRefresh ? C.green : C.textDim, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
            {autoRefresh ? '🟢 LIVE' : '⏸ 정지'}
          </button>
          <button onClick={loadData} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.textSec, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>🔄</button>
        </div>
      </div>

      {/* ── GOD MODE 실행 결과 (인라인) ── */}
      {godResults && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>⚡ 실행 결과</span>
              <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>✅ {godResults.filter((r: any) => r.ok).length}</span>
              {godResults.filter((r: any) => !r.ok).length > 0 && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>❌ {godResults.filter((r: any) => !r.ok).length}</span>}
              <span style={{ fontSize: 9, color: C.textDim }}>{(godElapsed / 1000).toFixed(1)}초</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {godResults.filter((r: any) => !r.ok).length > 0 && (
                <button onClick={() => runGodMode('failed')} style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${C.red}40`, background: C.red + '10', color: C.red, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>🔴 실패 재시도</button>
              )}
              <button onClick={() => setGodResults(null)} style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${C.border}`, background: C.card, color: C.textDim, fontSize: 9, cursor: 'pointer' }}>✕ 닫기</button>
            </div>
          </div>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
            {godResults.map((r: any, i: number) => (
              <div key={i} style={{ flex: 1, background: r.ok ? C.green : C.red, borderRight: i < godResults.length - 1 ? '1px solid var(--bg-base)' : 'none' }} title={r.name || r.endpoint} />
            ))}
          </div>
          {godResults.filter((r: any) => !r.ok).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {godResults.filter((r: any) => !r.ok).map((r: any, i: number) => (
                <Badge key={i} color={C.red}>{(r.name || r.endpoint || '').replace('/api/cron/', '')}</Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 카테고리별 빠른실행 버튼 ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { mode: 'data', label: '📊 데이터', color: C.green },
          { mode: 'process', label: '⚙️ 가공', color: C.cyan },
          { mode: 'ai', label: '🤖 AI', color: C.purple },
          { mode: 'content', label: '📝 콘텐츠', color: C.yellow },
          { mode: 'system', label: '🔧 시스템', color: C.textSec },
        ].map(g => (
          <button key={g.mode} onClick={() => runGodMode(g.mode)} disabled={godRunning}
            style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${g.color}30`, background: `${g.color}10`, color: g.color, fontSize: 10, fontWeight: 700, cursor: godRunning ? 'wait' : 'pointer' }}>
            {g.label}
          </button>
        ))}
      </div>

      {/* ── Row 1: 시스템 헬스 바 ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <HealthBadge label="크론" value={`${cron.success}/${cron.total}`} ok={cron.fail === 0} />
        <HealthBadge label="신고" value={kpi.pendingReports > 0 ? `${kpi.pendingReports}건` : '없음'} ok={kpi.pendingReports === 0} />
        <HealthBadge label="블로그" value={`오늘 ${blogProduction?.today ?? 0}편`} ok={(blogProduction?.today ?? 0) > 0} />
        <HealthBadge label="댓글" value={`오늘 ${commentStats?.today ?? 0}개`} ok={(commentStats?.today ?? 0) > 0} />
        <HealthBadge label="24h 생산" value={fmt(totalRecordsCreated || 0) + '건'} ok={(totalRecordsCreated || 0) > 0} />
        <HealthBadge label="사이트맵" value={`${seo?.sitemapPct || 0}%`} ok={(seo?.sitemapPct || 0) > 80} />
        <HealthBadge label="프리미엄" value={`${premiumKpi?.subscribers ?? 0}명`} ok={(premiumKpi?.subscribers ?? 0) > 0} />
        <HealthBadge label="IndexNow" value={`${premiumKpi?.indexNow?.pct ?? 0}%`} ok={(premiumKpi?.indexNow?.pct ?? 0) > 50} />
        {cron.anthropicCreditWarning && <HealthBadge label="AI" value="크레딧 부족" ok={false} />}
      </div>

      {/* ── Row 2: 핵심 KPI 8카드 + 어제 대비 ── */}
      <div className="mc-g6" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { icon: '👁️', label: '오늘 PV', value: visitors?.todayPV ?? 0, color: C.brand, yest: yesterday?.pv },
          { icon: '👤', label: '오늘 UV', value: visitors?.todayUV ?? 0, color: C.cyan, yest: null },
          { icon: '🧑‍🤝‍🧑', label: '전체 유저', value: kpi.users, color: C.green, yest: null },
          { icon: '📝', label: '게시글', value: kpi.posts, color: C.purple, yest: null },
          { icon: '📰', label: '블로그', value: kpi.blogs, color: C.yellow, yest: null },
          { icon: '📈', label: '주식종목', value: kpi.stocks, color: C.cyan, yest: null },
          { icon: '🏢', label: '부동산', value: (kpi.subscriptions ?? 0) + (kpi.unsold ?? 0) + (kpi.redev ?? 0), color: C.green, yest: null },
          { icon: '🚨', label: '미처리 신고', value: kpi.pendingReports, color: kpi.pendingReports > 0 ? C.red : C.green, yest: null },
        ].map(item => {
          const d = item.yest != null ? delta(item.value, item.yest) : null;
          return (
            <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>{item.icon} {item.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{fmt(item.value)}</span>
                {d && <span style={{ fontSize: 10, fontWeight: 700, color: d.color }}>{d.arrow}{Math.abs(d.pct)}%</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Row 3: 서비스 상태 카드 (4열) ── */}
      <div className="mc-g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        {/* 크론 헬스 */}
        <div style={{ background: C.card, border: `1px solid ${cron.fail > 0 ? C.red + '40' : C.border}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }} onClick={() => setShowCronDetail(!showCronDetail)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: C.textDim }}>⚡ 크론 24h {showCronDetail ? '▲' : '▼'}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: cron.fail > 0 ? C.red : C.green }}>{cron.success}/{cron.total}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: cron.fail > 0 ? C.red : C.green, width: `${cron.total > 0 ? (cron.success / cron.total) * 100 : 100}%` }} />
          </div>
          {cron.failNames?.length > 0 && <div style={{ marginTop: 4, display: 'flex', gap: 3, flexWrap: 'wrap' }}>{cron.failNames.slice(0, 2).map((n: string) => <Badge key={n} color={C.red}>{n}</Badge>)}</div>}
          {cron.anthropicCreditWarning && (
            <div style={{ marginTop: 6, padding: '4px 8px', background: '#FF6B1A22', border: '1px solid #FF6B1A66', borderRadius: 6, fontSize: 10, color: '#FF6B1A', fontWeight: 700 }}>
              ⚠️ Anthropic 크레딧 부족 의심 — blog 크론 50%+ 실패 · console.anthropic.com 확인
            </div>
          )}
        </div>
        {/* 유저 활동 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>👤 유저 활동</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div><div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{kpi.newUsersWeek}</div><div style={{ fontSize: 9, color: C.textDim }}>신규(주)</div></div>
            <div><div style={{ fontSize: 16, fontWeight: 800, color: C.cyan }}>{kpi.activeUsersWeek}</div><div style={{ fontSize: 9, color: C.textDim }}>활성(주)</div></div>
          </div>
        </div>
        {/* 콘텐츠 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>📝 콘텐츠</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.posts)}</span><span style={{ fontSize: 9, color: C.textDim }}> 글</span></div>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.discussions)}</span><span style={{ fontSize: 9, color: C.textDim }}> 토론</span></div>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.blogs)}</span><span style={{ fontSize: 9, color: C.textDim }}> 블로그</span></div>
          </div>
        </div>
        {/* 부동산 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>🏢 부동산</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.subscriptions)}</span><span style={{ fontSize: 9, color: C.textDim }}> 청약</span></div>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.unsold)}</span><span style={{ fontSize: 9, color: C.textDim }}> 미분양</span></div>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.redev)}</span><span style={{ fontSize: 9, color: C.textDim }}> 재개발</span></div>
          </div>
        </div>
      </div>

      {/* ── 크론 상세 (토글) ── */}
      {showCronDetail && cronDetail && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>⚡ 크론 상세 (24h)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {Object.entries(cronDetail).sort((a: any, b: any) => b[1].created - a[1].created).map(([name, info]: [string, any]) => (
              <div key={name} style={{ padding: '8px 10px', borderRadius: 8, background: info.success === info.total ? C.green + '08' : C.red + '08', border: `1px solid ${info.success === info.total ? C.green + '20' : C.red + '20'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{name}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: info.success === info.total ? C.green : C.red }}>{info.success}/{info.total}</span>
                </div>
                {info.created > 0 && <div style={{ fontSize: 9, color: C.cyan }}>+{fmt(info.created)}건 생산</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 4: 트래픽 차트 + 사이트/인기페이지 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 12 }} className="mc-g2">
        {/* 일일 차트 (14일) */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>일일 트래픽 (14일)</span>
            <div style={{ display: 'flex', gap: 8, fontSize: 9 }}>
              <span style={{ color: C.brand }}>■ PV</span><span style={{ color: C.green }}>■ 신규</span>
            </div>
          </div>
          <MiniChart data={(dailyStats || []).reverse()} />
        </div>
        {/* 인기 페이지 + 사이트 현황 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>🔥 인기 페이지 (오늘)</div>
          {(topPages || []).length === 0 && <div style={{ fontSize: 11, color: C.textDim }}>데이터 없음</div>}
          {(topPages || []).map((p: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: `1px solid ${C.border}08` }}>
              <span style={{ fontSize: 10, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{p.path}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.brand }}>{p.count}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: C.textSec }}>전체 페이지</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.brand }}>{fmt(totalSites)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: C.textSec }}>주요 유입</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.cyan }}>{visitors?.topReferrer?.source || '—'} ({visitors?.topReferrer?.count || 0})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: C.textSec }}>주식 종목</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.yellow }}>{fmt(kpi.stocks)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 주식 상세 KPI 패널 ── */}
      {stockKpi && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>📈 주식 데이터 현황</span>
            <span style={{ fontSize: 10, color: C.textDim }}>stock_quotes · price_history</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            {[
              { label: '전체 종목', val: fmt(stockKpi.total), color: C.yellow },
              { label: '가격 있음', val: fmt(stockKpi.active), color: C.green },
              { label: '시총 입력', val: fmt(stockKpi.withMarketCap), color: C.cyan },
              { label: 'price_history', val: fmt(stockKpi.priceHistory), color: C.purple },
              { label: '뉴스 수', val: fmt(stockKpi.newsCount), color: C.yellow },
              { label: '활성률', val: `${Math.round((stockKpi.active / (stockKpi.total || 1)) * 100)}%`, color: stockKpi.active / (stockKpi.total || 1) > 0.95 ? C.green : C.red },
            ].map(item => (
              <div key={item.label} style={{ background: C.bg, borderRadius: 6, padding: '7px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: item.color }}>{item.val}</div>
                <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textSec }}>🇰🇷 KR 브리핑 최신</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: stockKpi.lastKRBriefing === new Date().toISOString().slice(0,10) ? C.green : C.red }}>
                {stockKpi.lastKRBriefing || '없음'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textSec }}>🇺🇸 US 브리핑 최신</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: stockKpi.lastUSBriefing ? C.cyan : C.red }}>
                {stockKpi.lastUSBriefing || '없음'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textSec }}>시세 크롤 상태</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.red }}>API키 미등록 (수집 0건)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Row 4.3: 프리미엄 매출 + IndexNow 진행률 ── */}
      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {/* 프리미엄 & 매출 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>👑 프리미엄 & 매출</span>
            <a href="/premium" target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: C.brand, textDecoration: 'none', fontWeight: 600 }}>페이지 →</a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 10 }}>
            <div style={{ background: C.bg, borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: (premiumKpi?.subscribers ?? 0) > 0 ? C.yellow : C.textDim }}>{premiumKpi?.subscribers ?? 0}</div>
              <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>구독자</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: (premiumKpi?.totalRevenue ?? 0) > 0 ? C.green : C.textDim }}>₩{((premiumKpi?.totalRevenue ?? 0) / 1000).toFixed(0)}K</div>
              <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>총 매출</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textSec }}>
            <span>결제 건수: <strong style={{ color: C.text }}>{premiumKpi?.totalOrders ?? 0}</strong>건</span>
            <span>만료 예정: <strong style={{ color: (premiumKpi?.expiringSoon ?? 0) > 0 ? C.yellow : C.textDim }}>{premiumKpi?.expiringSoon ?? 0}</strong>명 (7일 내)</span>
          </div>
          {(premiumKpi?.totalOrders ?? 0) === 0 && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: C.yellow + '12', border: `1px solid ${C.yellow}30`, borderRadius: 6, fontSize: 10, color: C.yellow, fontWeight: 600 }}>
              ⚠️ Toss 결제 키 미설정 — 결제 불가 상태
            </div>
          )}
        </div>

        {/* IndexNow 진행률 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>🔍 IndexNow 전송 현황</span>
            <span style={{ fontSize: 10, color: C.textDim }}>블로그 {fmt(premiumKpi?.indexNow?.total ?? 0)}편</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            <div style={{ background: C.bg, borderRadius: 6, padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{fmt(premiumKpi?.indexNow?.done ?? 0)}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>전송완료</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 6, padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.yellow }}>{fmt(premiumKpi?.indexNow?.pending ?? 0)}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>대기</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 6, padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: (premiumKpi?.indexNow?.pct ?? 0) > 80 ? C.green : (premiumKpi?.indexNow?.pct ?? 0) > 30 ? C.yellow : C.red }}>{premiumKpi?.indexNow?.pct ?? 0}%</div>
              <div style={{ fontSize: 9, color: C.textDim }}>진행률</div>
            </div>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: C.border, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${C.green}, ${C.cyan})`, width: `${premiumKpi?.indexNow?.pct ?? 0}%`, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ fontSize: 10, color: C.textDim }}>
            매 6시간 500편 전송 · 예상 완료: ~{Math.ceil((premiumKpi?.indexNow?.pending ?? 0) / 2000)}일
          </div>
        </div>
      </div>

      {/* ── Row 4.5: 블로그 생산 현황 + 댓글/크론 카테고리 ── */}
      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {/* 블로그 생산 현황 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>📰 블로그 생산 현황</span>
            <span style={{ fontSize: 10, color: C.textDim }}>총 {fmt(kpi.blogs)}편</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            <div style={{ background: C.bg, borderRadius: 6, padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: (blogProduction?.today ?? 0) > 0 ? C.green : C.red }}>{blogProduction?.today ?? 0}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>오늘 발행</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 6, padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.yellow }}>{fmt(blogProduction?.queue ?? 0)}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>미발행 큐</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 6, padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.cyan }}>{fmt(blogProduction?.readyToPublish ?? 0)}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>발행 가능</div>
            </div>
          </div>
          {/* 블로그 카테고리 분포 바 */}
          {blogProduction?.categoryBreakdown && (() => {
            const cats = Object.entries(blogProduction.categoryBreakdown as Record<string, number>).sort((a, b) => b[1] - a[1]);
            const total = cats.reduce((s, [, c]) => s + c, 0) || 1;
            const catColors: Record<string, string> = { stock: '#00E5FF', apt: '#00FF87', unsold: '#FF6B1A', finance: '#FFE000', general: '#C084FC' };
            const catLabels: Record<string, string> = { stock: '주식', apt: '청약', unsold: '미분양', finance: '재테크', general: '생활' };
            return (
              <>
                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                  {cats.map(([cat, cnt]) => (
                    <div key={cat} style={{ width: `${(cnt / total) * 100}%`, background: catColors[cat] || C.textDim }} title={`${catLabels[cat] || cat}: ${fmt(cnt)}편`} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cats.slice(0, 5).map(([cat, cnt]) => (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
                      <div style={{ width: 5, height: 5, borderRadius: 2, background: catColors[cat] || C.textDim }} />
                      <span style={{ color: C.textSec }}>{catLabels[cat] || cat}</span>
                      <span style={{ color: C.text, fontWeight: 700 }}>{fmt(cnt)}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
          {/* 리라이팅 현황 */}
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: C.textDim }}>AI 리라이팅</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: (seo?.blogRewrittenPct ?? 0) > 50 ? C.green : C.yellow }}>{seo?.blogRewrittenPct ?? 0}% 완료</span>
          </div>
        </div>

        {/* 댓글 + 크론 카테고리 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          {/* 댓글 통계 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>💬 댓글 & 크론 현황</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 10 }}>
            <div style={{ background: C.bg, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>{commentStats?.today ?? 0}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>오늘 댓글</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.purple }}>{fmt(commentStats?.totalReplies ?? 0)}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>대댓글</div>
            </div>
          </div>
          {/* 크론 카테고리별 */}
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec, marginBottom: 6 }}>크론 카테고리 (24h)</div>
          {cronByCategory && Object.entries(cronByCategory as Record<string, any>).map(([cat, info]: [string, any]) => {
            const icons: Record<string, string> = { blog: '📝', stock: '📈', apt: '🏢', system: '⚙️' };
            const labels: Record<string, string> = { blog: '블로그', stock: '주식', apt: '부동산', system: '시스템' };
            const pct = info.total > 0 ? Math.round((info.success / info.total) * 100) : 100;
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 12, width: 16, textAlign: 'center' }}>{icons[cat]}</span>
                <span style={{ fontSize: 10, color: C.textSec, width: 40 }}>{labels[cat]}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: pct === 100 ? C.green : pct > 70 ? C.yellow : C.red, width: `${pct}%` }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: pct === 100 ? C.green : C.red, minWidth: 32, textAlign: 'right' }}>{info.success}/{info.total}</span>
                {info.created > 0 && <span style={{ fontSize: 9, color: C.cyan }}>+{fmt(info.created)}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Row 5: 페이지 타입 분포 + 카테고리 분포 ── */}
      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {/* 페이지 타입 분포 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>페이지 타입 분포</span>
            <span style={{ fontSize: 10, color: C.textDim }}>{fmt(totalSites)}건</span>
          </div>
          <div style={{ display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            {Object.entries(seo?.siteTypeBreakdown || {}).sort((a: any, b: any) => b[1].count - a[1].count).map(([type, info]: [string, any]) => (
              <div key={type} style={{ width: `${(info.count / totalSites) * 100}%`, background: typeColors[type] || C.textDim }} title={`${typeLabels[type] || type}: ${info.count}건`} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(seo?.siteTypeBreakdown || {}).sort((a: any, b: any) => b[1].count - a[1].count).map(([type, info]: [string, any]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: typeColors[type] || C.textDim }} />
                <span style={{ color: C.textSec }}>{typeLabels[type] || type}</span>
                <span style={{ color: C.text, fontWeight: 700 }}>{fmt(info.count)}</span>
              </div>
            ))}
          </div>
        </div>
        {/* 카테고리별 게시글 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>카테고리별 게시글</div>
          {(categoryDistribution || []).map((c: any) => {
            const total = (categoryDistribution || []).reduce((s: number, x: any) => s + x.count, 0) || 1;
            return (
              <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, width: 16, textAlign: 'center' }}>{catIcons[c.category] || '📄'}</span>
                <span style={{ fontSize: 11, color: C.textSec, width: 40 }}>{c.category}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: C.border, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: C.brand, width: `${(c.count / total) * 100}%`, opacity: 0.7 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.text, minWidth: 35, textAlign: 'right' }}>{fmt(c.count)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Row 5.5: 어제 대비 증감 요약 ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textSec }}>📊 어제 대비</span>
        {[
          { label: 'PV', today: visitors?.todayPV ?? 0, yest: yesterday?.pv ?? 0 },
          { label: '글', today: recentPosts?.length ?? 0, yest: yesterday?.posts ?? 0 },
          { label: '댓글', today: commentStats?.today ?? 0, yest: yesterday?.comments ?? 0 },
          { label: '신규유저', today: kpi.newUsersWeek ?? 0, yest: yesterday?.newUsers ?? 0 },
        ].map(item => {
          const d = delta(item.today, item.yest);
          return (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: C.textDim }}>{item.label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{fmt(item.today)}</span>
              {d && <span style={{ fontSize: 9, fontWeight: 700, color: d.color }}>{d.arrow}{Math.abs(d.d)}</span>}
            </div>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: C.textDim }}>주간PV</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.brand }}>{fmt(visitors?.weekPV ?? 0)}</span>
          <span style={{ fontSize: 10, color: C.textDim }}>UV</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.cyan }}>{fmt(visitors?.weekUV ?? 0)}</span>
        </div>
      </div>

      {/* ── Row 5.6: 자동발행 파이프라인 ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>🔄 자동발행 파이프라인</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[
            { label: '크론 수집', value: cronByCategory?.blog?.total ?? 0, sub: `${cronByCategory?.blog?.success ?? 0}성공`, color: C.brand, icon: '⚡' },
            { label: '', value: 0, sub: '', color: '', icon: '→' },
            { label: 'AI 생성', value: cronByCategory?.blog?.created ?? 0, sub: '편 생산', color: C.purple, icon: '🤖' },
            { label: '', value: 0, sub: '', color: '', icon: '→' },
            { label: '발행 큐', value: blogProduction?.queue ?? 0, sub: '대기', color: C.yellow, icon: '📋' },
            { label: '', value: 0, sub: '', color: '', icon: '→' },
            { label: '발행 완료', value: blogProduction?.today ?? 0, sub: '오늘', color: C.green, icon: '✅' },
          ].map((step, i) => step.icon === '→' ? (
            <div key={i} style={{ fontSize: 14, color: C.textDim, padding: '0 2px' }}>→</div>
          ) : (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: `${step.color}08`, borderRadius: 8, border: `1px solid ${step.color}20` }}>
              <div style={{ fontSize: 12, marginBottom: 2 }}>{step.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: step.color }}>{fmt(step.value)}</div>
              <div style={{ fontSize: 8, color: C.textDim, marginTop: 1 }}>{step.label}</div>
              <div style={{ fontSize: 8, color: step.color, fontWeight: 600 }}>{step.sub}</div>
            </div>
          ))}
        </div>
        {/* 발행 가능 글 + 리라이팅 진행률 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
            <span style={{ color: C.textDim }}>발행가능 <strong style={{ color: C.cyan }}>{fmt(blogProduction?.readyToPublish ?? 0)}</strong>편</span>
            <span style={{ color: C.textDim }}>리라이팅 <strong style={{ color: (seo?.blogRewrittenPct ?? 0) > 50 ? C.green : C.yellow }}>{seo?.blogRewrittenPct ?? 0}%</strong></span>
            <span style={{ color: C.textDim }}>총 <strong style={{ color: C.text }}>{fmt(kpi.blogs)}</strong>편</span>
          </div>
          {cron.anthropicCreditWarning && (
            <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: '#FF6B1A', fontWeight: 700, textDecoration: 'none', padding: '2px 6px', background: '#FF6B1A15', borderRadius: 4, border: '1px solid #FF6B1A30' }}>
              ⚠️ AI 크레딧 충전 필요
            </a>
          )}
        </div>
      </div>

      {/* ── Row 6: Quick Actions ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <QuickAction label="⚡ GOD MODE" href="#" onClick={() => { const el = document.querySelector('[data-section="godmode"]') as HTMLElement; el?.click(); }} />
        <QuickAction label="📊 SEO" href="#" onClick={() => { const el = document.querySelector('[data-section="seo"]') as HTMLElement; el?.click(); }} />
        <QuickAction label="🛰️ 위성" href="#" onClick={() => { const el = document.querySelector('[data-section="satellite"]') as HTMLElement; el?.click(); }} />
        <QuickAction label="🏢 부동산" href="#" onClick={() => { const el = document.querySelector('[data-section="realestate"]') as HTMLElement; el?.click(); }} />
        <QuickAction label="📈 주식" href="/stock" external />
        <QuickAction label="🔍 사이트" href="https://kadeora.app" external />
        <QuickAction label="📝 블로그" href="/blog" external />
        <QuickAction label="💬 토론" href="/discuss" external />
        <QuickAction label="🔥 HOT" href="/hot" external />
        <QuickAction label="🛒 상점" href="/shop" external />
        <QuickAction label="👑 프리미엄" href="/premium" external />
        <QuickAction label="🔑 Anthropic" href="https://console.anthropic.com" external />
        <QuickAction label="📊 Vercel" href="https://vercel.com/wls9205-5665s-projects/kadeora" external />
        <QuickAction label="🔍 SearchConsole" href="https://search.google.com/search-console" external />
        <QuickAction label="🇰🇷 서치어드바이저" href="https://searchadvisor.naver.com" external />
      </div>

      {/* ── Row 7: 실시간 활동 피드 ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>실시간 활동</div>
        <ActivityFeed users={recentUsers || []} posts={recentPosts || []} comments={recentComments || []} reports={recentReports || []} />
      </div>

      {/* ── Row 8: 최근 가입 + 최근 게시글 ── */}
      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>최근 가입</div>
          {(recentUsers || []).map((u: Record<string, any>) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${C.border}08` }}>
              <span style={{ fontSize: 13 }}>{GRADE_EMOJI[u.grade] || '🌱'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.nickname} {u.is_seed && <span style={{ fontSize: 9, color: C.textDim }}>(시드)</span>}
                </div>
                <div style={{ fontSize: 9, color: C.textDim }}>{PROVIDER_LABEL[u.provider] || '—'} · {u.region_text || '미설정'}</div>
              </div>
              <div style={{ fontSize: 9, color: C.textDim, flexShrink: 0 }}>{ago(u.created_at)}</div>
            </div>
          ))}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>최근 게시글</div>
          {(recentPosts || []).map((p: Record<string, any>) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: `1px solid ${C.border}08` }}>
              <span style={{ fontSize: 12 }}>{catIcons[p.category] || '📄'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                <div style={{ fontSize: 9, color: C.textDim }}>{(p.profiles as Record<string, unknown>)?.nickname as string || '—'} · ♥{p.likes_count || 0} · 💬{p.comments_count || 0}</div>
              </div>
              <div style={{ fontSize: 9, color: C.textDim, flexShrink: 0 }}>{ago(p.created_at)}</div>
            </div>
          ))}
          {(!recentPosts || recentPosts.length === 0) && <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center', padding: 16 }}>게시글 없음</div>}
        </div>
      </div>
    </div>
  );
}

function HealthBadge({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: ok ? C.green + '10' : C.red + '10', border: `1px solid ${ok ? C.green + '30' : C.red + '30'}` }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? C.green : C.red }} />
      <span style={{ fontSize: 10, fontWeight: 600, color: C.textSec }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 800, color: ok ? C.green : C.red }}>{value}</span>
    </div>
  );
}

function QuickAction({ label, href, onClick, external }: { label: string; href: string; onClick?: () => void; external?: boolean }) {
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', borderRadius: 8, background: C.card, border: `1px solid ${C.border}`, color: C.textSec, fontSize: 11, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}>{label}</a>
  ) : (
    <button onClick={onClick} style={{ padding: '6px 12px', borderRadius: 8, background: C.card, border: `1px solid ${C.border}`, color: C.textSec, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  );
}

function MiniChart({ data }: { data: DailyStat[] }) {
  if (!data.length) return <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', padding: 20 }}>데이터 없음</div>;
  const maxPV = Math.max(...data.map(d => d.page_views || 0), 1);
  const maxUsers = Math.max(...data.map(d => d.new_users || 0), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
        {data.map((d, i) => {
          const h = Math.max(((d.page_views || 0) / maxPV) * 70, 4);
          const uh = Math.max(((d.new_users || 0) / maxUsers) * 70, 2);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative' }}>
              <div style={{ width: '100%', height: h, borderRadius: 2, background: C.brand, opacity: .7, transition: 'height .3s' }}
                title={`${d.date}: PV ${d.page_views || 0} · 신규 ${d.new_users || 0}`} />
              <div style={{ width: '60%', height: uh, borderRadius: 2, background: C.green, opacity: .8, position: 'absolute', bottom: 0 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 9, color: C.textDim }}>{data[0]?.date?.slice(5)}</span>
        <span style={{ fontSize: 9, color: C.textDim }}>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

function ActivityFeed({ users, posts, comments, reports }: { users: any[]; posts: any[]; comments: any[]; reports: any[] }) {
  const items: { type: string; icon: string; text: string; time: string }[] = [];
  for (const u of users) items.push({ type: 'user', icon: '👤', text: `${u.nickname || '익명'} 가입 (${PROVIDER_LABEL[u.provider] || '—'})`, time: u.created_at });
  for (const p of posts) items.push({ type: 'post', icon: '📝', text: `"${p.title?.slice(0, 30)}" — ${(p.profiles as Record<string, unknown>)?.nickname as string || '—'}`, time: p.created_at });
  for (const c of comments) items.push({ type: 'comment', icon: '💬', text: `${(c.profiles as Record<string, unknown>)?.nickname as string || '—'}: ${c.content?.slice(0, 30)}`, time: c.created_at });
  for (const r of reports) items.push({ type: 'report', icon: '🚨', text: `신고: ${r.reason} (${r.content_type})`, time: r.created_at });
  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  if (items.length === 0) return <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center', padding: 12 }}>활동 없음</div>;

  return (
    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
      {items.slice(0, 15).map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: `1px solid ${C.border}08` }}>
          <span style={{ fontSize: 12, flexShrink: 0 }}>{item.icon}</span>
          <span style={{ flex: 1, fontSize: 11, color: item.type === 'report' ? C.red : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</span>
          <span style={{ fontSize: 9, color: C.textDim, flexShrink: 0 }}>{ago(item.time)}</span>
        </div>
      ))}
    </div>
  );
}
