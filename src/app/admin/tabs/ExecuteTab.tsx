'use client';
import { useState, useCallback, useRef, useEffect } from 'react';

type RunResult = { cron: string; phase: string; status: number; duration: number; error?: string };

export default function ExecuteTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState(0);
  const [totalCrons, setTotalCrons] = useState(0);
  const [completedCrons, setCompletedCrons] = useState(0);
  const [mode, setMode] = useState<string>('');
  const [lastRun, setLastRun] = useState<{ at: string; ok: number; fail: number } | null>(null);
  const [infra, setInfra] = useState<{ cronCurrent: number; cronMaxSlots: number }>({ cronCurrent: 153, cronMaxSlots: 200 });
  const [kpiCounts, setKpiCounts] = useState<{ stocks: number; sites: number }>({ stocks: 0, sites: 0 });
  const abortRef = useRef(false);

  // 마지막 실행 정보 + 인프라 로드
  useEffect(() => {
    fetch('/api/admin/v2?tab=focus').then(r => r.json()).then(d => {
      if (d?.infra) setInfra(d.infra);
      if (d?.kpi) setKpiCounts({ stocks: d.kpi.stocks || 0, sites: d.extended?.aptSites || 0 });
      if (d?.recentActivity?.length > 0) {
        const cron = d.recentActivity.find((a: any) => a.type === 'cron');
        if (cron) setLastRun({ at: cron.at, ok: d.kpi?.cronSuccess || 0, fail: d.kpi?.cronFail || 0 });
      }
    }).catch(() => {});
  }, []);

  const runGodMode = useCallback(async (selectedMode: string) => {
    if (running) return;
    if (!confirm(`${selectedMode === 'full' ? `${infra.cronCurrent}개 크론을 5단계로` : selectedMode + ' 그룹을'} 실행합니다. 계속하시겠습니까?`)) return;

    setRunning(true);
    setResults([]);
    setMode(selectedMode);
    setProgress(0);
    setCompletedCrons(0);
    abortRef.current = false;

    try {
      const r = await fetch('/api/admin/god-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selectedMode }),
      });
      const data = await r.json();

      if (data.results) {
        setResults(data.results);
        setProgress(100);
        setCompletedCrons(data.results.length);
        setTotalCrons(data.results.length);
      }
    } catch (e: any) {
      alert(`실행 실패: ${e.message}`);
    } finally {
      setRunning(false);
    }
  }, [running]);

  // 실행 중일 때 진행률 폴링
  useEffect(() => {
    if (!running) return;
    const poll = setInterval(async () => {
      try {
        const r = await fetch('/api/admin/cron-summary');
        const d = await r.json();
        if (d.recent) {
          setCompletedCrons(d.recent.length);
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(poll);
  }, [running]);

  const okCount = results.filter(r => r.status >= 200 && r.status < 400).length;
  const failCount = results.filter(r => r.status >= 400 || r.status === 0).length;

  const groups = [
    { key: 'data', icon: '📡', label: '데이터', desc: '크롤링 + 시세' },
    { key: 'process', icon: '⚙️', label: '처리', desc: '동기화 + 파싱' },
    { key: 'ai', icon: '🤖', label: 'AI', desc: 'Anthropic 생성' },
    { key: 'content', icon: '✍️', label: '콘텐츠', desc: '블로그 + 시드' },
    { key: 'system', icon: '🛠️', label: '시스템', desc: '정리 + 인덱싱' },
  ];

  return (
    <div>
      {/* 영웅 버튼 */}
      <button
        onClick={() => runGodMode('full')}
        disabled={running}
        style={{
          width: '100%', padding: 24, border: 'none', borderRadius: 14,
          background: running ? 'var(--bg-surface)' : 'linear-gradient(135deg, #2563EB, #3B82F6)',
          color: running ? 'var(--text-secondary)' : '#fff',
          fontSize: 18, fontWeight: 800, cursor: running ? 'not-allowed' : 'pointer',
          marginBottom: 16, position: 'relative', overflow: 'hidden',
        }}
      >
        {running ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
            실행 중...
          </div>
        ) : (
          <>
            🚀 전체 최신화
            <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.85, marginTop: 6 }}>
              {infra.cronCurrent}개 크론 · 5단계 순차 실행 · 예상 ~5분
            </div>
          </>
        )}
      </button>

      {/* 카테고리별 실행 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {groups.map(g => (
          <button key={g.key} className="adm-btn" onClick={() => runGodMode(g.key)} disabled={running}
            style={{ flex: '1 1 calc(33% - 4px)', minWidth: 90, textAlign: 'center', padding: '8px 6px' }}>
            <div style={{ fontSize: 16 }}>{g.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>{g.label}</div>
          </button>
        ))}
        <button className="adm-btn" onClick={() => runGodMode('failed')} disabled={running}
          style={{ flex: '1 1 calc(33% - 4px)', minWidth: 90, textAlign: 'center', padding: '8px 6px', color: '#EF4444', borderColor: '#EF4444' }}>
          <div style={{ fontSize: 16 }}>🔴</div>
          <div style={{ fontSize: 11, fontWeight: 600 }}>실패만</div>
        </button>
      </div>

      {/* IndexNow 풀스위프 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>🖼️ 이미지 관리</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {[
            { ep: '/api/cron/blog-generate-images', icon: '📷', label: '블로그 이미지', desc: 'Naver→실사진' },
            { ep: '/api/cron/collect-complex-images', icon: '🏠', label: '단지 이미지', desc: '아파트 사진' },
            { ep: '/api/cron/collect-site-images', icon: '🏗️', label: '현장 이미지', desc: '분양현장' },
            { ep: '/api/cron/apt-image-crawl', icon: '🔍', label: '청약 이미지', desc: '조감도 크롤' },
          ].map(s => (
            <button key={s.ep} className="adm-btn" disabled={running}
              onClick={async () => {
                if (!confirm(`${s.label} 크론을 실행합니다.`)) return;
                setRunning(true); setResults([]);
                try {
                  const r = await fetch('/api/admin/god-mode', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'single', endpoint: s.ep }),
                  });
                  const d = await r.json();
                  const res = d.results?.[0];
                  setResults(d.results || []);
                  alert(`${res?.status === 200 ? '✅' : '❌'} ${s.label}: ${res?.status} (${(res?.duration || 0).toFixed(1)}s)`);
                } catch (e: any) { alert(`❌ ${e.message}`); } finally { setRunning(false); }
              }}
              style={{ flex: '1 1 calc(25% - 5px)', minWidth: 70, textAlign: 'center', padding: '6px 4px' }}>
              <div style={{ fontSize: 14 }}>{s.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{s.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>🔍 SEO 인덱싱 (IndexNow)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { type: 'stock', icon: '📈', label: '종목 전체', desc: kpiCounts.stocks > 0 ? `${kpiCounts.stocks.toLocaleString()}개` : '종목' },
            { type: 'complex&offset=0', icon: '🏠', label: '단지 1차', desc: '0~5000' },
            { type: 'complex&offset=5000', icon: '🏠', label: '단지 2차', desc: '5K~10K' },
            { type: 'complex&offset=10000', icon: '🏠', label: '단지 3차', desc: '10K~15K' },
            { type: 'complex&offset=15000', icon: '🏠', label: '단지 4차', desc: '15K~20K' },
            { type: 'complex&offset=20000', icon: '🏠', label: '단지 5차', desc: '20K~25K' },
            { type: 'complex&offset=25000', icon: '🏠', label: '단지 6차', desc: '25K~30K' },
            { type: 'complex&offset=30000', icon: '🏠', label: '단지 7차', desc: '30K~35K' },
            { type: 'site', icon: '🏗️', label: '현장 전체', desc: kpiCounts.sites > 0 ? `${kpiCounts.sites.toLocaleString()}개` : '현장' },
            { type: 'all', icon: '🌐', label: '전체', desc: '올인원' },
          ].map(s => (
            <button key={s.type} className="adm-btn" disabled={running}
              onClick={async () => {
                if (!confirm(`IndexNow ${s.label} (${s.desc}) 제출하시겠습니까?`)) return;
                setRunning(true); setResults([]);
                try {
                  const r = await fetch('/api/admin/god-mode', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'single', endpoint: `/api/cron/indexnow-full-sweep?type=${s.type}` }),
                  });
                  const d = await r.json();
                  alert(`✅ ${s.label}: ${d.results?.[0]?.status === 200 ? '성공' : '실패'} (${d.results?.[0]?.duration || 0}ms)`);
                } catch (e: any) { alert(`❌ ${e.message}`); } finally { setRunning(false); }
              }}
              style={{ flex: '1 1 calc(20% - 5px)', minWidth: 70, textAlign: 'center', padding: '6px 4px' }}>
              <div style={{ fontSize: 14 }}>{s.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 진행 표시 */}
      {(running || results.length > 0) && (
        <div className="adm-card">
          {running && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>실행 진행</div>
              <div className="adm-bar" style={{ height: 12, marginBottom: 8 }}>
                <div className="adm-bar-fill" style={{ width: '100%', background: 'var(--brand)', animation: 'pulse-glow 1.5s infinite' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                {mode} 모드 실행 중... 응답 대기
              </div>
            </>
          )}

          {!running && results.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>{failCount === 0 ? '✅' : '⚠️'}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {okCount}/{results.length} 성공
                    {failCount > 0 && <span style={{ color: '#EF4444' }}> · {failCount} 실패</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    총 {results.reduce((s, r) => s + (r.duration || 0), 0).toFixed(1)}초 소요
                  </div>
                </div>
                <span style={{ flex: 1 }} />
                {failCount > 0 && (
                  <button className="adm-btn" style={{ color: '#EF4444', borderColor: '#EF4444', fontSize: 11 }}
                    onClick={() => runGodMode('failed')}>
                    실패 재실행
                  </button>
                )}
              </div>

              {/* 결과 테이블 */}
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {results.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                    <span style={{ color: r.status >= 200 && r.status < 400 ? '#10B981' : '#EF4444' }}>
                      {r.status >= 200 && r.status < 400 ? '✓' : '✗'}
                    </span>
                    <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cron}</span>
                    <span style={{ color: 'var(--text-tertiary)', minWidth: 40, textAlign: 'right' }}>{r.duration ? `${r.duration.toFixed(1)}s` : '—'}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', padding: '1px 4px', borderRadius: 4, minWidth: 24, textAlign: 'center' }}>{r.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 빈 상태 + 마지막 실행 정보 */}
      {!running && results.length === 0 && (
        <div className="adm-card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🚀</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>전체 최신화 버튼을 누르면</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{infra.cronCurrent}개 크론이 5단계로 순차 실행됩니다</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>AI 크론은 Fire-and-Forget (백그라운드)</div>
          {lastRun && (
            <div style={{ marginTop: 14, padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              마지막 크론 활동: {new Date(lastRun.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
              <span style={{ marginLeft: 8, color: '#10B981' }}>✓{lastRun.ok}</span>
              {lastRun.fail > 0 && <span style={{ marginLeft: 4, color: '#EF4444' }}>✗{lastRun.fail}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
