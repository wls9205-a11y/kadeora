'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, C, DataTable, KPI, KPICard } from '../admin-shared';

export default function GodModeSection() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<string>('full');
  const timerRef = useRef<any>(null);

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
    } catch (e: any) {
      setResults([{ name: 'ERROR', ok: false, error: e.message }]);
    } finally {
      clearInterval(timerRef.current);
      setElapsed(Date.now() - start);
      setRunning(false);
    }
  };

  const modes = [
    { key: 'full', label: '⚡ 전체 실행', desc: '42개 전 크론', color: C.brand },
    { key: 'data', label: '📊 데이터 수집', desc: '청약/실거래/주식/재개발 15개', color: C.green },
    { key: 'process', label: '⚙️ 데이터 가공', desc: '집계/싱크/테마/검증 6개', color: C.cyan },
    { key: 'ai', label: '🤖 AI 생성', desc: '요약/이미지/트렌드/리라이트 6개', color: C.purple },
    { key: 'content', label: '📝 콘텐츠', desc: '시드/블로그/채팅 6개', color: C.yellow },
    { key: 'system', label: '🔧 시스템', desc: '헬스/통계/알림/정리 10개', color: C.textSec },
    { key: 'failed', label: '🔴 실패 재시도', desc: '실패한 것만', color: C.red },
  ];

  const successCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 8px' }}>⚡ GOD MODE</h1>
      <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 24px' }}>병렬 10x 실행 — 전체 시스템을 원클릭으로 갱신</p>

      {/* Mode Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
        {modes.map(m => (
          <button key={m.key} onClick={() => { setMode(m.key); run(m.key); }} disabled={running}
            style={{
              padding: '16px 14px', borderRadius: 12, border: `1px solid ${running ? C.border : m.color}40`,
              background: C.card, cursor: running ? 'wait' : 'pointer', textAlign: 'left', transition: 'all .15s',
            }}
            onMouseEnter={e => { if (!running) e.currentTarget.style.borderColor = m.color; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${m.color}40`; }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 11, color: C.textDim }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Progress */}
      {running && (
        <div style={{ background: C.card, border: `1px solid ${C.brand}40`, borderRadius: 12, padding: 20, marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8, animation: 'pulse 1.5s infinite' }}>⚡</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{mode.toUpperCase()} 실행 중...</div>
          <div style={{ fontSize: 14, color: C.brand, fontWeight: 600, marginTop: 4 }}>{(elapsed / 1000).toFixed(1)}초</div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <KPICard icon="✅" label="성공" value={successCount} color={C.green} />
            <KPICard icon="❌" label="실패" value={failCount} color={C.red} />
            <KPICard icon="⏱" label="소요시간" value={`${(elapsed / 1000).toFixed(1)}s`} color={C.brand} />
          </div>
          <DataTable
            headers={['크론', '상태', 'HTTP', '소요시간', '에러']}
            rows={results.map(r => [
              <span key="n" style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{r.name}</span>,
              r.ok ? <Badge key="s" color={C.green}>✓ OK</Badge> : <Badge key="s" color={C.red}>✗ FAIL</Badge>,
              r.status ? <span key="h" style={{ color: r.status >= 400 ? C.red : r.status >= 200 ? C.green : C.textDim, fontFamily: 'monospace', fontSize: 12 }}>{r.status}</span> : '—',
              r.duration ? `${(r.duration / 1000).toFixed(1)}s` : '—',
              r.error ? <span key="e" style={{ color: C.red, fontSize: 11, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{r.error}</span> : '—',
            ])}
          />
        </>
      )}
    </div>
  );
}
