'use client';

// [S10-2] 경보함 목록. 트리아지 기준은 archived (is_read 아님).

import { useCallback, useEffect, useState } from 'react';
import { normalizeSeverity, LEVEL_STYLE, type AlertLevel } from '@/lib/admin/alert-severity';

interface AlertRow {
  id: string;
  type: string;
  severity: string | null;
  title: string;
  message: string | null;
  archived: boolean;
  archived_at: string | null;
  created_at: string;
}

interface LiveCounts { total: number; critical: number; warning: number; info: number }

type Tab = 'live' | 'critical' | 'archived';

const TABS: { key: Tab; label: string }[] = [
  { key: 'live', label: '살아있음' },
  { key: 'critical', label: '심각' },
  { key: 'archived', label: '아카이브' },
];

function queryFor(tab: Tab): string {
  if (tab === 'archived') return 'archived=1&limit=200';
  if (tab === 'critical') return 'archived=0&severity=critical&limit=200';
  return 'archived=0&limit=200';
}

function fmt(iso: string): string {
  // 서버 TZ 가 UTC 라 toLocaleString 에 타임존을 명시한다 — 안 하면 배포 환경에서 9시간 밀린다.
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const btn: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)', background: 'var(--bg-surface)',
  color: 'var(--text-secondary)', cursor: 'pointer', minHeight: 32,
};

export default function AlertsClient() {
  const [tab, setTab] = useState<Tab>('live');
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [counts, setCounts] = useState<LiveCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/alerts?${queryFor(t)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const j = await res.json();
      setRows(j.rows || []);
      setCounts(j.live_by_severity || null);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  async function archiveOne(id: string) {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      await load(tab);
    } catch (e: any) {
      setErr(e?.message ?? 'archive failed');
    } finally {
      setBusy(null);
    }
  }

  async function archiveAll() {
    setConfirmAll(false);
    setBusy('__all__');
    try {
      const res = await fetch('/api/admin/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      await load(tab);
    } catch (e: any) {
      setErr(e?.message ?? 'archive failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(12px, 3vw, 24px)', color: 'var(--text-primary)' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>경보함</h1>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 14px', lineHeight: 1.6 }}>
        트리아지 기준은 <strong>아카이브</strong>입니다. 읽음 표시는 쓰지 않습니다(전량 미읽음이라 신호가 되지 못합니다).
        14일 경과분은 크론이 자동으로 아카이브합니다.
      </p>

      {/* 살아있는 건수 */}
      {counts && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {([
            ['살아있음', counts.total, 'var(--text-primary)', 'var(--bg-hover)'],
            ['심각', counts.critical, LEVEL_STYLE.critical.color, LEVEL_STYLE.critical.bg],
            ['주의', counts.warning, LEVEL_STYLE.warning.color, LEVEL_STYLE.warning.bg],
            ['정보', counts.info, LEVEL_STYLE.info.color, LEVEL_STYLE.info.bg],
          ] as const).map(([label, n, color, bg]) => (
            <div key={label} style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', background: bg, border: '1px solid var(--border)', minWidth: 92 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color }}>{n}</div>
            </div>
          ))}
        </div>
      )}

      {/* 탭 + 일괄 아카이브 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...btn,
              background: tab === t.key ? 'var(--brand)' : 'var(--bg-surface)',
              color: tab === t.key ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${tab === t.key ? 'var(--brand)' : 'var(--border)'}`,
            }}
          >{t.label}</button>
        ))}
        <span style={{ flex: 1 }} />
        {tab !== 'archived' && (
          <button
            onClick={() => setConfirmAll(true)}
            disabled={busy !== null || (counts?.total ?? 0) === 0}
            style={{ ...btn, opacity: busy !== null || (counts?.total ?? 0) === 0 ? 0.5 : 1 }}
          >일괄 아카이브</button>
        )}
      </div>

      {err && (
        <div style={{ padding: 12, marginBottom: 12, borderRadius: 'var(--radius-md)', background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', fontSize: 12 }}>
          {err}
        </div>
      )}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로드 중…</div>}

      {!loading && rows.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          해당하는 경보가 없습니다.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-surface)' }}>
          {rows.map((r, i) => {
            const lv: AlertLevel = normalizeSeverity(r.severity);
            const st = LEVEL_STYLE[lv];
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}>
                <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-tertiary)', width: 82, paddingTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(r.created_at)}
                </span>
                <span style={{
                  flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)', background: st.bg, color: st.color, marginTop: 1,
                }}>{st.label}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                    {r.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                    {r.type}{r.severity ? ` · ${r.severity}` : ''}
                  </span>
                  {r.message && (
                    <span style={{
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden', fontSize: 12, color: 'var(--text-secondary)',
                      lineHeight: 1.55, marginTop: 3, wordBreak: 'break-word',
                    }}>{r.message}</span>
                  )}
                </span>
                {!r.archived && (
                  <button
                    onClick={() => archiveOne(r.id)}
                    disabled={busy !== null}
                    style={{ ...btn, flexShrink: 0, opacity: busy === r.id ? 0.5 : 1 }}
                  >{busy === r.id ? '…' : '아카이브'}</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 일괄 아카이브 확인 — 되돌리려면 DB 에서 archived=false 로 바꿔야 하므로 모달을 반드시 거친다 */}
      {confirmAll && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="kd-alert-confirm-title"
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setConfirmAll(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 420, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18 }}
          >
            <h2 id="kd-alert-confirm-title" style={{ fontSize: 15, fontWeight: 800, margin: '0 0 8px' }}>
              살아있는 경보 {counts?.total ?? 0}건을 모두 아카이브합니다
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 16px' }}>
              삭제가 아니라 <code>archived</code> 플래그만 켭니다. 다만 화면에서 한 번에 사라지므로
              아직 확인하지 않은 진짜 신호가 섞여 있는지 먼저 보세요.
              되돌리려면 DB 에서 <code>archived = false</code> 로 바꿔야 합니다.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmAll(false)} style={btn}>취소</button>
              <button
                onClick={archiveAll}
                style={{ ...btn, background: 'var(--accent-red)', color: '#fff', border: '1px solid var(--accent-red)' }}
              >모두 아카이브</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
