'use client';
import { useEffect, useState } from 'react';

interface DailyRow {
  day: string; browser_type: string;
  attempts: number; oauth_started: number; oauth_callback: number; success: number;
  dropped_oauth_start: number; success_pct: number | null;
}
interface BrowserAgg {
  browser_type: string; attempts: number; oauth_started: number; oauth_callback: number; success: number; success_pct: number;
}
interface Resp { ok: boolean; daily: DailyRow[]; by_browser: BrowserAgg[]; error?: string }

const DANGER_BROWSERS = new Set(['daum_inapp', 'karrot_inapp', 'social_inapp', 'webview']);

function badgeColor(pct: number, attempts: number): string {
  if (attempts < 3) return 'var(--text-tertiary, #666)';
  if (pct < 20) return '#ef4444';
  if (pct < 40) return '#f59e0b';
  return '#22c55e';
}

export default function InAppBrowserCard() {
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/inapp-browser-funnel', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: Resp) => { if (!cancelled) setData(j); })
      .catch(e => { if (!cancelled) setErr(String(e?.message || e)); });
    return () => { cancelled = true; };
  }, []);

  if (err) return <div style={{ padding: 16, color: '#ef4444', fontSize: 12 }}>인앱 funnel 로드 실패: {err}</div>;
  if (!data) return <div style={{ padding: 16, color: 'var(--text-tertiary, #666)', fontSize: 12 }}>인앱 funnel 로딩 중…</div>;
  if (!data.ok) return <div style={{ padding: 16, color: '#ef4444', fontSize: 12 }}>{data.error || '데이터 없음'}</div>;

  const browsers = data.by_browser;
  const totalAttempts = browsers.reduce((s, b) => s + b.attempts, 0);
  const totalSuccess = browsers.reduce((s, b) => s + b.success, 0);
  const overallPct = totalAttempts > 0 ? Math.round((totalSuccess / totalAttempts) * 1000) / 10 : 0;
  const blockedAttempts = browsers.filter(b => DANGER_BROWSERS.has(b.browser_type)).reduce((s, b) => s + b.attempts, 0);
  const blockedPct = totalAttempts > 0 ? Math.round((blockedAttempts / totalAttempts) * 1000) / 10 : 0;

  return (
    <section
      aria-label="인앱 브라우저 가입 funnel"
      style={{ background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)', borderRadius: 12, padding: 16, marginTop: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>📱 인앱 브라우저 가입 funnel (14d)</h2>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #666)' }}>
          전체 {totalAttempts.toLocaleString()} 시도 · 성공률 {overallPct}% · 인앱 차단군 {blockedPct}%
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid var(--border, #2a2b35)' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-tertiary, #666)', fontWeight: 700 }}>브라우저</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary, #666)', fontWeight: 700 }}>시도</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary, #666)', fontWeight: 700 }}>OAuth 시작</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary, #666)', fontWeight: 700 }}>콜백</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary, #666)', fontWeight: 700 }}>성공</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-tertiary, #666)', fontWeight: 700 }}>성공률</th>
            </tr>
          </thead>
          <tbody>
            {browsers.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary, #666)' }}>14일 데이터 없음</td></tr>
            )}
            {browsers.map(b => {
              const isBlocked = DANGER_BROWSERS.has(b.browser_type);
              return (
                <tr key={b.browser_type} style={{ borderBottom: '1px solid var(--border, #2a2b35)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                    {isBlocked && <span style={{ color: '#ef4444', marginRight: 4 }}>🚫</span>}
                    {b.browser_type}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary, #888)' }}>{b.attempts.toLocaleString()}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary, #888)' }}>{b.oauth_started.toLocaleString()}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary, #888)' }}>{b.oauth_callback.toLocaleString()}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{b.success.toLocaleString()}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: badgeColor(b.success_pct, b.attempts) }}>
                    {b.success_pct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.daily.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 11, color: 'var(--text-tertiary, #666)', cursor: 'pointer', fontWeight: 600 }}>
            일별 상세 ({data.daily.length} 행)
          </summary>
          <div style={{ marginTop: 8, maxHeight: 240, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border, #2a2b35)' }}>
                  <th style={{ padding: '4px 6px', textAlign: 'left', color: 'var(--text-tertiary, #666)' }}>날짜</th>
                  <th style={{ padding: '4px 6px', textAlign: 'left', color: 'var(--text-tertiary, #666)' }}>브라우저</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-tertiary, #666)' }}>시도</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-tertiary, #666)' }}>성공</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-tertiary, #666)' }}>성공률</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map((r, i) => (
                  <tr key={`${r.day}-${r.browser_type}-${i}`} style={{ borderBottom: '0.5px solid var(--border, #2a2b35)' }}>
                    <td style={{ padding: '4px 6px', color: 'var(--text-secondary, #888)' }}>{r.day}</td>
                    <td style={{ padding: '4px 6px', color: 'var(--text-primary, #fff)' }}>{r.browser_type}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-secondary, #888)' }}>{r.attempts}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-primary, #fff)' }}>{r.success}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, color: badgeColor(Number(r.success_pct ?? 0), r.attempts) }}>
                      {r.success_pct != null ? `${Number(r.success_pct).toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
