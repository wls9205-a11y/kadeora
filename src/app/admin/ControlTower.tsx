'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

/* ═══════════════════════════════════════════════════════════
   ⚡ CONTROL TOWER - 원버튼으로 모든 것을 제어
   - 최대 병렬 처리 (10개 동시)
   - 실시간 상태 모니터링
   - 스마트 복구 (실패만 재실행)
═══════════════════════════════════════════════════════════ */

interface CronResult {
  endpoint: string;
  name: string;
  ok: boolean;
  status: number;
  duration: number;
  error?: string;
}

interface GodModeResult {
  ok: boolean;
  mode: string;
  summary: {
    total: number;
    success: number;
    failed: number;
    duration: number;
    avgDuration: number;
  };
  results: CronResult[];
  failedList: string[];
}

interface SystemHealth {
  total: number;
  healthy: number;
  failed: number;
  stale: number;
  score: number;
}

interface FailedCron {
  name: string;
  status: string;
  lastRun: string;
  duration: number;
  error?: string;
}

// KPI 카드 스타일
const CARD = {
  bg: '#0D1526',
  border: '#1E2D45',
  glow: (color: string) => `0 0 20px ${color}20`,
};

// 그룹별 색상
const GROUP_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  data: { bg: '#1E40AF20', text: '#60A5FA', icon: '📥' },
  process: { bg: '#065F4620', text: '#34D399', icon: '⚙️' },
  ai: { bg: '#7C3AED20', text: '#A78BFA', icon: '🤖' },
  content: { bg: '#D9770620', text: '#FBBF24', icon: '📝' },
  system: { bg: '#4B556320', text: '#9CA3AF', icon: '🔧' },
};

