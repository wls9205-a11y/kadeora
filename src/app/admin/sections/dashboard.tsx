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

  const { kpi, visitors, yesterday, topPages, categoryDistribution, cronDetail, totalRecordsCreated, recentUsers, recentPosts, recentComments, recentReports, dailyStats, cron, seo } = data;
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
          <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${autoRefresh ? C.green + '40' : C.border}`, background: autoRefresh ? C.green + '15' : C.card, color: autoRefresh ? C.green : C.textDim, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
            {autoRefresh ? '🟢 LIVE' : '⏸ 일시정지'}
          </button>
          <button onClick={loadData} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.textSec, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>🔄</button>
        </div>
      </div>

      {/* ── Row 1: 시스템 헬스 바 ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <HealthBadge label="크론" value={`${cron.success}/${cron.total}`} ok={cron.fail === 0} />
        <HealthBadge label="에러" value={kpi.pendingReports > 0 ? `${kpi.pendingReports}건` : '없음'} ok={kpi.pendingReports === 0} />
        <HealthBadge label="DB" value={data.dbSize || '226MB'} ok={true} />
        <HealthBadge label="24h 생산" value={fmt(totalRecordsCreated || 0) + '건'} ok={(totalRecordsCreated || 0) > 0} />
        <HealthBadge label="사이트맵" value={`${seo?.sitemapPct || 0}%`} ok={(seo?.sitemapPct || 0) > 80} />
      </div>

      {/* ── Row 2: 핵심 KPI 6카드 + 어제 대비 ── */}
      <div className="mc-g6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { icon: '👁️', label: '오늘 PV', value: visitors?.todayPV ?? 0, color: C.brand, yest: yesterday?.pv },
          { icon: '👤', label: '오늘 UV', value: visitors?.todayUV ?? 0, color: C.cyan, yest: null },
          { icon: '📊', label: '주간 PV', value: visitors?.weekPV ?? 0, color: C.brand, yest: null },
          { icon: '🧑‍🤝‍🧑', label: '전체 유저', value: kpi.users, color: C.green, yest: null },
          { icon: '📝', label: '게시글', value: kpi.posts, color: C.purple, yest: null },
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

      {/* ── Row 6: Quick Actions ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <QuickAction label="⚡ GOD MODE" href="#" onClick={() => { const el = document.querySelector('[data-section="godmode"]') as HTMLElement; el?.click(); }} />
        <QuickAction label="📊 SEO" href="#" onClick={() => { const el = document.querySelector('[data-section="seo"]') as HTMLElement; el?.click(); }} />
        <QuickAction label="🛰️ 위성" href="#" onClick={() => { const el = document.querySelector('[data-section="satellite"]') as HTMLElement; el?.click(); }} />
        <QuickAction label="🏢 부동산" href="#" onClick={() => { const el = document.querySelector('[data-section="realestate"]') as HTMLElement; el?.click(); }} />
        <QuickAction label="📈 주식" href="/stock" external />
        <QuickAction label="🔍 사이트" href="https://kadeora.app" external />
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
