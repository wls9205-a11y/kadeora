'use client';
import { useState, useEffect, useCallback } from 'react';
import BigEventCronMonitor from './BigEventCronMonitor';

interface Status {
  health_score: number;
  master_kill: { all_crons_paused: boolean; all_publishing_paused: boolean };
  migrations: { applied: boolean; tables: Record<string, { ok: boolean; error?: string; detail?: any }> };
  oauth_providers: Array<{ provider: string; configured: boolean; daysUntilRefreshExpiry: number | null; lastError: string | null; refreshCount: number }>;
  naver_syndication: any;
  calc_topics: any;
  calc_results: any;
  crons_24h: any;
  env: { ok: boolean; missing: string[]; status: Record<string, boolean> };
  app_config: Record<string, Record<string, any>>;
  next_actions: Array<{ priority: 'high' | 'medium' | 'low'; action: string; detail?: string }>;
  dashboard?: {
    health?: Record<string, number>;
    kpi_7d?: { sessions: number; visitors: number; signups_real: number; signups_total: number; login_page_sessions: number };
    kpi_30d?: { sessions: number; visitors: number; signups_real: number; signups_total: number; login_page_sessions: number };
    funnel_7d?: Array<{ day: string; visitors: number; login_visits: number; signups: number; conv_rate_pct: number }>;
    top_pages_24h?: Array<{ path: string; views: number }>;
    retention_tools?: Record<string, number>;
    cron_recent_failures?: Array<{ cron_name: string; error: string; started_at: string }>;
  } | null;
  // 세션 138: get_admin_dashboard_v2 확장 섹션
  image_system?: {
    blog_coverage_pct?: number;
    blog_images_total?: number;
    blog_posts_under_3_imgs?: number;
    blog_validation_count?: number;
    stock_coverage_pct?: number;
    stock_images_total?: number;
    stock_6_7_complete?: number;
    stock_symbols_covered?: number;
    stock_total_active?: number;
    broken_images_count?: number;
    low_relevance_count?: number;
  } | null;
  pg_cron_jobs?: Array<{ active: boolean; ok_24h: number; fail_24h: number; jobname: string; schedule: string; secs_since_last: number | null }>;
  cron_stuck?: { count: number; count_2h: number; count_30m: number; sample?: any[] } | null;
  dead_crons?: Array<{ cron_name: string; runs_7d: number; avg_ms: number; total_seconds_wasted: number }>;
  pg_cron_bridge_logs_24h?: Array<{ cron_name: string; calls: number; ok: number; fail: number; last_call_kst: string }>;
}

interface ExecuteStep {
  id: string;
  label: string;
  critical: boolean;
}

interface ExecuteResult {
  step: string;
  ok: boolean;
  duration_ms: number;
  result?: any;
  error?: string;
}