export default function ControlTower() {
  // ═══ 상태 ═══
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [failedCrons, setFailedCrons] = useState<FailedCron[]>([]);
  const [kpi, setKpi] = useState({
    users: 0, posts: 0, blogs: 0, stocks: 0,
    apt: 0, trade: 0, redev: 0, unsold: 0, sites: 0, interests: 0,
  });
  const [recentActivity, setRecentActivity] = useState<{ time: string; cron: string; status: string }[]>([]);
  
  // 실행 상태
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'full' | 'data' | 'content' | 'system' | 'failed'>('full');
  const [progress, setProgress] = useState({ phase: '', done: 0, total: 0 });
  const [result, setResult] = useState<GodModeResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 블로그/콘텐츠 상태
  const [blogStats, setBlogStats] = useState({ total: 0, rewritten: 0, pending: 0 });
  const [qualityIssues, setQualityIssues] = useState<string[]>([]);

  // ═══ 데이터 로드 ═══
  const loadAll = useCallback(async () => {
    const sb = createSupabaseBrowser();
    
    try {
      // 병렬로 모든 데이터 로드
      const [
        healthRes,
        usersR, postsR, blogsR, stocksR,
        aptR, tradeR, redevR, unsoldR, sitesR, interestsR,
        logsR, rwTotalR, rwDoneR,
        nullHhR, nullAiR, nullImgR,
      ] = await Promise.all([
        // GOD MODE API로 건강 상태 조회
        fetch('/api/admin/god-mode').then(r => r.json()).catch(() => null),
        // KPI 카운트
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
        sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }),
        sb.from('apt_transactions').select('id', { count: 'exact', head: true }),
        sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('unsold_apts').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('apt_sites').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('apt_site_interests').select('id', { count: 'exact', head: true }),
        // 최근 크론 로그
        sb.from('cron_logs').select('cron_name, status, started_at').order('started_at', { ascending: false }).limit(20),
        // 블로그 통계
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
        sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true).not('rewritten_at', 'is', null),
        // 품질 이슈
        sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true).is('total_households', null),
        sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }).is('ai_summary', null),
        sb.from('apt_sites').select('id', { count: 'exact', head: true }).eq('is_active', true).is('image_url', null),
      ]);

      // 건강 상태 설정
      if (healthRes?.health) {
        setHealth(healthRes.health);
        setFailedCrons(healthRes.failedCrons || []);
      }

      // KPI 설정
      setKpi({
        users: usersR.count || 0,
        posts: postsR.count || 0,
        blogs: blogsR.count || 0,
        stocks: stocksR.count || 0,
        apt: aptR.count || 0,
        trade: tradeR.count || 0,
        redev: redevR.count || 0,
        unsold: unsoldR.count || 0,
        sites: sitesR.count || 0,
        interests: interestsR.count || 0,
      });

      // 최근 활동
      setRecentActivity((logsR.data || []).slice(0, 10).map((l) => ({
        time: l.started_at ? new Date(l.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-',
        cron: l.cron_name,
        status: l.status,
      })));

      // 블로그 통계
      const total = rwTotalR.count || 0;
      const done = rwDoneR.count || 0;
      setBlogStats({ total, rewritten: done, pending: total - done });

      // 품질 이슈
      const issues: string[] = [];
      if ((nullHhR.count || 0) > 0) issues.push(`재개발 세대수 NULL: ${nullHhR.count}건`);
      if ((nullAiR.count || 0) > 100) issues.push(`청약 AI요약 없음: ${nullAiR.count}건`);
      if ((nullImgR.count || 0) > 100) issues.push(`현장 이미지 없음: ${nullImgR.count}건`);
      setQualityIssues(issues);

    } catch (e) {
      console.error('Load error:', e);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ═══ GOD MODE 실행 ═══
  const runGodMode = async (targetMode: typeof mode) => {
    if (running) return;
    
    setRunning(true);
    setMode(targetMode);
    setResult(null);
    setProgress({ phase: '초기화 중...', done: 0, total: 0 });
    setElapsed(0);
    
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - start), 100);

    try {
      setProgress({ phase: '🚀 GOD MODE 실행 중...', done: 0, total: 1 });
      
      const body: { mode: string; failedOnly?: string[] } = { mode: targetMode };
      if (targetMode === 'failed') {
        body.failedOnly = failedCrons.map(f => `/api/cron/${f.name}`);
      }
      
      const res = await fetch('/api/admin/god-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data: GodModeResult = await res.json();
      setResult(data);
      setProgress({ phase: '✅ 완료!', done: data.summary.success, total: data.summary.total });
      
    } catch (e) {
      console.error('God mode error:', e);
      setProgress({ phase: '❌ 에러 발생', done: 0, total: 0 });
    }
    
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    
    // 3초 후 데이터 새로고침
    setTimeout(() => {
      loadAll();
      window.dispatchEvent(new CustomEvent('admin-god-complete'));
    }, 3000);
  };

  // 실패한 크론만 재실행
  const retryFailed = () => runGodMode('failed');

  // ═══ 유틸 ═══
  const formatNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString();
  const formatMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

  // ═══ 로딩 ═══
  if (loading) {
    return (
      <div style={{ padding: '60px 20px', background: '#050A18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 50, height: 50, border: '3px solid #1E2D4520', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin .6s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: '#7D8DA3', fontSize: 14, fontWeight: 600 }}>컨트롤 타워 초기화...</div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: '#050A18', padding: '20px', color: '#E2E8F0' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px #2563EB40}50%{box-shadow:0 0 40px #2563EB60}}
        .god-btn:hover{transform:scale(1.02)}
        .god-btn:active{transform:scale(0.98)}
        .card{background:${CARD.bg};border:1px solid ${CARD.border};border-radius:12px;padding:16px}
        .mini-btn{padding:6px 12px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-weight:600;transition:all .15s}
        .mini-btn:hover{filter:brightness(1.1)}
        .mini-btn:disabled{opacity:.5;cursor:not-allowed}
      `}</style>

      {/* ═══ 헤더 ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#FFF', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            ⚡ 컨트롤 타워
            {health && (
              <span style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 20,
                background: health.score >= 90 ? '#05966920' : health.score >= 70 ? '#D9770620' : '#EF444420',
                color: health.score >= 90 ? '#34D399' : health.score >= 70 ? '#FBBF24' : '#F87171',
              }}>
                건강도 {health.score}%
              </span>
            )}
          </h1>
          <p style={{ fontSize: 12, color: '#7D8DA3', margin: '4px 0 0' }}>원버튼으로 모든 시스템을 최신 상태로</p>
        </div>
        <button onClick={() => loadAll()} className="mini-btn" style={{ background: '#1E2D45', color: '#94A3B8' }}>
          🔄 새로고침
        </button>
      </div>

      {/* ═══ GOD BUTTON ═══ */}
      <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', border: '1px solid #334155', boxShadow: running ? '0 0 30px #2563EB30' : 'none' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
          {/* 메인 GOD 버튼 */}
          <button
            onClick={() => runGodMode('full')}
            disabled={running}
            className="god-btn"
            style={{
              flex: '1 1 280px', minHeight: 100, padding: '20px 30px',
              background: running ? '#1E40AF' : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              border: 'none', borderRadius: 12, cursor: running ? 'not-allowed' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
              animation: running ? 'glow 1s ease-in-out infinite' : 'none',
              transition: 'all .2s',
            }}
          >
            {running ? (
              <>
                <div style={{ width: 28, height: 28, border: '3px solid #FFFFFF40', borderTopColor: '#FFF', borderRadius: '50%', animation: 'spin .5s linear infinite' }} />
                <span style={{ color: '#FFF', fontSize: 14, fontWeight: 700 }}>{progress.phase}</span>
                <span style={{ color: '#93C5FD', fontSize: 12 }}>{formatMs(elapsed)}</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 32 }}>⚡</span>
                <span style={{ color: '#FFF', fontSize: 18, fontWeight: 800 }}>전체 시스템 갱신</span>
                <span style={{ color: '#93C5FD', fontSize: 11 }}>모든 데이터 + 콘텐츠 + 시스템 (병렬 10x)</span>
              </>
            )}
          </button>

          {/* 서브 버튼들 */}
          <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { mode: 'data' as const, label: '📥 데이터 수집', desc: '청약/실거래/주식/재개발' },
              { mode: 'content' as const, label: '📝 콘텐츠 생성', desc: '시드/블로그/채팅' },
              { mode: 'system' as const, label: '🔧 시스템 정리', desc: '통계/등급/정리/색인' },
            ].map(({ mode: m, label, desc }) => (
              <button
                key={m}
                onClick={() => runGodMode(m)}
                disabled={running}
                className="mini-btn"
                style={{
                  flex: 1, padding: '10px 16px',
                  background: GROUP_COLORS[m]?.bg || '#1E2D45',
                  color: GROUP_COLORS[m]?.text || '#94A3B8',
                  textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 700 }}>{label}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 결과 표시 */}
        {result && (
          <div style={{ marginTop: 16, padding: 16, background: '#0F172A', borderRadius: 10, border: '1px solid #1E2D45' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: result.ok ? '#34D399' : '#F87171' }}>
                {result.ok ? '✅ 전체 성공' : `⚠️ ${result.summary.failed}건 실패`}
              </span>
              <span style={{ fontSize: 12, color: '#7D8DA3' }}>
                {result.summary.success}/{result.summary.total} · {formatMs(result.summary.duration)} (평균 {formatMs(result.summary.avgDuration)})
              </span>
            </div>
            
            {/* 실패 목록 */}
            {result.failedList.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: '#F87171', marginBottom: 6 }}>실패 목록:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.failedList.map(ep => (
                    <span key={ep} style={{ fontSize: 10, padding: '3px 8px', background: '#EF444420', color: '#F87171', borderRadius: 5 }}>
                      {ep.split('/').pop()}
                    </span>
                  ))}
                </div>
                <button
                  onClick={retryFailed}
                  disabled={running}
                  className="mini-btn"
                  style={{ marginTop: 10, background: '#DC262620', color: '#F87171', border: '1px solid #DC262640' }}
                >
                  🔄 실패한 것만 재실행 ({result.failedList.length}건)
                </button>
              </div>
            )}
            
            {/* 상세 결과 (접기) */}
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 11, color: '#7D8DA3', cursor: 'pointer' }}>상세 결과 보기</summary>
              <div style={{ marginTop: 10, maxHeight: 200, overflow: 'auto', fontSize: 10 }}>
                {result.results.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid #1E2D4520' }}>
                    <span style={{ width: 18, color: r.ok ? '#34D399' : '#F87171' }}>{r.ok ? '✓' : '✗'}</span>
                    <span style={{ flex: 1, color: '#C8D5E8' }}>{r.name}</span>
                    <span style={{ color: '#7D8DA3' }}>{formatMs(r.duration)}</span>
                    {r.error && <span style={{ color: '#F87171', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.error}</span>}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* ═══ KPI 그리드 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: '유저', value: kpi.users, icon: '👥', color: '#60A5FA' },
          { label: '게시글', value: kpi.posts, icon: '📝', color: '#34D399' },
          { label: '블로그', value: kpi.blogs, icon: '📰', color: '#A78BFA' },
          { label: '주식', value: kpi.stocks, icon: '📈', color: '#FBBF24' },
          { label: '청약', value: kpi.apt, icon: '🏠', color: '#60A5FA' },
          { label: '실거래', value: kpi.trade, icon: '💰', color: '#34D399' },
          { label: '재개발', value: kpi.redev, icon: '🔨', color: '#F87171' },
          { label: '미분양', value: kpi.unsold, icon: '📉', color: '#FB923C' },
          { label: '현장', value: kpi.sites, icon: '🏗️', color: '#2DD4BF' },
          { label: '관심고객', value: kpi.interests, icon: '📋', color: '#E879F9' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{formatNum(value)}</div>
            <div style={{ fontSize: 10, color: '#7D8DA3' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ═══ 하단 3컬럼 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* 시스템 상태 */}
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#FFF', marginBottom: 12 }}>🔍 시스템 상태</h3>
          {health ? (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1, textAlign: 'center', padding: 10, background: '#05966920', borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#34D399' }}>{health.healthy}</div>
                  <div style={{ fontSize: 10, color: '#34D399' }}>정상</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: 10, background: '#EF444420', borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#F87171' }}>{health.failed}</div>
                  <div style={{ fontSize: 10, color: '#F87171' }}>실패</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: 10, background: '#6B728020', borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#9CA3AF' }}>{health.stale}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>미확인</div>
                </div>
              </div>
              {failedCrons.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#F87171', marginBottom: 6 }}>⚠️ 실패한 크론</div>
                  {failedCrons.slice(0, 5).map(f => (
                    <div key={f.name} style={{ fontSize: 10, padding: '4px 0', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1E2D4520' }}>
                      <span style={{ color: '#C8D5E8' }}>{f.name}</span>
                      <span style={{ color: '#7D8DA3' }}>{f.error?.slice(0, 20)}...</span>
                    </div>
                  ))}
                  <button onClick={retryFailed} disabled={running} className="mini-btn" style={{ marginTop: 8, width: '100%', background: '#DC262620', color: '#F87171' }}>
                    🔄 전부 재실행
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#7D8DA3', fontSize: 12 }}>로딩 중...</div>
          )}
        </div>

        {/* 블로그 현황 */}
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#FFF', marginBottom: 12 }}>📰 블로그 현황</h3>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#A78BFA' }}>AI 리라이팅 진행률</span>
              <span style={{ fontSize: 11, color: '#7D8DA3' }}>{blogStats.rewritten}/{blogStats.total}</span>
            </div>
            <div style={{ height: 8, background: '#1E2D45', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${blogStats.total > 0 ? (blogStats.rewritten / blogStats.total * 100) : 0}%`, background: 'linear-gradient(90deg, #A78BFA, #7C3AED)', borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 10, color: '#7D8DA3', marginTop: 4 }}>
              남은 작업: {formatNum(blogStats.pending)}건 (예상 {Math.ceil(blogStats.pending / 30)}일)
            </div>
          </div>
          
          {/* 품질 이슈 */}
          {qualityIssues.length > 0 && (
            <div style={{ padding: 10, background: '#D9770610', borderRadius: 8, marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#FBBF24', marginBottom: 6 }}>⚠️ 품질 이슈</div>
              {qualityIssues.map((issue, i) => (
                <div key={i} style={{ fontSize: 10, color: '#D97706', padding: '2px 0' }}>• {issue}</div>
              ))}
            </div>
          )}
        </div>

        {/* 최근 활동 */}
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#FFF', marginBottom: 12 }}>📊 최근 크론 활동</h3>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {recentActivity.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #1E2D4520', fontSize: 11 }}>
                <span style={{ color: '#7D8DA3', minWidth: 50 }}>{a.time}</span>
                <span style={{ flex: 1, color: '#C8D5E8' }}>{a.cron}</span>
                <span style={{
                  padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                  background: a.status === 'success' ? '#05966920' : a.status === 'running' ? '#2563EB20' : '#EF444420',
                  color: a.status === 'success' ? '#34D399' : a.status === 'running' ? '#60A5FA' : '#F87171',
                }}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ 빠른 링크 ═══ */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#FFF', marginBottom: 12 }}>🔗 관리 페이지</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { href: '/admin/content', label: '콘텐츠' },
            { href: '/admin/users', label: '유저' },
            { href: '/admin/reports', label: '신고' },
            { href: '/admin/blog', label: '블로그' },
            { href: '/admin/infra', label: '인프라' },
            { href: '/admin/realestate', label: '부동산' },
            { href: '/admin/payments', label: '결제' },
            { href: '/admin/notifications', label: '알림' },
            { href: '/admin/system', label: '시스템' },
            { href: '/sitemap.xml', label: 'sitemap', external: true },
            { href: '/robots.txt', label: 'robots', external: true },
          ].map(l => (
            <a
              key={l.href}
              href={l.href}
              target={l.external ? '_blank' : undefined}
              style={{
                fontSize: 11, padding: '6px 12px', borderRadius: 6,
                background: '#1E2D45', color: '#94A3B8', textDecoration: 'none',
              }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
