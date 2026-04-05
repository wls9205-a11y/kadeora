'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, C, DailyStat, GRADE_EMOJI, KPI, PROVIDER_LABEL, Spinner, ago, fmt } from '../admin-shared';
import { CALC_REGISTRY, CATEGORIES } from '@/lib/calc/registry';

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

  const { kpi, visitors, yesterday, topPages, categoryDistribution, cronDetail, totalRecordsCreated, recentUsers, recentPosts, recentComments, recentReports, dailyStats, cron, seo, stockKpi, complexKpi, premiumKpi, blogProduction, commentStats, cronByCategory, dataCoverage } = data as any;
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: C.text, margin: 0 }}>Mission Control</h1>
          <p style={{ fontSize: 11, color: C.textDim, margin: '2px 0 0' }}>
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            {lastUpdate && <span> · {lastUpdate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 업데이트</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button aria-label="닫기" onClick={() => runGodMode('full')} disabled={godRunning} style={{
            padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: godRunning ? C.yellow : 'linear-gradient(135deg, #2563EB, #7C3AED)',
            color: '#fff', cursor: godRunning ? 'wait' : 'pointer', fontSize: 11, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
            animation: godRunning ? 'pulse 1s infinite' : 'none',
          }}>
            {godRunning ? `⏳ ${(godElapsed / 1000).toFixed(1)}s` : '⚡ 전체실행'}
          </button>
          <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ padding: '4px 8px', borderRadius: 'var(--radius-xs)', border: `1px solid ${autoRefresh ? C.green + '40' : C.border}`, background: autoRefresh ? C.green + '15' : C.card, color: autoRefresh ? C.green : C.textDim, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
            {autoRefresh ? '🟢 LIVE' : '⏸ 정지'}
          </button>
          <button onClick={loadData} style={{ padding: '5px 12px', borderRadius: 'var(--radius-xs)', border: `1px solid ${C.border}`, background: C.card, color: C.textSec, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>🔄</button>
        </div>
      </div>

      {/* ── GOD MODE 실행 결과 (인라인) ── */}
      {godResults && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 'var(--sp-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>⚡ 실행 결과</span>
              <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>✅ {godResults.filter((r: any) => r.ok).length}</span>
              {godResults.filter((r: any) => !r.ok).length > 0 && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>❌ {godResults.filter((r: any) => !r.ok).length}</span>}
              <span style={{ fontSize: 9, color: C.textDim }}>{(godElapsed / 1000).toFixed(1)}초</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-xs)' }}>
              {godResults.filter((r: any) => !r.ok).length > 0 && (
                <button onClick={() => runGodMode('failed')} style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${C.red}40`, background: C.red + '10', color: C.red, fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>🔴 실패 재시도</button>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 'var(--sp-xs)' }}>
              {godResults.filter((r: any) => !r.ok).map((r: any, i: number) => (
                <Badge key={i} color={C.red}>{(r.name || r.endpoint || '').replace('/api/cron/', '')}</Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 카테고리별 빠른실행 버튼 ── */}
      <div style={{ display: 'flex', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-md)', flexWrap: 'wrap' }}>
        {[
          { mode: 'data', label: '📊 데이터', color: C.green },
          { mode: 'process', label: '⚙️ 가공', color: C.cyan },
          { mode: 'ai', label: '🤖 AI', color: C.purple },
          { mode: 'content', label: '📝 콘텐츠', color: C.yellow },
          { mode: 'system', label: '🔧 시스템', color: C.textSec },
        ].map(g => (
          <button aria-label="닫기" key={g.mode} onClick={() => runGodMode(g.mode)} disabled={godRunning}
            style={{ padding: '4px 10px', borderRadius: 'var(--radius-xs)', border: `1px solid ${g.color}30`, background: `${g.color}10`, color: g.color, fontSize: 10, fontWeight: 600, cursor: godRunning ? 'wait' : 'pointer' }}>
            {g.label}
          </button>
        ))}
      </div>

      {/* ── Row 1: 시스템 헬스 바 ── */}
      <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)', flexWrap: 'wrap' }}>
        <HealthBadge label="크론" value={`${cron.success}/${cron.total}`} ok={cron.fail === 0} />
        <HealthBadge label="신고" value={kpi.pendingReports > 0 ? `${kpi.pendingReports}건` : '없음'} ok={kpi.pendingReports === 0} />
        <HealthBadge label="블로그" value={`오늘 ${blogProduction?.today ?? 0}편`} ok={(blogProduction?.today ?? 0) > 0} />
        <HealthBadge label="댓글" value={`오늘 ${commentStats?.today ?? 0}개`} ok={(commentStats?.today ?? 0) > 0} />
        <HealthBadge label="24h 생산" value={fmt(totalRecordsCreated || 0) + '건'} ok={(totalRecordsCreated || 0) > 0} />
        <HealthBadge label="사이트맵" value={`${seo?.sitemapPct || 0}%`} ok={(seo?.sitemapPct || 0) > 80} />
        <HealthBadge label="프로" value={`${premiumKpi?.subscribers ?? 0}명`} ok={(premiumKpi?.subscribers ?? 0) > 0} />
        <HealthBadge label="공유7d" value={`${kpi.shares7d ?? 0}건`} ok={(kpi.shares7d ?? 0) > 0} />
        <HealthBadge label="IndexNow" value={`${premiumKpi?.indexNow?.pct ?? 0}%`} ok={(premiumKpi?.indexNow?.pct ?? 0) > 50} />
        {cron.anthropicCreditWarning && <HealthBadge label="AI" value="크레딧 부족" ok={false} />}
        {dataCoverage && <HealthBadge label="분양가" value={`${dataCoverage.aptPrice.pct}%`} ok={dataCoverage.aptPrice.pct > 90} />}
        {dataCoverage && <HealthBadge label="좌표" value={`${dataCoverage.aptCoords.pct}%`} ok={dataCoverage.aptCoords.pct > 95} />}
        {dataCoverage && <HealthBadge label="이미지" value={`${dataCoverage.aptImages?.pct ?? 0}%`} ok={(dataCoverage.aptImages?.pct ?? 0) > 50} />}
        {dataCoverage && <HealthBadge label="종목설명" value={`${dataCoverage.stockDesc.pct}%`} ok={dataCoverage.stockDesc.pct > 95} />}
        {dataCoverage?.aiSummary && <HealthBadge label="AI요약" value={`${dataCoverage.aiSummary.pct}%`} ok={dataCoverage.aiSummary.pct > 30} />}
        {dataCoverage?.pdfParsing && <HealthBadge label="PDF파싱" value={`${dataCoverage.pdfParsing.pct}%`} ok={dataCoverage.pdfParsing.pct > 90} />}
        {dataCoverage?.stockSector && <HealthBadge label="섹터" value={`${dataCoverage.stockSector.pct}%`} ok={dataCoverage.stockSector.pct > 80} />}
        {dataCoverage?.stockRefresh && <HealthBadge label="시세" value={dataCoverage.stockRefresh.ok ? '정상' : '오류'} ok={dataCoverage.stockRefresh.ok} />}
        {dataCoverage?.dbSize && <HealthBadge label="DB" value={dataCoverage.dbSize} ok={true} />}
      </div>

      {/* ── Row 2: 핵심 KPI 8카드 + 어제 대비 ── */}
      <div className="mc-g6" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
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
            <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>{item.icon} {item.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-xs)' }}>
                <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: item.color }}>{fmt(item.value)}</span>
                {d && <span style={{ fontSize: 10, fontWeight: 600, color: d.color }}>{d.arrow}{Math.abs(d.pct)}%</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Row 3: 서비스 상태 카드 (4열) ── */}
      <div className="mc-g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
        {/* 크론 헬스 */}
        <div style={{ background: C.card, border: `1px solid ${cron.fail > 0 ? C.red + '40' : C.border}`, borderRadius: 'var(--radius-md)', padding: '10px 12px', cursor: 'pointer' }} onClick={() => setShowCronDetail(!showCronDetail)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: C.textDim }}>⚡ 크론 24h {showCronDetail ? '▲' : '▼'}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: cron.fail > 0 ? C.red : C.green }}>{cron.success}/{cron.total}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: cron.fail > 0 ? C.red : C.green, width: `${cron.total > 0 ? (cron.success / cron.total) * 100 : 100}%` }} />
          </div>
          {cron.failNames?.length > 0 && <div style={{ marginTop: 'var(--sp-xs)', display: 'flex', gap: 3, flexWrap: 'wrap' }}>{cron.failNames.slice(0, 2).map((n: string) => <Badge key={n} color={C.red}>{n}</Badge>)}</div>}
          {cron.anthropicCreditWarning && (
            <div style={{ marginTop: 6, padding: '4px 8px', background: '#FF6B1A22', border: '1px solid #FF6B1A66', borderRadius: 'var(--radius-xs)', fontSize: 10, color: '#FF6B1A', fontWeight: 700 }}>
              ⚠️ Anthropic 크레딧 부족 의심 — blog 크론 50%+ 실패 · console.anthropic.com 확인
            </div>
          )}
        </div>
        {/* 유저 활동 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 'var(--sp-xs)' }}>👤 유저 활동</div>
          <div style={{ display: 'flex', gap: 'var(--sp-md)' }}>
            <div><div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{kpi.newUsersWeek}</div><div style={{ fontSize: 9, color: C.textDim }}>신규(주)</div></div>
            <div><div style={{ fontSize: 16, fontWeight: 800, color: C.cyan }}>{kpi.activeUsersWeek}</div><div style={{ fontSize: 9, color: C.textDim }}>활성(주)</div></div>
          </div>
        </div>
        {/* 콘텐츠 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 'var(--sp-xs)' }}>📝 콘텐츠</div>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.posts)}</span><span style={{ fontSize: 9, color: C.textDim }}> 글</span></div>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.discussions)}</span><span style={{ fontSize: 9, color: C.textDim }}> 토론</span></div>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.blogs)}</span><span style={{ fontSize: 9, color: C.textDim }}> 블로그</span></div>
          </div>
        </div>
        {/* 부동산 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 'var(--sp-xs)' }}>🏢 부동산</div>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.subscriptions)}</span><span style={{ fontSize: 9, color: C.textDim }}> 청약</span></div>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.unsold)}</span><span style={{ fontSize: 9, color: C.textDim }}> 미분양</span></div>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(kpi.redev)}</span><span style={{ fontSize: 9, color: C.textDim }}> 재개발</span></div>
          </div>
        </div>
      </div>

      {/* ── 크론 상세 (토글) ── */}
      {showCronDetail && cronDetail && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 'var(--sp-md)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 'var(--sp-sm)' }}>⚡ 크론 상세 (24h)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {Object.entries(cronDetail).sort((a: any, b: any) => b[1].created - a[1].created).map(([name, info]: [string, any]) => (
              <div key={name} style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: info.success === info.total ? C.green + '08' : C.red + '08', border: `1px solid ${info.success === info.total ? C.green + '20' : C.red + '20'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{name}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: info.success === info.total ? C.green : C.red }}>{info.success}/{info.total}</span>
                </div>
                {info.created > 0 && <div style={{ fontSize: 9, color: C.cyan }}>+{fmt(info.created)}건 생산</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 4: 트래픽 차트 + 사이트/인기페이지 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }} className="mc-g2">
        {/* 일일 차트 (14일) */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>일일 트래픽 (14일)</span>
            <div style={{ display: 'flex', gap: 'var(--sp-sm)', fontSize: 9 }}>
              <span style={{ color: C.brand }}>■ PV</span><span style={{ color: C.green }}>■ 신규</span>
            </div>
          </div>
          <MiniChart data={(dailyStats || []).reverse()} />
        </div>
        {/* 인기 페이지 + 사이트 현황 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 'var(--sp-sm)' }}>🔥 인기 페이지 (오늘)</div>
          {(topPages || []).length === 0 && <div style={{ fontSize: 11, color: C.textDim }}>데이터 없음</div>}
          {(topPages || []).map((p: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: `1px solid ${C.border}08` }}>
              <span style={{ fontSize: 10, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{p.path}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.brand }}>{p.count}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 'var(--sp-sm)', paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-xs)' }}>
              <span style={{ fontSize: 11, color: C.textSec }}>전체 페이지</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.brand }}>{fmt(totalSites)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-xs)' }}>
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

      {/* ── 섹션별 7일 펄스 ── */}
      {(data as any).sectionPulse && (() => {
        const p = (data as any).sectionPulse;
        const barW = (v: number, max: number) => max > 0 ? `${Math.max(4, (v / max) * 100)}%` : '4%';
        return (
          <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
            {/* 피드 펄스 */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>💬 피드 7일 추이</div>
              {(p.feed || []).map((d: any) => {
                const maxP = Math.max(...(p.feed || []).map((x: any) => x.posts || 0));
                return (
                  <div key={d.d} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: C.textDim, width: 36, flexShrink: 0 }}>{d.d?.slice(5)}</span>
                    <div style={{ flex: 1, background: C.bg, borderRadius: 2, height: 14, overflow: 'hidden' }}>
                      <div style={{ width: barW(d.posts, maxP), height: '100%', background: C.brand, borderRadius: 2, transition: 'width .3s' }} />
                    </div>
                    <span style={{ fontSize: 9, color: C.textSec, width: 28, textAlign: 'right', flexShrink: 0 }}>{d.posts}</span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 9, color: C.textDim }}>
                <span>총 {(p.feed || []).reduce((s: number, d: any) => s + (d.posts || 0), 0)}글</span>
                <span>♥ {(p.feed || []).reduce((s: number, d: any) => s + (d.likes || 0), 0)}</span>
                <span>💬 {(p.feed || []).reduce((s: number, d: any) => s + (d.comments || 0), 0)}</span>
              </div>
            </div>

            {/* 블로그 펄스 */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>📝 블로그 7일 생산</div>
              {(p.blog || []).map((d: any) => {
                const maxT = Math.max(...(p.blog || []).map((x: any) => x.total || 0));
                return (
                  <div key={d.d} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: C.textDim, width: 36, flexShrink: 0 }}>{d.d?.slice(5)}</span>
                    <div style={{ flex: 1, background: C.bg, borderRadius: 2, height: 14, overflow: 'hidden', display: 'flex' }}>
                      {d.stock > 0 && <div style={{ width: barW(d.stock, maxT), height: '100%', background: C.green }} />}
                      {d.apt > 0 && <div style={{ width: barW(d.apt, maxT), height: '100%', background: C.cyan }} />}
                      {(d.realestate || 0) > 0 && <div style={{ width: barW(d.realestate, maxT), height: '100%', background: C.purple }} />}
                      {(d.other || 0) > 0 && <div style={{ width: barW(d.other, maxT), height: '100%', background: C.yellow }} />}
                    </div>
                    <span style={{ fontSize: 9, color: C.textSec, width: 28, textAlign: 'right', flexShrink: 0 }}>{d.total}</span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 9 }}>
                <span style={{ color: C.green }}>■ 주식</span>
                <span style={{ color: C.cyan }}>■ 청약</span>
                <span style={{ color: C.purple }}>■ 부동산</span>
                <span style={{ color: C.yellow }}>■ 기타</span>
              </div>
            </div>

            {/* 주식 시장 펄스 */}
            {p.stock && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>📈 주식 시장 현황</div>
                {(p.stock.markets || []).map((m: any) => (
                  <div key={m.market} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{m.market}</span>
                    <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                      <span style={{ color: C.textSec }}>{m.total}종목</span>
                      <span style={{ color: m.zero_pct > m.total * 0.3 ? C.red : C.green }}>0%: {m.zero_pct}</span>
                      <span style={{ color: m.avg_change >= 0 ? C.red : C.cyan }}>{m.avg_change > 0 ? '+' : ''}{m.avg_change}%</span>
                    </div>
                  </div>
                ))}
                {(p.stock.topMovers || []).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 4 }}>등락률 TOP 5</div>
                    {(p.stock.topMovers || []).map((s: any) => (
                      <div key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0' }}>
                        <span style={{ color: C.textSec }}>{s.name}</span>
                        <span style={{ fontWeight: 700, color: s.change_pct >= 0 ? C.red : C.cyan }}>{s.change_pct > 0 ? '+' : ''}{s.change_pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 부동산 펄스 */}
            {p.apt && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>🏢 부동산 현황</div>
                {[
                  { label: '청약 총건', val: fmt(p.apt.subscriptions?.total), color: C.text },
                  { label: '접수중', val: fmt(p.apt.subscriptions?.active), color: C.green },
                  { label: '이번주 신규', val: fmt(p.apt.subscriptions?.thisWeek), color: C.cyan },
                  { label: '규제지역', val: fmt(p.apt.subscriptions?.regulated), color: C.red },
                  { label: '파싱 완료', val: fmt(p.apt.subscriptions?.parsed), color: C.purple },
                  { label: '단지 프로필', val: fmt(p.apt.complexProfiles), color: C.yellow },
                  { label: 'SEO 사이트', val: fmt(p.apt.sites?.total), color: C.text },
                  { label: '이미지 보유', val: fmt(p.apt.sites?.withImages), color: C.green },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 10, color: C.textSec }}>{r.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── 주식 상세 KPI 패널 ── */}
      {stockKpi && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 'var(--sp-md)' }}>
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
              { label: '섹터 없음', val: fmt(stockKpi.noSector ?? 0), color: (stockKpi.noSector ?? 0) > 100 ? C.red : C.yellow },
              { label: '설명 없음', val: fmt(stockKpi.noDesc ?? 0), color: (stockKpi.noDesc ?? 0) > 100 ? C.red : C.yellow },
              { label: '거래량 없음', val: fmt(stockKpi.noVolume ?? 0), color: (stockKpi.noVolume ?? 0) > 100 ? C.yellow : C.green },
            ].map(item => (
              <div key={item.label} style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '7px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: item.color }}>{item.val}</div>
                <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textSec }}>🇰🇷 KR 브리핑 최신</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: stockKpi.lastKRBriefing === new Date().toISOString().slice(0,10) ? C.green : C.red }}>
                {stockKpi.lastKRBriefing || '없음'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textSec }}>🇺🇸 US 브리핑 최신</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: stockKpi.lastUSBriefing ? C.cyan : C.red }}>
                {stockKpi.lastUSBriefing || '없음'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textSec }}>시세 수집 상태</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: stockKpi.active > stockKpi.total * 0.9 ? C.green : C.yellow }}>
                {stockKpi.active}/{stockKpi.total} 활성 ({Math.round((stockKpi.active / (stockKpi.total || 1)) * 100)}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 시세 건강도 + 앱인토스 상태 ── */}
      {(data as any).stockHealth && (() => {
        const h = (data as any).stockHealth;
        return (
          <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>🏥 시세 건강도</div>
              {[
                { label: 'KOSPI', val: `${Number(h.kospiPrice).toLocaleString()} (${h.kospiPct > 0 ? '+' : ''}${h.kospiPct}%)`, ok: h.kospiPrice > 1000 },
                { label: 'KOSDAQ', val: `${Number(h.kosdaqPrice).toLocaleString()} (${h.kosdaqPct > 0 ? '+' : ''}${h.kosdaqPct}%)`, ok: h.kosdaqPrice > 500 },
                { label: '등락률 0%', val: `${h.zeroPct}건`, ok: h.zeroPct < 300 },
                { label: '비정상 (>30%)', val: `${h.abnormalPct}건`, ok: h.abnormalPct === 0 },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 11, color: C.textSec }}>{r.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.ok ? C.green : C.red }}>{r.val}</span>
                </div>
              ))}
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>📱 앱인토스 현황</div>
              {[
                { label: '상태', val: 'v8 검토 요청됨', ok: true },
                { label: '콘솔', val: '#23948', ok: true },
                { label: 'SDK', val: '2.4.0', ok: true },
                { label: '퍼널', val: '5페이지 제한 적용', ok: true },
                { label: '피드 API', val: '/api/toss/feed', ok: true },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 11, color: C.textSec }}>{r.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.ok ? C.green : C.yellow }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── 계산기 KPI 패널 ── */}
      {(() => {
        const total = CALC_REGISTRY.length;
        const withEmoji = CALC_REGISTRY.filter(c => c.emoji).length;
        const withSeo = CALC_REGISTRY.filter(c => c.seoContent && c.seoContent.length > 100).length;
        const withFaq = CALC_REGISTRY.filter(c => c.faqs.length >= 3).length;
        const catMap: Record<string, number> = {};
        CALC_REGISTRY.forEach(c => { catMap[c.categoryLabel] = (catMap[c.categoryLabel] || 0) + 1; });
        const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
        return (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 'var(--sp-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>🧮 계산기 현황 ({total}종)</span>
              <span style={{ fontSize: 10, color: C.textDim }}>registry.ts · {CATEGORIES.length}개 카테고리</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }} className="mc-g4">
              {[
                { label: '전체', val: total, color: C.brand },
                { label: '이모지', val: withEmoji, color: withEmoji === total ? C.green : C.yellow },
                { label: 'SEO 본문', val: withSeo, color: withSeo === total ? C.green : C.yellow },
                { label: 'FAQ 3+', val: withFaq, color: withFaq === total ? C.green : C.yellow },
              ].map(item => (
                <div key={item.label} style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '7px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{item.val}</div>
                  <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}>카테고리별 분포</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {topCats.map(([cat, cnt]) => (
                  <span key={cat} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${C.brand}15`, color: C.textSec }}>
                    {cat} <strong style={{ color: C.text }}>{cnt}</strong>
                  </span>
                ))}
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
              {[
                { label: 'JSON-LD', val: '4종 (WebApp+FAQ+HowTo+Breadcrumb)', ok: true },
                { label: 'AggregateRating', val: '제거됨 (스팸 방지)', ok: true },
                { label: '회원가입 CTA', val: '결과CTA + 하단배너 (비로그인)', ok: true },
                { label: 'OG 이미지', val: '이모지 포함 1200×630 + 630×630', ok: true },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                  <span style={{ color: C.textSec }}>{r.label}</span>
                  <span style={{ fontWeight: 600, color: r.ok ? C.green : C.red }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── 단지백과 KPI 패널 ── */}
      {complexKpi && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 'var(--sp-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>🏢 단지백과 데이터 현황</span>
            <span style={{ fontSize: 10, color: C.textDim }}>apt_complex_profiles · rent_transactions</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            {[
              { label: '총 단지 프로필', val: fmt(complexKpi.totalProfiles), color: C.cyan },
              { label: '매매 보유', val: fmt(complexKpi.withSale), color: C.green },
              { label: '전세 보유', val: fmt(complexKpi.withJeonse), color: C.purple },
              { label: '좌표 매핑', val: fmt(complexKpi.withCoords), color: C.yellow },
              { label: '매매 거래', val: fmt(complexKpi.saleTransactions), color: C.text },
              { label: '전월세 거래', val: fmt(complexKpi.rentTransactions), color: C.text },
            ].map(item => (
              <div key={item.label} style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '7px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: item.color }}>{item.val}</div>
                <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textSec }}>📊 매매 커버율</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: complexKpi.withSale / (complexKpi.totalProfiles || 1) > 0.7 ? C.green : C.yellow }}>
                {complexKpi.withSale}/{complexKpi.totalProfiles} ({Math.round((complexKpi.withSale / (complexKpi.totalProfiles || 1)) * 100)}%)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textSec }}>📍 좌표 커버율</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: complexKpi.withCoords / (complexKpi.totalProfiles || 1) > 0.3 ? C.yellow : C.red }}>
                {complexKpi.withCoords}/{complexKpi.totalProfiles} ({Math.round((complexKpi.withCoords / (complexKpi.totalProfiles || 1)) * 100)}%)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textSec }}>📈 총 실거래 데이터</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.cyan }}>
                {fmt(complexKpi.saleTransactions + complexKpi.rentTransactions)}건
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Row 4.2: 데이터 커버리지 현황 ── */}
      {dataCoverage && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 'var(--sp-md)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>📊 데이터 커버리지</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-sm)' }}>
            {/* 분양가 수집 */}
            <div style={{ background: C.bg, borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: C.text }}>🏷️ 분양가 수집</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: dataCoverage.aptPrice.pct > 80 ? C.green : dataCoverage.aptPrice.pct > 30 ? C.yellow : C.red }}>{dataCoverage.aptPrice.pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden', marginBottom: 'var(--sp-xs)' }}>
                <div style={{ height: '100%', borderRadius: 3, background: dataCoverage.aptPrice.pct > 80 ? C.green : dataCoverage.aptPrice.pct > 30 ? C.yellow : C.red, width: `${dataCoverage.aptPrice.pct}%`, transition: 'width 0.6s' }} />
              </div>
              <div style={{ fontSize: 9, color: C.textDim }}>{fmt(dataCoverage.aptPrice.done)}/{fmt(dataCoverage.aptPrice.total)}건</div>
              {dataCoverage.aptCrawlRecent?.length > 0 && (
                <div style={{ marginTop: 'var(--sp-xs)', display: 'flex', gap: 2 }}>
                  {dataCoverage.aptCrawlRecent.map((r: any, i: number) => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: r.ok ? C.green : C.red }} title={`${r.at?.slice(11,16)} ${r.ok ? '✅' : '❌'} +${r.created}건${r.err ? ' ' + r.err : ''}`} />
                  ))}
                  <span style={{ fontSize: 8, color: C.textDim, marginLeft: 4 }}>최근 크론</span>
                </div>
              )}
            </div>
            {/* apt_sites 좌표 */}
            <div style={{ background: C.bg, borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: C.text }}>📍 사이트 좌표</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: dataCoverage.aptCoords.pct > 80 ? C.green : dataCoverage.aptCoords.pct > 30 ? C.yellow : C.red }}>{dataCoverage.aptCoords.pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden', marginBottom: 'var(--sp-xs)' }}>
                <div style={{ height: '100%', borderRadius: 3, background: dataCoverage.aptCoords.pct > 80 ? C.green : dataCoverage.aptCoords.pct > 30 ? C.yellow : C.red, width: `${Math.max(dataCoverage.aptCoords.pct, 1)}%`, transition: 'width 0.6s' }} />
              </div>
              <div style={{ fontSize: 9, color: C.textDim }}>{fmt(dataCoverage.aptCoords.done)}/{fmt(dataCoverage.aptCoords.total)}건</div>
            </div>
            {/* 🖼️ 이미지 수집 */}
            <div style={{ background: C.bg, borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: C.text }}>🖼️ 이미지 수집</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: (dataCoverage.aptImages?.pct ?? 0) > 50 ? C.green : (dataCoverage.aptImages?.pct ?? 0) > 10 ? C.yellow : C.red }}>{dataCoverage.aptImages?.pct ?? 0}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden', marginBottom: 'var(--sp-xs)' }}>
                <div style={{ height: '100%', borderRadius: 3, background: (dataCoverage.aptImages?.pct ?? 0) > 50 ? C.green : (dataCoverage.aptImages?.pct ?? 0) > 10 ? C.yellow : C.red, width: `${Math.max(dataCoverage.aptImages?.pct ?? 0, 1)}%`, transition: 'width 0.6s' }} />
              </div>
              <div style={{ fontSize: 9, color: C.textDim }}>{fmt(dataCoverage.aptImages?.done ?? 0)}/{fmt(dataCoverage.aptImages?.total ?? 0)}건</div>
            </div>
            {/* 종목 description */}
            <div style={{ background: C.bg, borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: C.text }}>📝 종목 설명</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: dataCoverage.stockDesc.pct > 80 ? C.green : dataCoverage.stockDesc.pct > 30 ? C.yellow : C.red }}>{dataCoverage.stockDesc.pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden', marginBottom: 'var(--sp-xs)' }}>
                <div style={{ height: '100%', borderRadius: 3, background: dataCoverage.stockDesc.pct > 80 ? C.green : dataCoverage.stockDesc.pct > 30 ? C.yellow : C.red, width: `${dataCoverage.stockDesc.pct}%`, transition: 'width 0.6s' }} />
              </div>
              <div style={{ fontSize: 9, color: C.textDim }}>{fmt(dataCoverage.stockDesc.done)}/{fmt(dataCoverage.stockDesc.total)}개</div>
              <div style={{ marginTop: 'var(--sp-xs)', fontSize: 8, color: C.yellow, fontWeight: 600 }}>{fmt(dataCoverage.stockDesc.total - dataCoverage.stockDesc.done)}개 누락</div>
            </div>
          </div>

          {/* ── PDF 파싱 + 건물스펙 + 섹터 커버리지 ── */}
          {dataCoverage.pdfParsing && (
            <div style={{ marginTop: 'var(--sp-md)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 8 }}>📄 PDF 파싱 + 건물스펙 (자동 갱신)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-sm)' }}>
                {/* PDF 파싱 진행률 */}
                <div style={{ background: C.bg, borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.text }}>📄 PDF 파싱</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: dataCoverage.pdfParsing.pct > 80 ? C.green : dataCoverage.pdfParsing.pct > 30 ? C.yellow : C.red }}>{dataCoverage.pdfParsing.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden', marginBottom: 'var(--sp-xs)' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: dataCoverage.pdfParsing.pct > 80 ? C.green : C.yellow, width: `${dataCoverage.pdfParsing.pct}%`, transition: 'width 0.6s' }} />
                  </div>
                  <div style={{ fontSize: 9, color: C.textDim }}>{fmt(dataCoverage.pdfParsing.done)}/{fmt(dataCoverage.pdfParsing.total)}건</div>
                </div>
                {/* 종목 섹터 */}
                <div style={{ background: C.bg, borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.text }}>🏷️ 종목 섹터</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: dataCoverage.stockSector.pct > 80 ? C.green : C.yellow }}>{dataCoverage.stockSector.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden', marginBottom: 'var(--sp-xs)' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: dataCoverage.stockSector.pct > 80 ? C.green : C.yellow, width: `${dataCoverage.stockSector.pct}%` }} />
                  </div>
                  <div style={{ fontSize: 9, color: C.textDim }}>{fmt(dataCoverage.stockSector.done)}/{fmt(dataCoverage.stockSector.total)}개</div>
                </div>
                {/* 건물스펙 요약 2칸 */}
                <div style={{ background: C.bg, borderRadius: 'var(--radius-sm)', padding: '10px 12px', gridColumn: 'span 2' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.text, marginBottom: 6 }}>🏗️ 건물스펙 (PDF 추출)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                    {[
                      { label: '총세대수', val: dataCoverage.buildingSpecs.totalHH },
                      { label: '동수', val: dataCoverage.buildingSpecs.dong },
                      { label: '최고층', val: dataCoverage.buildingSpecs.floor },
                      { label: '전매제한', val: dataCoverage.buildingSpecs.transfer },
                      { label: '발코니', val: dataCoverage.buildingSpecs.balcony },
                      { label: '커뮤니티', val: dataCoverage.buildingSpecs.community },
                      { label: '난방', val: dataCoverage.buildingSpecs.heating },
                      { label: '대출', val: dataCoverage.buildingSpecs.loan },
                      { label: '주차', val: dataCoverage.buildingSpecs.parking },
                    ].map(s => {
                      const pct = dataCoverage.buildingSpecs.total > 0 ? Math.round((s.val / dataCoverage.buildingSpecs.total) * 100) : 0;
                      return (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: C.textDim }}>{s.label}</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: pct > 30 ? C.green : pct > 10 ? C.yellow : C.red }}>{fmt(s.val)}</div>
                          <div style={{ fontSize: 8, color: C.textDim }}>{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Row 4.3: 프리미엄 매출 + IndexNow 진행률 ── */}
      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
        {/* 프리미엄 & 매출 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>⭐ 프로 멤버십 👑 프리미엄 & 매출 매출</span>
            <a href="/shop" target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: C.brand, textDecoration: 'none', fontWeight: 600 }}>페이지 →</a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 10 }}>
            <div style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: (premiumKpi?.subscribers ?? 0) > 0 ? C.yellow : C.textDim }}>{premiumKpi?.subscribers ?? 0}</div>
              <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>구독자</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: (premiumKpi?.totalRevenue ?? 0) > 0 ? C.green : C.textDim }}>₩{((premiumKpi?.totalRevenue ?? 0) / 1000).toFixed(0)}K</div>
              <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>총 매출</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textSec }}>
            <span>결제 건수: <strong style={{ color: C.text }}>{premiumKpi?.totalOrders ?? 0}</strong>건</span>
            <span>만료 예정: <strong style={{ color: (premiumKpi?.expiringSoon ?? 0) > 0 ? C.yellow : C.textDim }}>{premiumKpi?.expiringSoon ?? 0}</strong>명 (7일 내)</span>
          </div>
          {(premiumKpi?.totalOrders ?? 0) === 0 && (
            <div style={{ marginTop: 'var(--sp-sm)', padding: '6px 10px', background: C.yellow + '12', border: `1px solid ${C.yellow}30`, borderRadius: 'var(--radius-xs)', fontSize: 10, color: C.yellow, fontWeight: 600 }}>
              ⚠️ Toss 결제 키 미설정 — 결제 불가 상태
            </div>
          )}
        </div>

        {/* IndexNow 진행률 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>🔍 IndexNow 전송 현황</span>
            <span style={{ fontSize: 10, color: C.textDim }}>블로그 {fmt(premiumKpi?.indexNow?.total ?? 0)}편</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            <div style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{fmt(premiumKpi?.indexNow?.done ?? 0)}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>전송완료</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.yellow }}>{fmt(premiumKpi?.indexNow?.pending ?? 0)}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>대기</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '7px 8px', textAlign: 'center' }}>
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
      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
        {/* 블로그 생산 현황 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>📰 블로그 생산 현황</span>
            <span style={{ fontSize: 10, color: C.textDim }}>총 {fmt(kpi.blogs)}편</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            <div style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: (blogProduction?.today ?? 0) > 0 ? C.green : C.red }}>{blogProduction?.today ?? 0}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>오늘 발행</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.yellow }}>{fmt(blogProduction?.queue ?? 0)}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>미발행 큐</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '7px 8px', textAlign: 'center' }}>
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
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 'var(--sp-sm)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: C.textDim }}>AI 리라이팅</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: (seo?.blogRewrittenPct ?? 0) > 50 ? C.green : C.yellow }}>{seo?.blogRewrittenPct ?? 0}% 완료</span>
          </div>
        </div>

        {/* 댓글 + 크론 카테고리 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          {/* 댓글 통계 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 'var(--sp-sm)' }}>💬 댓글 & 크론 현황</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 10 }}>
            <div style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>{commentStats?.today ?? 0}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>오늘 댓글</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.purple }}>{fmt(commentStats?.totalReplies ?? 0)}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>대댓글</div>
            </div>
          </div>
          {/* 크론 카테고리별 */}
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>크론 카테고리 (24h)</div>
          {cronByCategory && Object.entries(cronByCategory as Record<string, any>).map(([cat, info]: [string, any]) => {
            const icons: Record<string, string> = { blog: '📝', stock: '📈', apt: '🏢', system: '⚙️' };
            const labels: Record<string, string> = { blog: '블로그', stock: '주식', apt: '부동산', system: '시스템' };
            const pct = info.total > 0 ? Math.round((info.success / info.total) * 100) : 100;
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--sp-xs)' }}>
                <span style={{ fontSize: 12, width: 16, textAlign: 'center' }}>{icons[cat]}</span>
                <span style={{ fontSize: 10, color: C.textSec, width: 40 }}>{labels[cat]}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: pct === 100 ? C.green : pct > 70 ? C.yellow : C.red, width: `${pct}%` }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, color: pct === 100 ? C.green : C.red, minWidth: 32, textAlign: 'right' }}>{info.success}/{info.total}</span>
                {info.created > 0 && <span style={{ fontSize: 9, color: C.cyan }}>+{fmt(info.created)}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Row 5: 페이지 타입 분포 + 카테고리 분포 ── */}
      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
        {/* 페이지 타입 분포 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>페이지 타입 분포</span>
            <span style={{ fontSize: 10, color: C.textDim }}>{fmt(totalSites)}건</span>
          </div>
          <div style={{ display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden', marginBottom: 'var(--sp-sm)' }}>
            {Object.entries(seo?.siteTypeBreakdown || {}).sort((a: any, b: any) => b[1].count - a[1].count).map(([type, info]: [string, any]) => (
              <div key={type} style={{ width: `${(info.count / totalSites) * 100}%`, background: typeColors[type] || C.textDim }} title={`${typeLabels[type] || type}: ${info.count}건`} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-sm)' }}>
            {Object.entries(seo?.siteTypeBreakdown || {}).sort((a: any, b: any) => b[1].count - a[1].count).map(([type, info]: [string, any]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 11 }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: typeColors[type] || C.textDim }} />
                <span style={{ color: C.textSec }}>{typeLabels[type] || type}</span>
                <span style={{ color: C.text, fontWeight: 700 }}>{fmt(info.count)}</span>
              </div>
            ))}
          </div>
        </div>
        {/* 카테고리별 게시글 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 'var(--sp-sm)' }}>카테고리별 게시글</div>
          {(categoryDistribution || []).map((c: any) => {
            const total = (categoryDistribution || []).reduce((s: number, x: any) => s + x.count, 0) || 1;
            return (
              <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-xs)' }}>
                <span style={{ fontSize: 12, width: 16, textAlign: 'center' }}>{catIcons[c.category] || '📄'}</span>
                <span style={{ fontSize: 11, color: C.textSec, width: 40 }}>{c.category}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: C.border, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: C.brand, width: `${(c.count / total) * 100}%`, opacity: 0.7 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.text, minWidth: 35, textAlign: 'right' }}>{fmt(c.count)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Row 5.5: 어제 대비 증감 요약 ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 'var(--sp-md)', display: 'flex', gap: 'var(--sp-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec }}>📊 어제 대비</span>
        {[
          { label: 'PV', today: visitors?.todayPV ?? 0, yest: yesterday?.pv ?? 0 },
          { label: '글', today: recentPosts?.length ?? 0, yest: yesterday?.posts ?? 0 },
          { label: '댓글', today: commentStats?.today ?? 0, yest: yesterday?.comments ?? 0 },
          { label: '신규유저', today: kpi.newUsersWeek ?? 0, yest: yesterday?.newUsers ?? 0 },
        ].map(item => {
          const d = delta(item.today, item.yest);
          return (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
              <span style={{ fontSize: 10, color: C.textDim }}>{item.label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{fmt(item.today)}</span>
              {d && <span style={{ fontSize: 9, fontWeight: 600, color: d.color }}>{d.arrow}{Math.abs(d.d)}</span>}
            </div>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
          <span style={{ fontSize: 10, color: C.textDim }}>주간PV</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.brand }}>{fmt(visitors?.weekPV ?? 0)}</span>
          <span style={{ fontSize: 10, color: C.textDim }}>UV</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.cyan }}>{fmt(visitors?.weekUV ?? 0)}</span>
        </div>
      </div>

      {/* ── Row 5.6: 자동발행 파이프라인 ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 'var(--sp-md)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>🔄 자동발행 파이프라인</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
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
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: `${step.color}08`, borderRadius: 'var(--radius-sm)', border: `1px solid ${step.color}20` }}>
              <div style={{ fontSize: 12, marginBottom: 2 }}>{step.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: step.color }}>{fmt(step.value)}</div>
              <div style={{ fontSize: 8, color: C.textDim, marginTop: 1 }}>{step.label}</div>
              <div style={{ fontSize: 8, color: step.color, fontWeight: 600 }}>{step.sub}</div>
            </div>
          ))}
        </div>
        {/* 발행 가능 글 + 리라이팅 진행률 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-sm)', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 'var(--sp-md)', fontSize: 10 }}>
            <span style={{ color: C.textDim }}>발행가능 <strong style={{ color: C.cyan }}>{fmt(blogProduction?.readyToPublish ?? 0)}</strong>편</span>
            <span style={{ color: C.textDim }}>리라이팅 <strong style={{ color: (seo?.blogRewrittenPct ?? 0) > 50 ? C.green : C.yellow }}>{seo?.blogRewrittenPct ?? 0}%</strong></span>
            <span style={{ color: C.textDim }}>총 <strong style={{ color: C.text }}>{fmt(kpi.blogs)}</strong>편</span>
          </div>
          {cron.anthropicCreditWarning && (
            <a href="https://platform.claude.com/settings/billing" target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: '#FF6B1A', fontWeight: 700, textDecoration: 'none', padding: '2px 6px', background: '#FF6B1A15', borderRadius: 4, border: '1px solid #FF6B1A30' }}>
              ⚠️ AI 크레딧 충전 필요
            </a>
          )}
        </div>
      </div>

      {/* ── 플랫폼 전체 현황 ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 'var(--sp-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>🌐 플랫폼 전체 현황</span>
          <span style={{ fontSize: 10, color: C.textDim }}>kadeora.app</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 'var(--sp-sm)' }}>
          {[
            { icon: '📰', label: '블로그', val: fmt(kpi.blogs), color: C.yellow },
            { icon: '📈', label: '종목', val: `${fmt(kpi.stocks)}개`, color: C.cyan },
            { icon: '🏢', label: '단지백과', val: fmt(complexKpi?.totalProfiles ?? 0), color: C.green },
            { icon: '👥', label: '유저', val: fmt(kpi.users), color: C.purple },
            { icon: '💰', label: '매매거래', val: fmt(complexKpi?.saleTransactions ?? 0), color: C.text },
            { icon: '🏠', label: '전월세', val: fmt(complexKpi?.rentTransactions ?? 0), color: C.text },
            { icon: '📋', label: '청약공고', val: fmt(kpi.subscriptions ?? 0), color: C.green },
            { icon: '⚡', label: '크론', val: `${cron.total}개/24h`, color: cron.fail === 0 ? C.green : C.red },
          ].map(item => (
            <div key={item.label} style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, marginBottom: 1 }}>{item.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: item.color }}>{item.val}</div>
              <div style={{ fontSize: 8, color: C.textDim }}>{item.label}</div>
            </div>
          ))}
        </div>
        {/* 추가 데이터 현황 */}
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap', paddingTop: 6, borderTop: `1px solid ${C.border}`, fontSize: 10 }}>
          <span style={{ color: C.textDim }}>분양사이트 <strong style={{ color: C.cyan }}>{fmt(seo?.aptSites ?? 5522)}</strong></span>
          <span style={{ color: C.textDim }}>미분양 <strong style={{ color: C.red }}>{fmt(kpi.unsold ?? 180)}</strong>건 <strong style={{ color: C.red }}>{fmt(kpi.unsoldUnits ?? 68264)}</strong>세대</span>
          <span style={{ color: C.textDim }}>재개발 <strong style={{ color: '#D85A30' }}>{fmt(kpi.redevOnly ?? 165)}</strong> 재건축 <strong style={{ color: '#D85A30' }}>{fmt(kpi.rebuildOnly ?? 37)}</strong></span>
          <span style={{ color: C.textDim }}>DB <strong style={{ color: C.text }}>{dataCoverage?.dbSize ?? '~1.4GB'}</strong></span>
        </div>
      </div>

      {/* ── 최근 릴리즈 내역 ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 'var(--sp-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>🚀 최근 릴리즈 (세션 70~72)</span>
          <span style={{ fontSize: 10, color: C.textDim }}>2026-04-04 ~ 05</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {[
            { tag: '⭐NEW', label: '계산기 142종 구축', desc: '동적 엔진+registry 등록만으로 페이지+SEO+JSON-LD 자동. 16카테고리', color: C.brand, commit: 's72-calc' },
            { tag: 'SEO', label: '계산기 SEO 만점', desc: '이모지141+맞춤FAQ131+seoContent133+HowTo+Rating4.8', color: C.green, commit: 's72-seo' },
            { tag: 'FEAT', label: '계산기 회원가입 CTA', desc: '결과CTA+하단배너. data-nudge로 GuestNudge 조율. 7접점', color: C.cyan, commit: 's72-cta' },
            { tag: '⭐NEW', label: 'PDF 전수 파싱', desc: '2,392건 완료. 취득세2,235 전매789 커뮤니티647 가격183', color: C.brand, commit: 's72-pdf' },
            { tag: 'FEAT', label: '총비용 시뮬레이터', desc: '타입/층/발코니/옵션/취득세 → 실입주 총비용 계산', color: C.green, commit: 's72-sim' },
            { tag: 'FEAT', label: '규제 신호등+입지분석', desc: '전매/거주/재당첨 뱃지. 학군/교통 2칼럼. 단지스펙', color: C.yellow, commit: 's72-reg' },
            { tag: 'UX', label: '이미지 Lightbox+허수', desc: '풀스크린+스와이프. 관심 공급세대×0.5. 추정 뱃지', color: C.cyan, commit: 's72-ux' },
            { tag: 'DATA', label: '블로그 59,388편', desc: '주식 1,844 + 단지백과 34,500 + 재개발 217 + 미분양 대량', color: C.brand, commit: 's70-blog' },
            { tag: 'SEO', label: '사이트맵+전수감사', desc: '23,967편 누락. 4,138편 유니크화. 내부링크 22+. 출처/면책', color: C.green, commit: 's70-seo' },
            { tag: 'FEAT', label: '광고판+인기검색어', desc: '카카오 스타일 AdBanner. TrendingTicker 헤더 통합', color: C.brand, commit: 's71-ad' },
            { tag: 'AUDIT', label: '전수감사 25건', desc: '등급통일, 가점계산기, 탈퇴, 세법3건, 군위군', color: C.purple, commit: 's71-audit' },
            { tag: 'DATA', label: '정보력 RPC 10개', desc: 'nearby_complexes, MA이동평균선, PER/PBR/배당/52주', color: C.yellow, commit: 's70-rpc' },
          ].map(r => (
            <div key={r.commit} style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: `${r.color}08`, border: `1px solid ${r.color}15` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${r.color}18`, color: r.color, fontWeight: 700 }}>{r.tag}</span>
                <span style={{ fontSize: 8, color: C.textDim, fontFamily: 'monospace' }}>{r.commit}</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 2 }}>{r.label}</div>
              <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.3 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 분양 정확도 + SEO 인덱싱 ── */}
      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
        {/* 분양 정확도 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>🎯 분양 정보 정확도</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dataCoverage?.aiSummary && (() => {
              const pct = dataCoverage.aiSummary.pct;
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-xs)' }}>
                    <span style={{ fontSize: 10, color: C.textSec }}>AI 요약 정확도</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: pct > 50 ? C.green : pct > 20 ? C.yellow : C.red }}>{dataCoverage.aiSummary.done}/{dataCoverage.aiSummary.total} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: pct > 50 ? C.green : pct > 20 ? C.yellow : C.red, width: `${pct}%`, transition: 'width 0.6s' }} />
                  </div>
                  <div style={{ fontSize: 8, color: C.textDim, marginTop: 2 }}>총·일반·특별 세대수 정확 포함 기준</div>
                </div>
              );
            })()}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-xs)' }}>
                <span style={{ fontSize: 10, color: C.textSec }}>분양가 수집</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: (dataCoverage?.aptPrice?.pct ?? 0) > 50 ? C.green : C.yellow }}>{dataCoverage?.aptPrice?.pct ?? 0}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: (dataCoverage?.aptPrice?.pct ?? 0) > 50 ? C.green : C.yellow, width: `${dataCoverage?.aptPrice?.pct ?? 0}%`, transition: 'width 0.6s' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-xs)' }}>
                <span style={{ fontSize: 10, color: C.textSec }}>이미지 수집</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: (dataCoverage?.aptImages?.pct ?? 0) > 30 ? C.green : C.red }}>{dataCoverage?.aptImages?.done ?? 0}/{dataCoverage?.aptImages?.total ?? 0} ({dataCoverage?.aptImages?.pct ?? 0}%)</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: (dataCoverage?.aptImages?.pct ?? 0) > 30 ? C.green : C.red, width: `${Math.max(dataCoverage?.aptImages?.pct ?? 0, 1)}%`, transition: 'width 0.6s' }} />
              </div>
            </div>
            {dataCoverage?.stockRefresh && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 10, color: C.textSec }}>시세 갱신</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: dataCoverage.stockRefresh.ok ? C.green : C.red }}>
                  {dataCoverage.stockRefresh.ok ? '✅ 정상' : '❌ 오류'} · {dataCoverage.stockRefresh.lastAt ? ago(dataCoverage.stockRefresh.lastAt) : '없음'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* SEO 인덱싱 현황 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>🔍 SEO / 인덱싱 현황</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 'var(--sp-sm)' }}>
            <div style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>{fmt(seo?.indexedBlogs ?? 0)}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>IndexNow 전송</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '7px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.yellow }}>{fmt(seo?.unindexedBlogs ?? 0)}</div>
              <div style={{ fontSize: 9, color: C.textDim }}>미전송</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
            {[
              { label: 'speakable', val: '6/6 페이지', ok: true },
              { label: 'FAQPage', val: '6/6 페이지', ok: true },
              { label: 'og-square', val: '6/6 페이지', ok: true },
              { label: 'SiteNav', val: '7개 네비게이션', ok: true },
              { label: 'thumbnailUrl', val: '6/6 페이지', ok: true },
              { label: 'naver:author', val: '전 페이지', ok: true },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                <span style={{ color: C.textSec }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: item.ok ? C.green : C.red }}>{item.val}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'var(--sp-sm)', paddingTop: 6, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: C.textDim }}>사이트맵</span>
            <span style={{ fontWeight: 700, color: (seo?.sitemapPct ?? 0) > 80 ? C.green : C.yellow }}>{seo?.sitemapPct ?? 0}% ({fmt(seo?.totalSitemap ?? 0)}건)</span>
          </div>
        </div>
      </div>

      {/* ── Row 6: Quick Actions ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-md)', flexWrap: 'wrap' }}>
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
        <QuickAction label="⭐ 프로" href="/shop" external />
        <QuickAction label="🔑 Anthropic" href="https://platform.claude.com/settings/billing" external />
        <QuickAction label="📊 Vercel" href="https://vercel.com/wls9205-5665s-projects/kadeora" external />
        <QuickAction label="🔍 SearchConsole" href="https://search.google.com/search-console" external />
        <QuickAction label="🇰🇷 서치어드바이저" href="https://searchadvisor.naver.com" external />
      </div>

      {/* ── Row 7: 실시간 활동 피드 ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 'var(--sp-md)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 'var(--sp-sm)' }}>실시간 활동</div>
        <ActivityFeed users={recentUsers || []} posts={recentPosts || []} comments={recentComments || []} reports={recentReports || []} />
      </div>

      {/* ── Row 8: 최근 가입 + 최근 게시글 ── */}
      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)' }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 'var(--sp-sm)' }}>최근 가입</div>
          {(recentUsers || []).map((u: Record<string, any>) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', padding: '5px 0', borderBottom: `1px solid ${C.border}08` }}>
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
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 'var(--sp-sm)' }}>최근 게시글</div>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--radius-xl)', background: ok ? C.green + '10' : C.red + '10', border: `1px solid ${ok ? C.green + '30' : C.red + '30'}` }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? C.green : C.red }} />
      <span style={{ fontSize: 10, fontWeight: 600, color: C.textSec }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 800, color: ok ? C.green : C.red }}>{value}</span>
    </div>
  );
}

function QuickAction({ label, href, onClick, external }: { label: string; href: string; onClick?: () => void; external?: boolean }) {
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: C.card, border: `1px solid ${C.border}`, color: C.textSec, fontSize: 11, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}>{label}</a>
  ) : (
    <button onClick={onClick} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: C.card, border: `1px solid ${C.border}`, color: C.textSec, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
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
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', padding: '4px 0', borderBottom: `1px solid ${C.border}08` }}>
          <span style={{ fontSize: 12, flexShrink: 0 }}>{item.icon}</span>
          <span style={{ flex: 1, fontSize: 11, color: item.type === 'report' ? C.red : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</span>
          <span style={{ fontSize: 9, color: C.textDim, flexShrink: 0 }}>{ago(item.time)}</span>
        </div>
      ))}
    </div>
  );
}
