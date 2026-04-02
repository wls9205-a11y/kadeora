'use client';
import { errMsg } from '@/lib/error-utils';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, C, DataTable, KPI, KPICard } from '../admin-shared';

export default function GodModeSection() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<string>('full');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [specialLog, setSpecialLog] = useState('');
  const [specialRunning, setSpecialRunning] = useState(false);
  const [verifyItems, setVerifyItems] = useState<any[]>([]);
  const [verifyCount, setVerifyCount] = useState(0);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [fixLog, setFixLog] = useState('');

  const runFix = async (endpoint: string, action: string, extra?: Record<string, any>) => {
    setFixLog(`⏳ ${action}...`);
    try {
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setFixLog(`❌ ${action} 실패 — ${data.error || `HTTP ${res.status}`}`);
      } else {
        setFixLog(`✅ ${action} — ${JSON.stringify(data).slice(0, 200)}`);
        setTimeout(() => runAudit(), 1500);
      }
    } catch (e: any) { setFixLog(`❌ ${action} 실패 — ${errMsg(e)}`); }
  };
    } catch (e: any) { setFixLog(`❌ ${action} 실패 — ${errMsg(e)}`); }
  };

  const runAudit = async () => {
    setAuditLoading(true);
    setFixLog('');
    try {
      const res = await fetch('/api/admin/audit');
      const data = await res.json();
      if (data.error) {
        setFixLog(`❌ 전수조사 실패 — ${data.error}`);
        setAuditData(null);
      } else {
        setAuditData(data);
        setFixLog('✅ 전수조사 완료');
      }
    } catch (e: any) {
      setFixLog(`❌ 전수조사 실패 — ${errMsg(e)}`);
      setAuditData(null);
    }
    setAuditLoading(false);
  };

  const loadVerifyItems = async () => {
    setVerifyLoading(true);
    try {
      const res = await fetch('/api/admin/verify-households');
      const data = await res.json();
      setVerifyItems(data.items || []);
      setVerifyCount(data.total_null || 0);
    } catch { /* */ }
    setVerifyLoading(false);
  };

  const saveHousehold = async (id: number, name: string, value: string) => {
    const hh = Number(value);
    if (!hh || hh <= 0) return;
    try {
      const res = await fetch('/api/admin/verify-households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, total_households: hh }),
      });
      const data = await res.json();
      if (data.ok) {
        setSpecialLog(`✅ ${name} → ${hh.toLocaleString()}세대 (공급 ${data.supply} · 비율 ${data.ratio})`);
        setVerifyItems(prev => prev.filter(v => v.id !== id));
        setVerifyCount(prev => prev - 1);
      } else {
        setSpecialLog(`❌ ${name}: ${data.error}`);
      }
    } catch (e: any) { setSpecialLog(`❌ ${errMsg(e)}`); }
  };

  const runSpecial = async (endpoint: string, label: string, body?: Record<string, unknown>) => {
    if (specialRunning) return;
    setSpecialRunning(true);
    setSpecialLog(`⏳ ${label} 실행 중...`);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      setSpecialLog(`✅ ${label} 완료 — ${JSON.stringify(data).slice(0, 200)}`);
    } catch (e: unknown) {
      setSpecialLog(`❌ ${label} 실패 — ${errMsg(e)}`);
    } finally {
      setSpecialRunning(false);
    }
  };

  // 크론 엔드포인트를 god-mode single 모드로 실행 (CRON_SECRET 인증 자동)
  const runCronSingle = async (cronPath: string, label: string) => {
    if (specialRunning) return;
    setSpecialRunning(true);
    setSpecialLog(`⏳ ${label} 실행 중...`);
    try {
      const res = await fetch('/api/admin/god-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', endpoint: cronPath }),
      });
      const data = await res.json();
      const r = data.results?.[0];
      if (r?.ok) {
        setSpecialLog(`✅ ${label} 완료 — HTTP ${r.status} (${(r.duration / 1000).toFixed(1)}s)`);
      } else {
        setSpecialLog(`❌ ${label} 실패 — ${r?.error || `HTTP ${r?.status}`}`);
      }
    } catch (e: unknown) {
      setSpecialLog(`❌ ${label} 실패 — ${errMsg(e)}`);
    } finally {
      setSpecialRunning(false);
    }
  };

  const run = async (m: string) => {
    setRunning(true);
    setResults([]);
    setElapsed(0);
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - start), 100);

    try {
      const body: any = { mode: m };
      // 실패 재시도 시 이전 실패 목록 전달
      if (m === 'failed' && results.length > 0) {
        body.failedOnly = results.filter(r => !r.ok).map(r => r.endpoint).filter(Boolean);
      }
      const res = await fetch('/api/admin/god-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (e: unknown) {
      setResults([{ name: 'ERROR', ok: false, error: errMsg(e) }]);
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(Date.now() - start);
      setRunning(false);
    }
  };

  const modes = [
    { key: 'full', label: '⚡ 전체 실행', desc: 'Phase 순차 — 95개 전 크론 (종목발굴+시세+부동산+검증)', color: C.brand },
    { key: 'data', label: '📊 데이터 수집', desc: '청약/실거래/주식시세/종목발굴/재개발 18개', color: C.green },
    { key: 'process', label: '⚙️ 데이터 가공', desc: '집계/싱크/총세대수검증/K-apt/네이버단지 13개', color: C.cyan },
    { key: 'ai', label: '🤖 AI 생성', desc: '요약/이미지/트렌드 7개 (fire&forget)', color: C.purple },
    { key: 'content', label: '📝 콘텐츠', desc: '블로그/시드 36개 (fire&forget)', color: C.yellow },
    { key: 'system', label: '🔧 시스템', desc: '헬스/통계/알림/정리 21개', color: C.textSec },
    { key: 'failed', label: '🔴 실패 재시도', desc: '실패한 것만', color: C.red },
  ];

  const successCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;
  const dispatchedCount = results.filter(r => (r.status as number) === 202).length;

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: C.text, margin: '0 0 8px' }}>⚡ GOD MODE</h1>
      <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 24px' }}>Phase 순차 실행 — AI/콘텐츠는 Fire&amp;Forget (백그라운드 실행)</p>

      {/* Mode Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 'var(--sp-2xl)' }}>
        {modes.map(m => (
          <button key={m.key} onClick={() => { setMode(m.key); run(m.key); }} disabled={running}
            style={{
              padding: '16px 14px', borderRadius: 'var(--radius-card)', border: `1px solid ${running ? C.border : m.color}40`,
              background: C.card, cursor: running ? 'wait' : 'pointer', textAlign: 'left', transition: 'all .15s',
            }}
            onMouseEnter={e => { if (!running) e.currentTarget.style.borderColor = m.color; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${m.color}40`; }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 'var(--sp-xs)' }}>{m.label}</div>
            <div style={{ fontSize: 11, color: C.textDim }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Progress */}
      {running && (
        <div style={{ background: C.card, border: `1px solid ${C.brand}40`, borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 'var(--sp-xl)', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 'var(--sp-sm)', animation: 'pulse 1.5s infinite' }}>⚡</div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: C.text }}>{mode.toUpperCase()} 실행 중...</div>
          <div style={{ fontSize: 14, color: C.brand, fontWeight: 600, marginTop: 'var(--sp-xs)' }}>{(elapsed / 1000).toFixed(1)}초</div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
            <KPICard icon="✅" label="성공" value={successCount - dispatchedCount} color={C.green} />
            <KPICard icon="🚀" label="Dispatched" value={dispatchedCount} color={C.purple} />
            <KPICard icon="❌" label="실패" value={failCount} color={C.red} />
            <KPICard icon="⏱" label="소요시간" value={`${(elapsed / 1000).toFixed(1)}s`} color={C.brand} />
          </div>
          <DataTable
            headers={['크론', 'Phase', '상태', 'HTTP', '소요시간', '에러']}
            rows={results.map(r => [
              <span key="n" style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{r.name as string}</span>,
              <span key="p" style={{ fontSize: 11, color: C.textDim }}>{(r as Record<string, unknown>).phase as string || '—'}</span>,
              (r.status as number) === 202
                ? <Badge key="s" color={C.purple}>🚀 SENT</Badge>
                : r.ok ? <Badge key="s" color={C.green}>✓ OK</Badge> : <Badge key="s" color={C.red}>✗ FAIL</Badge>,
              r.status ? <span key="h" style={{ color: (r.status as number) === 202 ? C.purple : (r.status as number) >= 400 ? C.red : (r.status as number) >= 200 ? C.green : C.textDim, fontFamily: 'monospace', fontSize: 12 }}>{r.status as number}</span> : '—',
              r.duration ? `${((r.duration as number) / 1000).toFixed(1)}s` : '—',
              r.error ? <span key="e" style={{ color: C.red, fontSize: 11, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{r.error as string}</span> : '—',
            ])}
          />
        </>
      )}

      {/* ━━━ 전수조사 ━━━ */}
      <div style={{ marginTop: 32, borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>🔍 전수조사</div>
            <div style={{ fontSize: 12, color: C.textDim }}>주식 시세 + 부동산 세부정보 데이터 품질 검사</div>
          </div>
          <button onClick={runAudit} disabled={auditLoading}
            style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.brand}40`, background: C.card, color: C.brand, fontWeight: 700, fontSize: 14, cursor: auditLoading ? 'wait' : 'pointer' }}>
            {auditLoading ? '검사 중...' : '🔍 전수조사 실행'}
          </button>
        </div>

        {auditData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 주식 요약 */}
            {auditData.stock && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>📈 주식 전수조사</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                  <div style={{ textAlign: 'center', padding: 8, background: `${C.green}10`, borderRadius: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{auditData.stock.total}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>활성 종목</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 8, background: `${C.red}10`, borderRadius: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.red }}>{auditData.stock.issues_count}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>이상 종목</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 8, background: `${C.yellow}10`, borderRadius: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.yellow }}>{auditData.stock.price_zero}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>가격 0원</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 8, background: `${C.purple}10`, borderRadius: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.purple }}>{auditData.stock.stale_3days}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>3일+ 미갱신</div>
                  </div>
                </div>
                {/* 시총 TOP 20 */}
                {auditData.stock.top20 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>시총 TOP 20</div>
                    <div style={{ maxHeight: 300, overflowY: 'auto', fontSize: 11 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          <th style={{ padding: '4px 6px', textAlign: 'left', color: C.textDim }}>#</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left', color: C.textDim }}>종목</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right', color: C.textDim }}>현재가</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right', color: C.textDim }}>시총</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right', color: C.textDim }}>등락</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right', color: C.textDim }}>갱신</th>
                          <th style={{ padding: '4px 6px', textAlign: 'center', color: C.textDim }}>액션</th>
                        </tr></thead>
                        <tbody>{auditData.stock.top20.map((s: any) => (
                          <tr key={s.symbol} style={{ borderBottom: `1px solid ${C.border}22` }}>
                            <td style={{ padding: '4px 6px', color: C.textDim }}>{s.rank}</td>
                            <td style={{ padding: '4px 6px', fontWeight: 600, color: C.text }}>{s.name}<span style={{ color: C.textDim, marginLeft: 4, fontSize: 9 }}>{s.symbol}</span></td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', color: C.text }}>{s.price}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', color: C.brand, fontWeight: 600 }}>{s.market_cap_display}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', color: s.change_pct > 0 ? C.red : s.change_pct < 0 ? C.cyan : C.textDim, fontWeight: 600 }}>{s.change_pct > 0 ? '+' : ''}{s.change_pct?.toFixed(2)}%</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', color: C.textDim, fontSize: 9 }}>{s.updated?.slice(5)}</td>
                            <td style={{ padding: '4px 4px', textAlign: 'center' }}>
                              <button onClick={() => runFix('/api/admin/fix-stock', 'refresh_single', { symbol: s.symbol })}
                                style={{ padding: '2px 6px', borderRadius: 3, border: 'none', background: `${C.brand}20`, color: C.brand, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>↻</button>
                            </td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}
                {/* 이상 종목 목록 */}
                {auditData.stock.issues?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 6 }}>⚠️ 이상 종목 ({auditData.stock.issues_count}건)</div>
                    <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 11 }}>
                      {auditData.stock.issues.map((s: any) => (
                        <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: `1px solid ${C.border}22` }}>
                          <span style={{ color: C.text, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name} ({s.symbol})</span>
                          <span style={{ color: C.red, fontSize: 9, flexShrink: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.issues.join('·')}</span>
                          <button onClick={() => runFix('/api/admin/fix-stock', 'refresh_single', { symbol: s.symbol })}
                            style={{ padding: '2px 6px', borderRadius: 3, border: 'none', background: `${C.brand}20`, color: C.brand, fontSize: 9, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>갱신</button>
                          <button onClick={() => runFix('/api/admin/fix-stock', 'deactivate', { symbol: s.symbol })}
                            style={{ padding: '2px 6px', borderRadius: 3, border: 'none', background: `${C.red}20`, color: C.red, fontSize: 9, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>비활성</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* 일괄 수정 버튼 */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => runFix('/api/admin/fix-stock', 'refresh_stale')}
                    style={{ padding: '5px 10px', borderRadius: 4, border: `1px solid ${C.yellow}40`, background: 'transparent', color: C.yellow, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    ⏰ 미갱신 일괄갱신
                  </button>
                  <button onClick={() => runFix('/api/admin/fix-stock', 'fix_zero_price')}
                    style={{ padding: '5px 10px', borderRadius: 4, border: `1px solid ${C.red}40`, background: 'transparent', color: C.red, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    🗑 가격0 비활성화
                  </button>
                  <button onClick={() => runFix('/api/admin/fix-stock', 'refresh_market_cap')}
                    style={{ padding: '5px 10px', borderRadius: 4, border: `1px solid ${C.brand}40`, background: 'transparent', color: C.brand, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    📊 시총0 갱신(50건)
                  </button>
                  <button onClick={() => runCronSingle('/api/cron/stock-naver-sync', '네이버 전체 시세 동기화')}
                    disabled={specialRunning}
                    style={{ padding: '5px 10px', borderRadius: 4, border: `1px solid ${C.green}40`, background: 'transparent', color: C.green, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    🔄 전체 네이버 동기화
                  </button>
                </div>
                {/* 시장별 종목 수 */}
                {auditData.stock.by_market && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, marginBottom: 6 }}>
                    {Object.entries(auditData.stock.by_market).map(([m, c]: any) => (
                      <span key={m} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: `${C.brand}10`, color: C.brand, fontWeight: 600 }}>
                        {m}: {c}개
                      </span>
                    ))}
                  </div>
                )}
                {/* 누락 종목 */}
                {(auditData.stock.missing_count > 0) && (
                  <div style={{ marginTop: 10, padding: 10, background: `${C.yellow}08`, border: `1px solid ${C.yellow}20`, borderRadius: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.yellow }}>📋 주요 종목 누락 ({auditData.stock.missing_count}건)</span>
                      <button onClick={() => runCronSingle('/api/cron/stock-discover', '누락 종목 자동 추가')}
                        disabled={specialRunning}
                        style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${C.yellow}40`, background: 'transparent', color: C.yellow, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                        🔄 자동 추가
                      </button>
                    </div>
                    {auditData.stock.missing_kr_top30?.length > 0 && (
                      <div style={{ fontSize: 10, color: C.textSec, marginBottom: 2 }}>
                        한국 누락: {auditData.stock.missing_kr_top30.join(', ')}
                      </div>
                    )}
                    {auditData.stock.missing_us_top30?.length > 0 && (
                      <div style={{ fontSize: 10, color: C.textSec }}>
                        해외 누락: {auditData.stock.missing_us_top30.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 부동산 요약 */}
            {auditData.apt && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>🏢 부동산 전수조사</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                  <div style={{ textAlign: 'center', padding: 8, background: `${C.green}10`, borderRadius: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{auditData.apt.total_subscriptions}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>분양현장</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 8, background: `${C.red}10`, borderRadius: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.red }}>{auditData.apt.issues_count}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>이상 현장</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 8, background: `${C.yellow}10`, borderRadius: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.yellow }}>{auditData.apt.total_households_null}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>총세대 미입력</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 8, background: `${C.purple}10`, borderRadius: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.purple }}>{auditData.apt.supply_zero}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>공급세대 0</div>
                  </div>
                </div>
                {/* 이상 현장 목록 */}
                {auditData.apt.issues?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 6 }}>⚠️ 데이터 이상 현장 ({auditData.apt.issues_count}건)</div>
                    <div style={{ maxHeight: 300, overflowY: 'auto', fontSize: 11 }}>
                      {auditData.apt.issues.map((a: any) => (
                        <div key={a.id} style={{ padding: '6px 4px', borderBottom: `1px solid ${C.border}22` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontWeight: 600, color: C.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                            <span style={{ color: C.textDim, fontSize: 9, flexShrink: 0 }}>{a.region}</span>
                          </div>
                          <div style={{ fontSize: 10, color: C.textDim }}>공급{a.supply} · 총세대{a.total_hh || '-'} · 일반{a.gen} · 특별{a.spe}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <span style={{ fontSize: 9, color: C.red, flex: 1, minWidth: 0 }}>{a.issues.join(' · ')}</span>
                            <input type="number" placeholder="총세대" style={{ width: 60, padding: '2px 4px', borderRadius: 3, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.05)', color: C.text, fontSize: 10 }}
                              onKeyDown={e => { if (e.key === 'Enter') runFix('/api/admin/fix-apt', 'update_household', { id: a.id, value: (e.target as HTMLInputElement).value }); }} />
                            <button onClick={e => { const inp = (e.currentTarget.previousSibling as HTMLInputElement); if (inp?.value) runFix('/api/admin/fix-apt', 'update_household', { id: a.id, value: inp.value }); }}
                              style={{ padding: '2px 6px', borderRadius: 3, border: 'none', background: `${C.green}20`, color: C.green, fontSize: 9, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>저장</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* 일괄 수정 버튼 */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => runFix('/api/admin/fix-apt', 'recalc_supply')}
                    style={{ padding: '5px 10px', borderRadius: 4, border: `1px solid ${C.brand}40`, background: 'transparent', color: C.brand, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    🔢 공급세대 재계산
                  </button>
                  <button onClick={() => runFix('/api/admin/fix-apt', 'fix_supply_mismatch')}
                    style={{ padding: '5px 10px', borderRadius: 4, border: `1px solid ${C.red}40`, background: 'transparent', color: C.red, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    🔄 총세대&lt;공급 리셋
                  </button>
                  <button onClick={() => runFix('/api/admin/fix-apt', 'verify_batch')}
                    style={{ padding: '5px 10px', borderRadius: 4, border: `1px solid ${C.cyan || '#22D3EE'}40`, background: 'transparent', color: C.cyan || '#22D3EE', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    🤖 K-apt 자동검증
                  </button>
                  <button onClick={() => runCronSingle('/api/cron/auto-verify-households', 'K-apt 자동검증 10건')}
                    disabled={specialRunning}
                    style={{ padding: '5px 10px', borderRadius: 4, border: `1px solid ${C.green}40`, background: 'transparent', color: C.green, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    🏠 총세대 추출 크론
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {fixLog && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: C.card, border: `1px solid ${fixLog.startsWith('✅') ? C.green : fixLog.startsWith('❌') ? C.red : C.brand}30`, fontSize: 11, color: fixLog.startsWith('✅') ? C.green : fixLog.startsWith('❌') ? C.red : C.textSec, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {fixLog}
          </div>
        )}
      </div>

      {/* ━━━ 특수 작업 ━━━ */}
      <div style={{ marginTop: 32, borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 'var(--sp-xs)' }}>🛠 특수 작업</div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 'var(--sp-lg)' }}>크론 외 1회성 관리 작업</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button onClick={() => runSpecial('/api/admin/seed-longtail-80', '롱테일 80편 시드')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.yellow}40`, background: C.card, color: C.yellow, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            📝 롱테일 80편 시드 생성
          </button>
          <button onClick={() => runSpecial('/api/admin/blog-limit-reset', 'daily_create_limit 10 원복')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.cyan}40`, background: C.card, color: C.cyan, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            🔢 블로그 생성 한도 원복 (→10)
          </button>
          <button onClick={() => runSpecial('/api/admin/batch-pdf-parse?token=kd-reparse-2026', 'PDF 배치 파싱 200건')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.red}40`, background: C.card, color: C.red, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            📄 PDF 파싱 200건 실행
          </button>
          <button onClick={() => runSpecial('/api/admin/blog-enrich?token=kd-reparse-2026&limit=20', '부실 블로그 재작성 20건')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.green}40`, background: C.card, color: C.green, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            📝 부실 블로그 재작성 20건
          </button>
          <button onClick={() => runSpecial('/api/admin/batch-reparse-v2?token=kd-reparse-2026&limit=50', 'PDF 재파싱 v2 (층수/주차/역) 50건')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.yellow}40`, background: C.card, color: C.yellow, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            🔄 PDF 재파싱 v2 50건
          </button>
          <button onClick={() => runSpecial('/api/admin/batch-total-hh', '총세대수 PDF 추출 100건')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.cyan}40`, background: C.card, color: C.cyan, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            🏗️ 총세대수 추출 100건
          </button>
          <button onClick={() => runCronSingle('/api/cron/kapt-sync', 'K-apt 세대수 연동 50건')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.green}40`, background: C.card, color: C.green, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            🏠 K-apt 연동 50건
          </button>
          <button onClick={() => runCronSingle('/api/cron/auto-verify-households', 'K-apt 자동검증 10건')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.cyan || '#22D3EE'}40`, background: C.card, color: C.cyan || '#22D3EE', fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            🤖 K-apt 자동검증 10건
          </button>
          <button onClick={() => runSpecial('/api/admin/batch-reparse?token=kd-reparse-2026', 'HTML 재파싱 30건')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.purple}40`, background: C.card, color: C.purple, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            🔄 HTML 재파싱 30건 실행
          </button>
          <button onClick={() => runCronSingle('/api/cron/naver-complex-sync', '네이버 단지 싱크')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.green}40`, background: C.card, color: C.green, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            🏘️ 네이버 단지 싱크
          </button>
          <button onClick={() => runSpecial('/api/admin/trigger-stock-refresh', '주식 시세 수동 갱신 (네이버+시총)')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.brand}40`, background: C.card, color: C.brand, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            📈 주식 시세 수동 갱신 (네이버+시총)
          </button>
          <button onClick={() => runCronSingle('/api/cron/stock-discover', '누락 종목 자동 발굴+추가')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.yellow}40`, background: C.card, color: C.yellow, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            🔍 누락 종목 자동 발굴
          </button>
        </div>
        {/* 벌크 수집 */}
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 20, marginBottom: 'var(--sp-sm)' }}>📦 실거래 벌크 수집</div>
        <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>연도별 매매/전월세 과거 데이터 수집 (API 일일 10,000건 한도)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-sm)' }}>
          {[2023, 2024, 2025].map(y => (
            <div key={y} style={{ display: 'flex', gap: 'var(--sp-xs)' }}>
              <button onClick={() => runSpecial('/api/admin/backfill-trades', `매매 ${y}`, { type: 'sale', year: y })}
                disabled={specialRunning}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${C.green}40`, background: C.card, color: C.green, fontWeight: 700, fontSize: 12, cursor: specialRunning ? 'wait' : 'pointer' }}>
                📊 매매 {y}
              </button>
              <button onClick={() => runSpecial('/api/admin/backfill-trades', `전월세 ${y}`, { type: 'rent', year: y })}
                disabled={specialRunning}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${C.purple}40`, background: C.card, color: C.purple, fontWeight: 700, fontSize: 12, cursor: specialRunning ? 'wait' : 'pointer' }}>
                🏠 전월세 {y}
              </button>
            </div>
          ))}
        </div>
        {/* 총세대수 자동검증 시스템 */}
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 20, marginBottom: 'var(--sp-sm)' }}>🤖 총세대수 자동검증</div>
        <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>K-apt 공공데이터 API 기반 자동 교차검증 · 매 6시간 자동 실행 · 확인중 {verifyCount > 0 ? `${verifyCount}건` : ''}</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button onClick={() => runCronSingle('/api/cron/auto-verify-households', 'K-apt 자동검증 10건')}
            disabled={specialRunning}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: `1px solid ${C.cyan || '#22D3EE'}40`, background: C.card, color: C.cyan || '#22D3EE', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            🤖 자동검증 실행
          </button>
          <button onClick={loadVerifyItems} disabled={verifyLoading}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: `1px solid ${C.border}`, background: C.card, color: C.textSec, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {verifyLoading ? '로딩...' : `📋 수동입력 목록`}
          </button>
        </div>
        {verifyItems.length > 0 && (
          <div style={{ maxHeight: 400, overflowY: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-sm)', padding: 8 }}>
            {verifyItems.map((v: any) => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px', borderBottom: `1px solid ${C.border}22`, fontSize: 12 }}>
                <span style={{ flex: 1, fontWeight: 700, color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.house_nm}>
                  {v.house_nm}
                </span>
                <span style={{ color: C.textDim, fontSize: 10, whiteSpace: 'nowrap' }}>{v.region_nm}·공급{v.tot_supply_hshld_co}</span>
                <input type="number" placeholder="총세대" 
                  style={{ width: 70, padding: '3px 6px', borderRadius: 4, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.05)', color: C.text, fontSize: 12 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveHousehold(v.id, v.house_nm, (e.target as HTMLInputElement).value);
                  }}
                />
                <button onClick={(e) => {
                    const input = (e.currentTarget.previousSibling as HTMLInputElement);
                    if (input?.value) saveHousehold(v.id, v.house_nm, input.value);
                  }}
                  style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.green, color: '#000', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>✓</button>
              </div>
            ))}
          </div>
        )}
        {specialLog && (
          <div style={{ marginTop: 'var(--sp-md)', padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-sm)', background: C.card, border: `1px solid ${C.border}`, fontSize: 12, color: specialLog.startsWith('✅') ? C.green : specialLog.startsWith('❌') ? C.red : C.textSec, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {specialLog}
          </div>
        )}
      </div>
    </div>
  );
}
