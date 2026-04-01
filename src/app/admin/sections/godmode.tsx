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
    { key: 'full', label: '⚡ 전체 실행', desc: 'Phase 순차 — 94개 전 크론', color: C.brand },
    { key: 'data', label: '📊 데이터 수집', desc: '청약/실거래/주식/재개발 17개', color: C.green },
    { key: 'process', label: '⚙️ 데이터 가공', desc: '집계/싱크/검증/좌표/K-apt 13개', color: C.cyan },
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
          <button onClick={() => runSpecial('/api/cron/kapt-sync', 'K-apt 세대수 연동 50건')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.green}40`, background: C.card, color: C.green, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            🏠 K-apt 연동 50건
          </button>
          <button onClick={() => runSpecial('/api/cron/auto-verify-households', 'K-apt 자동검증 10건')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.cyan || '#22D3EE'}40`, background: C.card, color: C.cyan || '#22D3EE', fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            🤖 K-apt 자동검증 10건
          </button>
          <button onClick={() => runSpecial('/api/admin/batch-reparse?token=kd-reparse-2026', 'HTML 재파싱 30건')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.purple}40`, background: C.card, color: C.purple, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            🔄 HTML 재파싱 30건 실행
          </button>
          <button onClick={() => runSpecial('/api/cron/naver-complex-sync', '네이버 단지 싱크')}
            disabled={specialRunning}
            style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${C.green}40`, background: C.card, color: C.green, fontWeight: 700, fontSize: 13, cursor: specialRunning ? 'wait' : 'pointer' }}>
            🏘️ 네이버 단지 싱크
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
          <button onClick={() => runSpecial('/api/cron/auto-verify-households', 'K-apt 자동검증 10건')}
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