export default function MasterControlTab() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [execAvailable, setExecAvailable] = useState<ExecuteStep[]>([]);
  const [lastRun, setLastRun] = useState<any>(null);
  const [executing, setExecuting] = useState(false);
  const [execResults, setExecResults] = useState<ExecuteResult[]>([]);
  const [confirmExec, setConfirmExec] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([
        fetch('/api/admin/master/status').then(r => r.json()),
        fetch('/api/admin/master/execute-all').then(r => r.json()),
      ]);
      setStatus(s);
      setExecAvailable(e.available_steps || []);
      setLastRun(e.last_run || null);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function handleExecuteAll() {
    if (!confirmExec) { setConfirmExec(true); setTimeout(() => setConfirmExec(false), 5000); return; }
    setExecuting(true);
    setExecResults([]);
    try {
      const r = await fetch('/api/admin/master/execute-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      setExecResults(data.results || []);
    } catch (e) {
      alert('실행 실패: ' + e);
    }
    setExecuting(false);
    setConfirmExec(false);
    load();
  }

  async function handleConfigToggle(namespace: string, key: string, currentValue: any) {
    const newValue = typeof currentValue === 'boolean' ? !currentValue : currentValue;
    if (typeof currentValue !== 'boolean') return;
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namespace, key, value: newValue }),
    });
    load();
  }

  async function handleTriggerSingle(stepId: string) {
    setExecuting(true);
    const r = await fetch('/api/admin/master/execute-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: [stepId] }),
    });
    const data = await r.json();
    setExecResults(data.results || []);
    setExecuting(false);
    load();
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>로딩…</div>;
  if (!status) return <div style={{ padding: 40, textAlign: 'center', color: '#EF4444' }}>상태 조회 실패</div>;

  const hsColor = status.health_score >= 80 ? '#10B981' : status.health_score >= 60 ? '#F59E0B' : '#EF4444';
  const naverCafe = status.oauth_providers.find(p => p.provider === 'naver_cafe');
  const cronStats = status.crons_24h || {};

  return (
    <div style={{ padding: '12px 0' }}>
      {/* 헬스 스코어 + 핵심 KPI */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, padding: 16,
        background: 'linear-gradient(135deg, rgba(59,123,246,0.08), rgba(124,58,237,0.05))',
        borderRadius: 12, border: '1px solid rgba(59,123,246,0.2)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', border: `4px solid ${hsColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: hsColor }}>{status.health_score}</div>
          <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 700 }}>HEALTH</div>
        </div>
        <div style={{ flex: 1, fontSize: 12, color: '#E2E8F0' }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>🎛️ 마스터 컨트롤</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>크론 성공률 <strong style={{ color: cronStats.success_rate >= 90 ? '#10B981' : '#F59E0B' }}>{cronStats.success_rate ?? '?'}%</strong></span>
            <span>네이버 카페 발행 24h <strong>{status.naver_syndication?.cafe_published || 0}</strong>건</span>
            <span>계산기 결과 today <strong>{status.calc_results?.today || 0}</strong>건</span>
            {status.env.missing.length > 0 && <span style={{ color: '#F59E0B' }}>ENV 누락 {status.env.missing.length}개</span>}
          </div>
        </div>
      </div>

      {/* 📊 KPI 대시보드 (get_admin_dashboard RPC — 통합 메트릭) */}
      {status.dashboard && (
        <div style={{ marginBottom: 16, padding: 14, background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#93C5FD', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            📊 KPI 대시보드 (실시간)
          </div>

          {/* KPI 7일 vs 30일 */}
          {(status.dashboard.kpi_7d || status.dashboard.kpi_30d) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
              {[
                { label: '7일 방문자', val: status.dashboard.kpi_7d?.visitors, color: '#60A5FA' },
                { label: '7일 세션', val: status.dashboard.kpi_7d?.sessions, color: '#60A5FA' },
                { label: '7일 가입(실)', val: status.dashboard.kpi_7d?.signups_real, color: '#10B981' },
                { label: '7일 로그인 페이지', val: status.dashboard.kpi_7d?.login_page_sessions, color: '#F59E0B' },
                { label: '30일 방문자', val: status.dashboard.kpi_30d?.visitors, color: '#94A3B8' },
                { label: '30일 가입(실)', val: status.dashboard.kpi_30d?.signups_real, color: '#94A3B8' },
              ].map((k, i) => k.val !== undefined && (
                <div key={i} style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6, borderLeft: `2px solid ${k.color}` }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.val.toLocaleString('ko-KR')}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* 7일 깔때기 (전환율) */}
          {status.dashboard.funnel_7d && status.dashboard.funnel_7d.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, fontWeight: 700 }}>📉 7일 전환 깔때기 (방문 → 로그인페이지 → 가입)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {status.dashboard.funnel_7d.map((row) => (
                  <div key={row.day} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 60px', gap: 8, fontSize: 11, color: '#CBD5E1', padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
                    <span style={{ fontWeight: 600 }}>{row.day.slice(5)}</span>
                    <span>방문 <strong>{row.visitors}</strong></span>
                    <span>로그인 <strong>{row.login_visits}</strong></span>
                    <span>가입 <strong style={{ color: '#10B981' }}>{row.signups}</strong></span>
                    <span style={{ textAlign: 'right', color: row.conv_rate_pct >= 1 ? '#10B981' : '#F59E0B', fontWeight: 700 }}>{row.conv_rate_pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 24h Top 페이지 */}
          {status.dashboard.top_pages_24h && status.dashboard.top_pages_24h.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, fontWeight: 700 }}>🔥 24h Top 페이지 (top 5)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {status.dashboard.top_pages_24h.slice(0, 5).map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#CBD5E1', padding: '3px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'calc(100% - 70px)' }} title={decodeURIComponent(p.path)}>{decodeURIComponent(p.path)}</span>
                    <strong>{p.views.toLocaleString('ko-KR')}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 최근 cron 실패 */}
          {status.dashboard.cron_recent_failures && status.dashboard.cron_recent_failures.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, fontWeight: 700 }}>⚠️ 최근 cron 실패 (top 3)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {status.dashboard.cron_recent_failures.slice(0, 3).map((c, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#FCA5A5', padding: '4px 8px', background: 'rgba(239,68,68,0.05)', borderRadius: 4, lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700 }}>{c.cron_name}</div>
                    <div style={{ color: '#FECACA', opacity: 0.8 }}>{(c.error || '').slice(0, 100)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 세션 138: 이미지 시스템 + pg_cron + cron_stuck + dead_crons (v2 확장 섹션) */}
      {(status.image_system || (status.pg_cron_jobs && status.pg_cron_jobs.length > 0) || status.cron_stuck) && (
        <div style={{ marginBottom: 16, padding: 14, background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#93C5FD', marginBottom: 10 }}>
            🖼️ 이미지 시스템 · pg_cron · stuck
          </div>

          {/* 이미지 커버리지 */}
          {status.image_system && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
              {[
                { label: '블로그 이미지 커버리지', val: status.image_system.blog_coverage_pct, unit: '%', color: (status.image_system.blog_coverage_pct ?? 0) >= 90 ? '#10B981' : '#F59E0B' },
                { label: '블로그 이미지 총수', val: status.image_system.blog_images_total, color: '#60A5FA' },
                { label: '블로그 <3장', val: status.image_system.blog_posts_under_3_imgs, color: '#F59E0B' },
                { label: '종목 이미지 커버리지', val: status.image_system.stock_coverage_pct, unit: '%', color: (status.image_system.stock_coverage_pct ?? 0) >= 50 ? '#10B981' : '#EF4444' },
                { label: '종목 이미지 총수', val: status.image_system.stock_images_total, color: '#60A5FA' },
                { label: '종목 6-7장 완비', val: status.image_system.stock_6_7_complete, color: '#10B981' },
                { label: '저연관도 이미지', val: status.image_system.low_relevance_count, color: '#F59E0B' },
                { label: '깨진 이미지', val: status.image_system.broken_images_count, color: (status.image_system.broken_images_count ?? 0) > 0 ? '#EF4444' : '#10B981' },
              ].map((k, i) => k.val !== undefined && k.val !== null && (
                <div key={i} style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6, borderLeft: `2px solid ${k.color}` }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>
                    {typeof k.val === 'number' ? k.val.toLocaleString('ko-KR') : k.val}{k.unit ?? ''}
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* pg_cron 실시간 상태 */}
          {status.pg_cron_jobs && status.pg_cron_jobs.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, fontWeight: 700 }}>🕒 pg_cron 작업 ({status.pg_cron_jobs.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {status.pg_cron_jobs.map((j) => {
                  const dotColor = !j.active ? '#64748B' : (j.fail_24h > 0 ? '#EF4444' : (j.ok_24h > 0 ? '#10B981' : '#F59E0B'));
                  const lastAgo = j.secs_since_last !== null && j.secs_since_last !== undefined
                    ? (j.secs_since_last < 3600 ? `${Math.round(j.secs_since_last / 60)}분 전` : `${Math.round(j.secs_since_last / 3600)}시간 전`)
                    : '실행 이력 없음';
                  return (
                    <div key={j.jobname} style={{ display: 'grid', gridTemplateColumns: '10px 1fr 80px 90px 110px', gap: 8, alignItems: 'center', fontSize: 11, color: '#CBD5E1', padding: '5px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.jobname}>{j.jobname}</span>
                      <span style={{ fontFamily: 'monospace', color: '#94A3B8', fontSize: 10 }}>{j.schedule}</span>
                      <span style={{ color: '#10B981' }}>ok {j.ok_24h}{j.fail_24h > 0 && <span style={{ color: '#EF4444' }}> · fail {j.fail_24h}</span>}</span>
                      <span style={{ textAlign: 'right', color: '#94A3B8' }}>{lastAgo}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* cron_stuck 알림 */}
          {status.cron_stuck && status.cron_stuck.count > 0 && (
            <div style={{ marginBottom: 12, padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#FCA5A5', marginBottom: 4 }}>
                ⚠️ cron_stuck {status.cron_stuck.count}건 (30분 내 {status.cron_stuck.count_30m}, 2시간 내 {status.cron_stuck.count_2h})
              </div>
              <button
                onClick={() => fetch('/api/admin/master/cleanup-stuck-crons', { method: 'POST' }).then(() => load())}
                style={{ marginTop: 4, padding: '5px 12px', background: '#7F1D1D', color: '#FCA5A5', border: '1px solid #EF4444', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                stuck crons cleanup 실행
              </button>
            </div>
          )}

          {/* dead_crons top 5 */}
          {status.dead_crons && status.dead_crons.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, fontWeight: 700 }}>💀 dead_crons — 7일간 0 processed / 시간 낭비 top {Math.min(5, status.dead_crons.length)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {status.dead_crons.slice(0, 5).map((c) => (
                  <div key={c.cron_name} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px', gap: 8, fontSize: 11, color: '#CBD5E1', padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
                    <span style={{ fontFamily: 'monospace' }}>{c.cron_name}</span>
                    <span style={{ color: '#F59E0B', textAlign: 'right' }}>{c.runs_7d}회</span>
                    <span style={{ color: '#F87171', textAlign: 'right', fontWeight: 700 }}>{Math.round(c.total_seconds_wasted / 60)}분 낭비</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 세션 139: Big Event Phase 2 cron 모니터링 */}
      <BigEventCronMonitor />

      {/* 🚨 마스터 킬 스위치 */}
      <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#FCA5A5', marginBottom: 8 }}>🚨 마스터 킬 스위치 (긴급정지)</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { key: 'all_crons_paused', label: '모든 크론 정지' },
            { key: 'all_publishing_paused', label: '모든 외부 발행 정지' },
          ].map(({ key, label }) => {
            const val = (status.master_kill as any)[key];
            return (
              <button key={key} onClick={() => handleConfigToggle('master_kill', key, val)}
                style={{ padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: val ? '#EF4444' : 'rgba(255,255,255,0.05)',
                  color: val ? '#fff' : '#94A3B8',
                  border: `1px solid ${val ? '#EF4444' : 'rgba(255,255,255,0.1)'}` }}>
                {val ? '🛑 정지중' : '✅ 정상'} · {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 다음 액션 권장 */}
      {status.next_actions && status.next_actions.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#FCD34D', marginBottom: 8 }}>📋 권장 조치</div>
          {status.next_actions.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', fontSize: 12, color: '#E2E8F0' }}>
              <span style={{ minWidth: 50, padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700, color: '#fff', textAlign: 'center',
                background: a.priority === 'high' ? '#EF4444' : a.priority === 'medium' ? '#F59E0B' : '#64748B' }}>
                {a.priority.toUpperCase()}
              </span>
              <div style={{ flex: 1 }}>
                <div>{a.action}</div>
                {a.detail && <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', marginTop: 2 }}>{a.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 시스템 상태 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginBottom: 16 }}>

        {/* DB 마이그레이션 */}
        <div style={{ background: 'rgba(12,21,40,0.6)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', marginBottom: 8 }}>
            🗄️ DB 마이그레이션 {status.migrations.applied ? '✅' : '❌'}
          </div>
          {Object.entries(status.migrations.tables).map(([t, s]) => (
            <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
              <span style={{ color: '#94A3B8' }}>{t}</span>
              <span style={{ color: s.ok ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                {s.ok ? `${(s as any).detail?.count ?? 0}건` : '❌'}
              </span>
            </div>
          ))}
          {!status.migrations.applied && (
            <div style={{ marginTop: 8, padding: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 4, fontSize: 11, color: '#FCA5A5' }}>
              누락된 테이블이 있음. <code>docs/migrations/20260417_*.sql</code> 4개를 Supabase Dashboard SQL Editor에서 실행하세요.
            </div>
          )}
        </div>

        {/* 네이버 OAuth */}
        <div style={{ background: 'rgba(12,21,40,0.6)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', marginBottom: 8 }}>
            🟢 네이버 OAuth {naverCafe?.configured ? '✅' : '❌'}
          </div>
          {naverCafe ? (
            <>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
                refresh_token 만료까지: <strong style={{ color: (naverCafe.daysUntilRefreshExpiry ?? 999) < 30 ? '#F59E0B' : '#10B981' }}>{naverCafe.daysUntilRefreshExpiry ?? '?'}일</strong>
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                Refresh 횟수: <strong style={{ color: '#E2E8F0' }}>{naverCafe.refreshCount}</strong>
              </div>
              {naverCafe.lastError && <div style={{ fontSize: 10, color: '#EF4444', marginTop: 4 }}>{naverCafe.lastError}</div>}
            </>
          ) : (
            <div style={{ fontSize: 11, color: '#FCA5A5' }}>NaverPublishTab 에서 등록 필요</div>
          )}
        </div>

        {/* 네이버 카페 큐 */}
        <div style={{ background: 'rgba(12,21,40,0.6)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', marginBottom: 8 }}>📤 카페 발행 큐</div>
          {status.naver_syndication?.error ? (
            <div style={{ fontSize: 11, color: '#EF4444' }}>{status.naver_syndication.error}</div>
          ) : (
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              <div>대기: <strong style={{ color: '#F59E0B' }}>{status.naver_syndication?.cafe_pending || 0}</strong>건</div>
              <div>완료: <strong style={{ color: '#10B981' }}>{status.naver_syndication?.cafe_published || 0}</strong>건</div>
              <div>실패: <strong style={{ color: '#EF4444' }}>{status.naver_syndication?.cafe_failed || 0}</strong>건</div>
            </div>
          )}
        </div>

        {/* 계산기 토픽 */}
        <div style={{ background: 'rgba(12,21,40,0.6)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', marginBottom: 8 }}>🧮 계산기 토픽</div>
          {status.calc_topics?.error ? (
            <div style={{ fontSize: 11, color: '#EF4444' }}>{status.calc_topics.error}</div>
          ) : (
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              <div>토픽: <strong style={{ color: '#E2E8F0' }}>{status.calc_topics?.total || 0}</strong>개</div>
              <div>AI 도입부 있음: <strong style={{ color: '#10B981' }}>{status.calc_topics?.with_intro || 0}</strong></div>
              <div>30일+ 갱신 필요: <strong style={{ color: '#F59E0B' }}>{status.calc_topics?.stale_30d || 0}</strong></div>
              <div>총 검색량(추정): <strong style={{ color: '#E2E8F0' }}>{(status.calc_topics?.total_search_volume || 0).toLocaleString()}</strong>/월</div>
            </div>
          )}
        </div>

        {/* 계산기 결과 */}
        <div style={{ background: 'rgba(12,21,40,0.6)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', marginBottom: 8 }}>💾 계산기 결과 URL</div>
          {status.calc_results?.error ? (
            <div style={{ fontSize: 11, color: '#EF4444' }}>{status.calc_results.error}</div>
          ) : (
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              <div>전체: <strong style={{ color: '#E2E8F0' }}>{status.calc_results?.total || 0}</strong>건</div>
              <div>오늘 생성: <strong style={{ color: '#10B981' }}>{status.calc_results?.today || 0}</strong>건</div>
              <div>색인 가능 (조회 5+): <strong style={{ color: '#3B7BF6' }}>{status.calc_results?.indexable || 0}</strong>건</div>
            </div>
          )}
        </div>

        {/* 크론 24h */}
        <div style={{ background: 'rgba(12,21,40,0.6)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', marginBottom: 8 }}>⚡ 크론 24h</div>
          {cronStats.error ? (
            <div style={{ fontSize: 11, color: '#EF4444' }}>{cronStats.error}</div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                <div>실행: <strong style={{ color: '#E2E8F0' }}>{cronStats.total}</strong>건 · 성공률 <strong style={{ color: cronStats.success_rate >= 90 ? '#10B981' : '#F59E0B' }}>{cronStats.success_rate}%</strong></div>
                <div>실패: <strong style={{ color: '#EF4444' }}>{cronStats.failed}</strong> · 좀비 running: <strong style={{ color: '#F59E0B' }}>{cronStats.stuck_running}</strong></div>
              </div>
              {cronStats.worst && cronStats.worst.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 10, color: '#FCA5A5' }}>
                  최다 실패: {cronStats.worst.slice(0, 3).map((w: any) => `${w.name}(×${w.failed})`).join(', ')}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 환경변수 */}
      <details style={{ background: 'rgba(12,21,40,0.6)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <summary style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', cursor: 'pointer' }}>
          🔐 환경변수 ({status.env.ok ? '✅ 모두 설정됨' : `❌ ${status.env.missing.length}개 누락`})
        </summary>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 4 }}>
          {Object.entries(status.env.status).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 6px', borderRadius: 3,
              background: v ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)' }}>
              <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
              <span style={{ color: v ? '#10B981' : '#EF4444', fontWeight: 700 }}>{v ? '✓' : '✗'}</span>
            </div>
          ))}
        </div>
      </details>

      {/* 🚀 전체 실행 버튼 */}
      <div style={{ background: 'linear-gradient(135deg, rgba(59,123,246,0.15), rgba(124,58,237,0.15))',
        border: '2px solid rgba(59,123,246,0.4)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#E2E8F0', marginBottom: 4 }}>
              🚀 전체 실행
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              {execAvailable.length}단계 순차 실행: 마이그레이션 확인 → 네이버 발행 → 계산기 갱신 → IndexNow → 정리
            </div>
          </div>
          <button onClick={handleExecuteAll} disabled={executing || status.master_kill.all_crons_paused}
            style={{
              padding: '14px 28px', fontSize: 14, fontWeight: 800, cursor: executing ? 'not-allowed' : 'pointer',
              borderRadius: 10, border: 'none', minWidth: 200,
              background: confirmExec ? '#EF4444' : executing ? '#64748B' : '#10B981',
              color: '#fff', boxShadow: confirmExec ? '0 0 20px rgba(239,68,68,0.4)' : '0 0 20px rgba(16,185,129,0.3)',
              transition: 'all 0.2s',
            }}>
            {executing ? '⏳ 실행 중…' : confirmExec ? '⚠️ 한 번 더 클릭하면 즉시 실행' : '▶️ 전체 실행'}
          </button>
        </div>
        {status.master_kill.all_crons_paused && (
          <div style={{ fontSize: 11, color: '#EF4444' }}>⚠️ 마스터 킬 (all_crons_paused) 켜져있어 실행 불가. 위에서 해제하세요.</div>
        )}
      </div>

      {/* 단계별 트리거 */}
      <div style={{ background: 'rgba(12,21,40,0.6)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', marginBottom: 8 }}>🎯 단계별 개별 실행</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
          {execAvailable.map(step => {
            const lastStepRes = execResults.find(r => r.step === step.id) || (lastRun?.results || []).find((r: any) => r.step === step.id);
            return (
              <button key={step.id} onClick={() => handleTriggerSingle(step.id)} disabled={executing}
                style={{ padding: '10px 12px', borderRadius: 6, cursor: executing ? 'not-allowed' : 'pointer',
                  background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 11, fontWeight: 600, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>{step.label}</span>
                {lastStepRes && (
                  <span style={{ fontSize: 10, color: lastStepRes.ok ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                    {lastStepRes.ok ? `✓ ${lastStepRes.duration_ms}ms` : '✗'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 마지막 실행 결과 */}
      {(execResults.length > 0 || lastRun) && (
        <div style={{ background: 'rgba(12,21,40,0.6)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', marginBottom: 8 }}>
            📜 {execResults.length > 0 ? '이번 실행 결과' : '마지막 실행 결과'}
          </div>
          {(execResults.length > 0 ? execResults : lastRun?.results || []).map((r: ExecuteResult, i: number) => (
            <div key={i} style={{ padding: 6, borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: r.ok ? '#10B981' : '#EF4444', fontWeight: 700 }}>{r.ok ? '✓' : '✗'} {r.step}</span>
                <span style={{ color: '#64748B' }}>{r.duration_ms}ms</span>
              </div>
              {r.error && <div style={{ marginTop: 4, color: '#EF4444', fontSize: 10 }}>{r.error}</div>}
              {r.result && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ cursor: 'pointer', color: '#94A3B8', fontSize: 10 }}>결과 보기</summary>
                  <pre style={{ marginTop: 4, padding: 6, background: '#0a0e27', color: '#94A3B8', fontSize: 10, borderRadius: 3, overflow: 'auto', maxHeight: 200 }}>
                    {JSON.stringify(r.result, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
